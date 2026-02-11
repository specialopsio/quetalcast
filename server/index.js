import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createLogger } from './logger.js';
import { RoomManager } from './room-manager.js';
import { SessionManager } from './auth.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const REQUIRE_TLS = process.env.REQUIRE_TLS === 'true';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

const logger = createLogger('server');
const rooms = new RoomManager(logger);
const sessions = new SessionManager(SESSION_SECRET);

// Express setup
const app = express();
app.use(express.json());
app.use(cookieParser());

// CORS
app.use((req, res, next) => {
  const origin = ALLOWED_ORIGIN === '*' ? req.headers.origin || '*' : ALLOWED_ORIGIN;
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// TLS enforcement
if (REQUIRE_TLS) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.status(403).json({ error: 'HTTPS required' });
    }
    next();
  });
}

// Rate limiting
const loginLimiter = rateLimit({ windowMs: 60000, max: 10, message: { error: 'Too many login attempts' } });

// Auth routes
app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    const token = sessions.create(username);
    res.cookie('session', token, {
      httpOnly: true,
      secure: REQUIRE_TLS,
      sameSite: 'strict',
      maxAge: 86400000, // 24h
    });
    logger.info({ username }, 'Login successful');
    res.json({ ok: true, username });
  } else {
    logger.warn({ username }, 'Login failed');
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies.session;
  if (token) sessions.destroy(token);
  res.clearCookie('session');
  res.json({ ok: true });
});

// Admin routes
app.get('/admin/rooms', (req, res) => {
  res.json({ rooms: rooms.listRooms() });
});

// Serve static frontend (production)
const staticPath = path.join(__dirname, '..', 'dist');
app.use(express.static(staticPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/admin')) return next();
  res.sendFile(path.join(staticPath, 'index.html'));
});

// HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket rate limiting
const wsJoinCounts = new Map();
const WS_JOIN_LIMIT = 20;
const WS_JOIN_WINDOW = 60000;

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown';

  // Origin check
  if (ALLOWED_ORIGIN !== '*') {
    const origin = req.headers.origin;
    if (origin && origin !== ALLOWED_ORIGIN) {
      logger.warn({ origin, ip }, 'WebSocket rejected: origin mismatch');
      ws.close(4003, 'Origin not allowed');
      return;
    }
  }

  // Rate limit
  const now = Date.now();
  const joins = wsJoinCounts.get(ip) || [];
  const recent = joins.filter(t => now - t < WS_JOIN_WINDOW);
  if (recent.length >= WS_JOIN_LIMIT) {
    logger.warn({ ip }, 'WebSocket rate limited');
    ws.close(4029, 'Rate limited');
    return;
  }
  recent.push(now);
  wsJoinCounts.set(ip, recent);

  let clientRoom = null;
  let clientRole = null;

  logger.info({ ip }, 'WebSocket connected');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'create-room': {
        const roomId = rooms.create();
        clientRoom = roomId;
        clientRole = 'broadcaster';
        rooms.join(roomId, 'broadcaster', ws);
        ws.send(JSON.stringify({ type: 'room-created', roomId }));
        ws.send(JSON.stringify({ type: 'joined', roomId, role: 'broadcaster' }));
        logger.info({ roomId: roomId.slice(0, 8), ip }, 'Room created');
        break;
      }

      case 'join-room': {
        const { roomId, role } = msg;
        if (!roomId || !role) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing roomId or role', code: 'MISSING_PARAMS' }));
          break;
        }
        const result = rooms.join(roomId, role, ws);
        if (!result.ok) {
          ws.send(JSON.stringify({ type: 'error', message: result.error, code: result.code }));
          break;
        }
        clientRoom = roomId;
        clientRole = role;
        ws.send(JSON.stringify({ type: 'joined', roomId, role }));
        // Notify existing peer
        const peer = rooms.getPeer(roomId, role === 'broadcaster' ? 'receiver' : 'broadcaster');
        if (peer) {
          peer.send(JSON.stringify({ type: 'peer-joined', role }));
          ws.send(JSON.stringify({ type: 'peer-joined', role: role === 'broadcaster' ? 'receiver' : 'broadcaster' }));
        }
        logger.info({ roomId: roomId.slice(0, 8), role, ip }, 'Joined room');
        break;
      }

      case 'ready': {
        // Broadcaster signals ready, notify receiver if present
        if (clientRoom && clientRole === 'broadcaster') {
          const receiver = rooms.getPeer(clientRoom, 'receiver');
          if (receiver) {
            ws.send(JSON.stringify({ type: 'peer-joined', role: 'receiver' }));
          }
        }
        break;
      }

      case 'offer':
      case 'answer': {
        if (!clientRoom) break;
        const targetRole = msg.type === 'offer' ? 'receiver' : 'broadcaster';
        const peer = rooms.getPeer(clientRoom, targetRole);
        if (peer) {
          peer.send(JSON.stringify({ type: msg.type, sdp: msg.sdp }));
          logger.info({ roomId: clientRoom.slice(0, 8), type: msg.type }, 'Relayed SDP');
        }
        break;
      }

      case 'candidate': {
        if (!clientRoom) break;
        const targetRole2 = clientRole === 'broadcaster' ? 'receiver' : 'broadcaster';
        const peer2 = rooms.getPeer(clientRoom, targetRole2);
        if (peer2) {
          peer2.send(JSON.stringify({ type: 'candidate', candidate: msg.candidate }));
        }
        break;
      }

      case 'leave': {
        if (clientRoom && clientRole) {
          const peer = rooms.getPeer(clientRoom, clientRole === 'broadcaster' ? 'receiver' : 'broadcaster');
          if (peer) peer.send(JSON.stringify({ type: 'peer-left', role: clientRole }));
          rooms.leave(clientRoom, clientRole);
          logger.info({ roomId: clientRoom.slice(0, 8), role: clientRole }, 'Left room');
        }
        clientRoom = null;
        clientRole = null;
        break;
      }

      case 'stats': {
        if (clientRoom && clientRole) {
          rooms.logStats(clientRoom, clientRole, msg.data);
        }
        break;
      }

      default:
        logger.debug({ type: msg.type }, 'Unknown message type');
    }
  });

  ws.on('close', (code, reason) => {
    if (clientRoom && clientRole) {
      const peer = rooms.getPeer(clientRoom, clientRole === 'broadcaster' ? 'receiver' : 'broadcaster');
      if (peer) peer.send(JSON.stringify({ type: 'peer-left', role: clientRole }));
      rooms.leave(clientRoom, clientRole);
      logger.info({ roomId: clientRoom?.slice(0, 8), role: clientRole, code, reason: reason?.toString() }, 'Disconnected');
    }
  });

  ws.on('error', (err) => {
    logger.error({ ip, error: err.message }, 'WebSocket error');
  });
});

server.listen(PORT, () => {
  logger.info({ port: PORT, origin: ALLOWED_ORIGIN, tls: REQUIRE_TLS }, 'Signaling server started');
});
