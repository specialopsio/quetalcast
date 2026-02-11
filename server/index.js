import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createLogger } from './logger.js';
import { RoomManager } from './room-manager.js';
import { SessionManager } from './auth.js';
import { testConnection, connectToServer, updateStreamMetadata } from './integration-relay.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const REQUIRE_TLS = process.env.REQUIRE_TLS === 'true';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// TURN — option A: Metered.ca dynamic credentials (recommended)
const METERED_APP_NAME = process.env.METERED_APP_NAME || '';   // e.g. quetalcast.metered.live
const METERED_API_KEY = process.env.METERED_API_KEY || '';
// TURN — option B: Static credentials (any TURN provider)
const TURN_URL = process.env.TURN_URL || '';
const TURN_USERNAME = process.env.TURN_USERNAME || '';
const TURN_CREDENTIAL = process.env.TURN_CREDENTIAL || '';

const logger = createLogger('server');
const rooms = new RoomManager(logger);
const sessions = new SessionManager(SESSION_SECRET);

// Express setup
const app = express();
app.use(express.json({ limit: '16kb' })); // Fix: explicit size limit
app.use(cookieParser());
app.set('trust proxy', 1); // Fix #4: trust first proxy hop (Fly.io etc.)

// Fix #2: CORS — don't reflect arbitrary origins with credentials
app.use((req, res, next) => {
  if (ALLOWED_ORIGIN === '*') {
    // Wildcard: no credentials, open access
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    // Specific origin: allow credentials
    res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
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

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.cookies.session;
  if (!token || !sessions.validate(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Auth routes
app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === ADMIN_PASSWORD) {
    const token = sessions.create(username);
    res.cookie('session', token, {
      httpOnly: true,
      secure: REQUIRE_TLS,
      sameSite: 'strict',
      maxAge: 86400000, // 24h
    });
    logger.info('Login successful');
    res.json({ ok: true, username });
  } else {
    logger.warn('Login failed');
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies.session;
  if (token) sessions.destroy(token);
  res.clearCookie('session');
  res.json({ ok: true });
});

// Session check — lets the client verify if the session is still valid
app.get('/api/session', (req, res) => {
  const token = req.cookies.session;
  const session = token ? sessions.validate(token) : null;
  if (session) {
    res.json({ ok: true, username: session.username });
  } else {
    res.status(401).json({ ok: false });
  }
});

// ICE server configuration — returns STUN + TURN servers for WebRTC
// Supports Metered.ca dynamic credentials or static TURN credentials.
// Caches Metered response for 5 minutes to avoid hammering their API.
let meteredCache = { iceServers: null, expiresAt: 0 };

app.get('/api/ice-config', async (req, res) => {
  // Option A: Metered.ca — fetch temporary TURN credentials from their API
  if (METERED_APP_NAME && METERED_API_KEY) {
    const now = Date.now();
    if (meteredCache.iceServers && now < meteredCache.expiresAt) {
      return res.json({ iceServers: meteredCache.iceServers });
    }

    try {
      const url = `https://${METERED_APP_NAME}/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const servers = await resp.json();
        meteredCache = { iceServers: servers, expiresAt: now + 5 * 60 * 1000 };
        logger.info('ICE config: fetched TURN credentials from Metered');
        return res.json({ iceServers: servers });
      }
      logger.warn({ status: resp.status }, 'Metered API returned error');
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to fetch Metered TURN credentials');
    }
    // Fall through to static or STUN-only on error
  }

  // Option B: Static TURN credentials from env vars
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (TURN_URL && TURN_USERNAME && TURN_CREDENTIAL) {
    const turnUrls = TURN_URL.split(',').map(u => u.trim()).filter(Boolean);
    iceServers.push({
      urls: turnUrls,
      username: TURN_USERNAME,
      credential: TURN_CREDENTIAL,
    });
    logger.debug('ICE config: STUN + static TURN');
  } else {
    logger.debug('ICE config: STUN only (no TURN configured)');
  }

  res.json({ iceServers });
});

// Fix #1: Admin routes — require authentication
app.get('/admin/rooms', requireAuth, (req, res) => {
  res.json({ rooms: rooms.listRooms() });
});

// Integration test — verify streaming credentials without starting a stream
const integrationTestLimiter = rateLimit({ windowMs: 60000, max: 10, message: { error: 'Too many test attempts' } });

app.post('/api/integration-test', requireAuth, integrationTestLimiter, async (req, res) => {
  const { type, credentials } = req.body;
  if (!type || !credentials) {
    return res.status(400).json({ ok: false, error: 'Missing type or credentials' });
  }

  const validTypes = ['icecast', 'shoutcast', 'radio-co'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ ok: false, error: 'Invalid integration type' });
  }

  logger.info({ type }, 'Integration test requested');
  const result = await testConnection(type, credentials, logger);
  res.json(result);
});

// Deezer search proxy — avoids CORS issues with the Deezer API
app.get('/api/music-search', async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string' || query.length < 2) {
    return res.json({ data: [] });
  }
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=8`;
    const response = await fetch(url);
    const data = await response.json();
    // Return only the fields we need to keep payload small
    const results = (data.data || []).map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist?.name || '',
      album: t.album?.title || '',
      cover: t.album?.cover_small || '',
    }));
    res.json({ data: results });
  } catch (e) {
    logger.warn({ error: e.message }, 'Deezer search proxy error');
    res.json({ data: [] });
  }
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

// Fix #6: Set maxPayload to prevent memory exhaustion
// Signaling WSS — handles room/peer signaling
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 }); // 64KB max

// Integration stream WSS — handles MP3 relay to Icecast/Shoutcast/Radio.co
// Higher maxPayload to accommodate MP3 chunks
const integrationWss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

// Route WebSocket upgrades by URL path
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);

  if (pathname === '/integration-stream') {
    integrationWss.handleUpgrade(request, socket, head, (ws) => {
      integrationWss.emit('connection', ws, request);
    });
  } else {
    // Default: signaling WebSocket
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// WebSocket keep-alive — ping every 25s to prevent Fly.io proxy timeout (default ~60s)
const WS_PING_INTERVAL = 25000;
const pingInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, WS_PING_INTERVAL);
wss.on('close', () => clearInterval(pingInterval));

