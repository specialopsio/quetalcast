# WebRTC Audio Bridge

Self-hosted, peer-to-peer WebRTC audio bridge with minimal signaling server. One broadcaster, one receiver, audio only.

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌──────────────┐
│  Broadcaster │ ◄──────────────►  │   Signaling  │ ◄──────────────►  │   Receiver   │
│   (Browser)  │                    │   Server     │                    │   (Browser)  │
└──────┬───────┘                    │  (Node.js)   │                    └──────┬───────┘
       │                            └──────────────┘                           │
       │              WebRTC (Peer-to-Peer Audio via Opus)                     │
       └───────────────────────────────────────────────────────────────────────┘
```

## Quick Start (Local Dev)

### 1. Start the signaling server

```bash
cd server
npm install
npm run dev
```

Server runs on `http://localhost:3001`.

### 2. Start the frontend

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` (Vite default).

### 3. Use the app

1. Open `http://localhost:5173` → Login with `admin` / `admin`
2. Select audio input device on the Broadcaster page
3. Click **Go On Air** → copies a receiver link
4. Open receiver link in another tab/browser → click **Join** → **Click to Listen**

## Docker Deployment

```bash
# Build and run signaling server
docker compose up -d signaling

# With TURN server (uncomment in docker-compose.yml first)
docker compose up -d

# Production with Caddy (TLS)
# 1. Create Caddyfile (see below)
# 2. Uncomment caddy service in docker-compose.yml
docker compose up -d
```

### Example Caddyfile

```
your-domain.com {
    reverse_proxy signaling:3001
}
```

### Example turnserver.conf

```
listening-port=3478
tls-listening-port=5349
realm=your-domain.com
server-name=your-domain.com
fingerprint
lt-cred-mech
user=turnuser:turnpassword
total-quota=100
stale-nonce=600
no-multicast-peers
```

When using TURN, update the ICE config in `src/hooks/useWebRTC.ts`:

```typescript
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:your-domain.com:3478', username: 'turnuser', credential: 'turnpassword' },
  ],
};
```

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `ALLOWED_ORIGIN` | `*` | CORS origin (set to your domain in prod) |
| `REQUIRE_TLS` | `false` | Reject non-HTTPS requests |
| `SESSION_SECRET` | `dev-secret...` | Session signing secret |
| `LOG_DIR` | `./logs` | Log file directory |
| `LOG_LEVEL` | `info` | Pino log level |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_WS_URL` | `ws://localhost:3001` | WebSocket signaling URL |

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # StatusBar, LevelMeter, HealthPanel, EventLog
│   ├── hooks/              # useSignaling, useWebRTC, useAudioAnalyser
│   ├── lib/                # auth, webrtc-stats
│   └── pages/              # Login, Broadcaster, Receiver, Admin
├── server/                 # Node.js signaling server
│   ├── index.js            # Express + WebSocket server
│   ├── room-manager.js     # Room lifecycle management
│   ├── logger.js           # Pino JSON logging
│   ├── auth.js             # Session management
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Logs

Server logs → `server/logs/`:
- `server.log` — room lifecycle, relay events, errors
- `stats-YYYY-MM-DD.jsonl` — client stats summaries (every 5s)

## Security Notes

- **MVP auth**: Hardcoded `admin/admin`. Replace for production.
- **HTTPS**: Required for `getUserMedia` in production. Use Caddy/nginx for TLS.
- **Origin checks**: Set `ALLOWED_ORIGIN` to your domain in production.
- **Cookies**: `httpOnly`, `secure` (TLS), `sameSite: strict`.
- **No SDP in logs**: Only sizes, counts, and state changes logged.

## License

MIT