// WebSocket rate limiting
const wsJoinCounts = new Map();
const WS_JOIN_LIMIT = 20;
const WS_JOIN_WINDOW = 60000;

// Fix #9: Periodic cleanup of stale rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of wsJoinCounts) {
    const recent = timestamps.filter(t => now - t < WS_JOIN_WINDOW);
    if (recent.length === 0) {
      wsJoinCounts.delete(ip);
    } else {
      wsJoinCounts.set(ip, recent);
    }
  }
}, 5 * 60 * 1000);

/** Parse a cookie header string into a key-value map */
function parseCookies(header) {
  const map = {};
  if (!header) return map;
  header.split(';').forEach(pair => {
    const [key, ...rest] = pair.split('=');
    if (key) map[key.trim()] = rest.join('=').trim();
  });
  return map;
}

/** Validate SDP payload */
function isValidSdp(sdp) {
  return sdp && typeof sdp === 'object' && typeof sdp.sdp === 'string' && sdp.sdp.length <= 10000;
}

/** Validate ICE candidate payload */
function isValidCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  try { return JSON.stringify(candidate).length <= 2000; } catch { return false; }
}

/** Send current listener count to the broadcaster in a room */
function sendListenerCount(roomId) {
  const broadcaster = rooms.getBroadcaster(roomId);
  if (broadcaster) {
    const count = rooms.getReceiverIds(roomId).length;
    broadcaster.send(JSON.stringify({ type: 'listener-count', count }));
  }
}

wss.on('connection', (ws, req) => {
  // Fix #4: Use socket IP, not X-Forwarded-For (can't be spoofed)
  const ip = req.socket.remoteAddress || 'unknown';

  // Fix #5: Origin check — reject missing origin when checking is enabled
  if (ALLOWED_ORIGIN !== '*') {
    const origin = req.headers.origin;
    if (!origin || origin !== ALLOWED_ORIGIN) {
      logger.warn({ origin: origin || 'none', ip }, 'WebSocket rejected: origin mismatch');
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

  // Authenticate session from cookie (needed for broadcaster actions)
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies.session || null;
  const sessionData = sessionToken ? sessions.validate(sessionToken) : null;
  const isAuthed = !!sessionData;

  // Keep-alive: mark connection as alive on pong
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  let clientRoom = null;
  let clientRole = null;
  let clientReceiverId = null; // set when joining as receiver
  let lastChatTime = 0; // rate limit: 1 chat msg per second

  logger.info({ ip, authed: isAuthed }, 'WebSocket connected');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'create-room': {
        if (!isAuthed) {
          ws.send(JSON.stringify({ type: 'error', message: 'Authentication required', code: 'AUTH_REQUIRED' }));
          logger.warn({ ip }, 'Unauthenticated create-room attempt');
          break;
        }
        const roomId = rooms.create();
        clientRoom = roomId;
        clientRole = 'broadcaster';
        rooms.join(roomId, 'broadcaster', ws);
        ws.send(JSON.stringify({ type: 'room-created', roomId }));
        ws.send(JSON.stringify({ type: 'joined', roomId, role: 'broadcaster' }));
        ws.send(JSON.stringify({ type: 'listener-count', count: 0 }));
        logger.info({ roomId: roomId.slice(0, 8), ip }, 'Room created');
        break;
      }

      case 'join-room': {
        const { roomId, role } = msg;
        if (!roomId || !role) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing roomId or role', code: 'MISSING_PARAMS' }));
          break;
        }
        if (role === 'broadcaster' && !isAuthed) {
          ws.send(JSON.stringify({ type: 'error', message: 'Authentication required', code: 'AUTH_REQUIRED' }));
          logger.warn({ ip, roomId }, 'Unauthenticated broadcaster join attempt');
          break;
        }
        const result = rooms.join(roomId, role, ws);
        if (!result.ok) {
          ws.send(JSON.stringify({ type: 'error', message: result.error, code: result.code }));
          break;
        }
        clientRoom = roomId;
        clientRole = role;

        if (role === 'receiver') {
          clientReceiverId = result.receiverId;
          ws.send(JSON.stringify({ type: 'joined', roomId, role }));

          // Tell the broadcaster about this new receiver
          const broadcaster = rooms.getBroadcaster(roomId);
          if (broadcaster) {
            broadcaster.send(JSON.stringify({ type: 'peer-joined', role: 'receiver', receiverId: clientReceiverId }));
            ws.send(JSON.stringify({ type: 'peer-joined', role: 'broadcaster' }));
          }
          sendListenerCount(roomId);
          // Send current metadata to the new receiver
          const currentMeta = rooms.getMetadata(roomId);
          if (currentMeta) {
            ws.send(JSON.stringify({ type: 'metadata', text: currentMeta }));
          }
          // Send track list history
          const trackList = rooms.getTrackList(roomId);
          if (trackList.length > 0) {
            ws.send(JSON.stringify({ type: 'track-list', tracks: trackList }));
          }
        } else {
          // Broadcaster joining an existing room
          ws.send(JSON.stringify({ type: 'joined', roomId, role }));
          // Notify all existing receivers
          const receiverIds = rooms.getReceiverIds(roomId);
          for (const rid of receiverIds) {
            const rws = rooms.getReceiver(roomId, rid);
            if (rws) {
              rws.send(JSON.stringify({ type: 'peer-joined', role: 'broadcaster' }));
              ws.send(JSON.stringify({ type: 'peer-joined', role: 'receiver', receiverId: rid }));
            }
          }
        }

        logger.info({ roomId: roomId.slice(0, 8), role, ip }, 'Joined room');
        break;
      }

      case 'ready': {
        // Broadcaster signals ready — tell it about all existing receivers
        if (clientRoom && clientRole === 'broadcaster') {
          const receiverIds = rooms.getReceiverIds(clientRoom);
          for (const rid of receiverIds) {
            ws.send(JSON.stringify({ type: 'peer-joined', role: 'receiver', receiverId: rid }));
          }
        }
        break;
      }

      // Fix #8: Validate SDP before relay
      case 'offer': {
        if (!clientRoom || !isValidSdp(msg.sdp)) break;

        if (clientRole === 'broadcaster') {
          // Route to specific receiver
          const receiverId = msg.receiverId;
          if (!receiverId) break;
          const receiver = rooms.getReceiver(clientRoom, receiverId);
          if (receiver) {
            receiver.send(JSON.stringify({ type: 'offer', sdp: msg.sdp }));
            logger.info({ roomId: clientRoom.slice(0, 8), type: 'offer' }, 'Relayed SDP');
          }
        }
        break;
      }

      case 'answer': {
        if (!clientRoom || !isValidSdp(msg.sdp)) break;

        if (clientRole === 'receiver') {
          // Route to broadcaster, include receiverId
          const broadcaster = rooms.getBroadcaster(clientRoom);
          if (broadcaster) {
            broadcaster.send(JSON.stringify({ type: 'answer', sdp: msg.sdp, receiverId: clientReceiverId }));
            logger.info({ roomId: clientRoom.slice(0, 8), type: 'answer' }, 'Relayed SDP');
          }
        }
        break;
      }

      case 'candidate': {
        if (!clientRoom || !isValidCandidate(msg.candidate)) break;

        if (clientRole === 'broadcaster') {
          // Route to specific receiver
          const receiverId = msg.receiverId;
          if (!receiverId) break;
          const receiver = rooms.getReceiver(clientRoom, receiverId);
          if (receiver) {
            receiver.send(JSON.stringify({ type: 'candidate', candidate: msg.candidate }));
          }
        } else if (clientRole === 'receiver') {
          // Route to broadcaster, include receiverId
          const broadcaster = rooms.getBroadcaster(clientRoom);
          if (broadcaster) {
            broadcaster.send(JSON.stringify({ type: 'candidate', candidate: msg.candidate, receiverId: clientReceiverId }));
          }
        }
        break;
      }

      case 'leave': {
        if (clientRoom && clientRole) {
          if (clientRole === 'broadcaster') {
            const receiverIds = rooms.getReceiverIds(clientRoom);
            for (const rid of receiverIds) {
              const rws = rooms.getReceiver(clientRoom, rid);
              if (rws) rws.send(JSON.stringify({ type: 'peer-left', role: 'broadcaster' }));
            }
            rooms.leave(clientRoom, 'broadcaster');
          } else if (clientRole === 'receiver') {
            const broadcaster = rooms.getBroadcaster(clientRoom);
            if (broadcaster) {
              broadcaster.send(JSON.stringify({ type: 'peer-left', role: 'receiver', receiverId: clientReceiverId }));
            }
            rooms.leave(clientRoom, 'receiver', clientReceiverId);
            sendListenerCount(clientRoom);
          }
          logger.info({ roomId: clientRoom.slice(0, 8), role: clientRole }, 'Left room');
        }
        clientRoom = null;
        clientRole = null;
        clientReceiverId = null;
        break;
      }

      case 'stats': {
        if (clientRoom && clientRole) {
          rooms.logStats(clientRoom, clientRole, msg.data);
        }
        break;
      }

      case 'metadata': {
        if (!clientRoom || clientRole !== 'broadcaster') break;
        const metaText = typeof msg.text === 'string' ? msg.text.slice(0, 200) : '';
        const prevMeta = rooms.getMetadata(clientRoom);
        rooms.setMetadata(clientRoom, metaText);

        // Add to track list if the text changed and is non-empty
        if (metaText && metaText !== prevMeta) {
          rooms.addTrack(clientRoom, metaText);
          // Broadcast updated track list to all receivers
          const trackListMsg = JSON.stringify({ type: 'track-list', tracks: rooms.getTrackList(clientRoom) });
          const tlReceiverIds = rooms.getReceiverIds(clientRoom);
          for (const rid of tlReceiverIds) {
            const rws = rooms.getReceiver(clientRoom, rid);
            if (rws) rws.send(trackListMsg);
          }
          // Also send to broadcaster so they get the server timestamp
          ws.send(trackListMsg);
        }

        // Broadcast metadata to all receivers
        const metaMsg = JSON.stringify({ type: 'metadata', text: metaText });
        const metaReceiverIds = rooms.getReceiverIds(clientRoom);
        for (const rid of metaReceiverIds) {
          const rws = rooms.getReceiver(clientRoom, rid);
          if (rws) rws.send(metaMsg);
        }

        // Push metadata to integration stream if active
        if (metaText) {
          const integrationInfo = rooms.getIntegrationInfo(clientRoom);
          if (integrationInfo) {
            updateStreamMetadata(integrationInfo.type, integrationInfo.credentials, metaText, logger)
              .then((ok) => {
                if (ok) logger.debug({ roomId: clientRoom.slice(0, 8) }, 'Integration metadata updated');
              });
          }
        }
        break;
      }

      case 'chat': {
        if (!clientRoom) break;
        // Validate
        const chatText = msg.text;
        const chatName = msg.name;
        if (typeof chatText !== 'string' || chatText.length === 0 || chatText.length > 280) break;
        if (typeof chatName !== 'string' || chatName.length === 0 || chatName.length > 50) break;
        // Rate limit: 1 message per second per connection
        const chatNow = Date.now();
        if (chatNow - lastChatTime < 1000) break;
        lastChatTime = chatNow;

        const chatMsg = JSON.stringify({ type: 'chat', name: chatName, text: chatText });

        if (clientRole === 'receiver') {
          // Relay to broadcaster
          const broadcaster = rooms.getBroadcaster(clientRoom);
          if (broadcaster) broadcaster.send(chatMsg);
        } else if (clientRole === 'broadcaster') {
          // Broadcast to all receivers
          const receiverIds = rooms.getReceiverIds(clientRoom);
          for (const rid of receiverIds) {
            const rws = rooms.getReceiver(clientRoom, rid);
            if (rws) rws.send(chatMsg);
          }
        }
        break;
      }

      default:
        logger.debug({ type: msg.type }, 'Unknown message type');
    }
  });

  ws.on('close', (code, reason) => {
    if (clientRoom && clientRole) {
      if (clientRole === 'broadcaster') {
        const receiverIds = rooms.getReceiverIds(clientRoom);
        for (const rid of receiverIds) {
          const rws = rooms.getReceiver(clientRoom, rid);
          if (rws) rws.send(JSON.stringify({ type: 'peer-left', role: 'broadcaster' }));
        }
        rooms.leave(clientRoom, 'broadcaster');
      } else if (clientRole === 'receiver') {
        const broadcaster = rooms.getBroadcaster(clientRoom);
        if (broadcaster) {
          broadcaster.send(JSON.stringify({ type: 'peer-left', role: 'receiver', receiverId: clientReceiverId }));
        }
        rooms.leave(clientRoom, 'receiver', clientReceiverId);
        sendListenerCount(clientRoom);
      }
      logger.info({ roomId: clientRoom?.slice(0, 8), role: clientRole, code, reason: reason?.toString() }, 'Disconnected');
    }
  });

  ws.on('error', (err) => {
    logger.error({ ip, error: err.message }, 'WebSocket error');
  });
});

// ---------------------------------------------------------------------------
// Integration stream WebSocket — relays MP3 audio to external streaming servers
// ---------------------------------------------------------------------------
integrationWss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || 'unknown';

  // Authenticate via session cookie
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies.session || null;
  const sessionData = sessionToken ? sessions.validate(sessionToken) : null;

  if (!sessionData) {
    logger.warn({ ip }, 'Unauthenticated integration-stream attempt');
    ws.close(4001, 'Authentication required');
    return;
  }

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  let sourceSocket = null;
  let initialized = false;
  let integrationRoomId = null;

  logger.info({ ip }, 'Integration stream WebSocket connected');

  ws.on('message', async (raw, isBinary) => {
    // First message should be JSON with integration config
    if (!initialized) {
      try {
        const msg = JSON.parse(raw.toString());
        const { type, credentials, roomId: msgRoomId } = msg;

        if (!type || !credentials) {
          ws.send(JSON.stringify({ type: 'error', error: 'Missing type or credentials' }));
          ws.close();
          return;
        }

        logger.info({ type, ip }, 'Integration stream: connecting to server');

        try {
          sourceSocket = await connectToServer(type, credentials, logger);

          // Handle source socket errors/close
          sourceSocket.on('error', (err) => {
            logger.error({ error: err.message }, 'Integration source socket error');
            ws.send(JSON.stringify({ type: 'error', error: `Stream error: ${err.message}` }));
            ws.close();
          });
          sourceSocket.on('close', () => {
            logger.info('Integration source socket closed');
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'error', error: 'Stream server disconnected' }));
              ws.close();
            }
          });

          initialized = true;

          // Store integration info on the room for metadata updates
          if (msgRoomId) {
            integrationRoomId = msgRoomId;
            rooms.setIntegrationInfo(msgRoomId, { type, credentials });
          }

          ws.send(JSON.stringify({ type: 'connected' }));
          logger.info({ type, ip }, 'Integration stream: connected and relaying');
        } catch (err) {
          logger.warn({ type, error: err.message }, 'Integration stream: connection failed');
          ws.send(JSON.stringify({ type: 'error', error: err.message }));
          ws.close();
        }
      } catch {
        // Not JSON — ignore before initialization
        return;
      }
      return;
    }

    // After initialization, relay binary MP3 data to the source socket
    if (sourceSocket && !sourceSocket.destroyed) {
      try {
        const data = isBinary ? raw : Buffer.from(raw);
        sourceSocket.write(data);
      } catch (err) {
        logger.error({ error: err.message }, 'Failed to write to source socket');
      }
    }
  });

  ws.on('close', () => {
    if (sourceSocket && !sourceSocket.destroyed) {
      sourceSocket.destroy();
      sourceSocket = null;
    }
    if (integrationRoomId) {
      rooms.setIntegrationInfo(integrationRoomId, null);
    }
    logger.info({ ip }, 'Integration stream WebSocket closed');
  });

  ws.on('error', (err) => {
    logger.error({ ip, error: err.message }, 'Integration stream WebSocket error');
    if (sourceSocket && !sourceSocket.destroyed) {
      sourceSocket.destroy();
      sourceSocket = null;
    }
    if (integrationRoomId) {
      rooms.setIntegrationInfo(integrationRoomId, null);
    }
  });
});

server.listen(PORT, () => {
  logger.info({ port: PORT, origin: ALLOWED_ORIGIN, tls: REQUIRE_TLS }, 'Signaling server started');
});
