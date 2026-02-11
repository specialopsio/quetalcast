# QueTal Cast

Real-time audio broadcasting application built with WebRTC, React, and Node.js. Designed for low-latency, high-quality audio streaming from a single broadcaster to multiple listeners.

## Features

- **High-fidelity audio** — Opus codec at up to 510 kbps stereo with adaptive quality (High / Auto / Low)
- **Soundboard** — 5x2 pad grid with MP3 loading, loop toggle, per-pad volume (up to 300%), and broadcast mixing
- **Mic effects** — Enhance (noise gate, rumble filter, clarity boost), tone/EQ, compressor, pitch shift, delay, and reverb with per-effect settings
- **Stereo VU meter** — Calibrated dBFS metering with peak hold
- **Output limiter** — Selectable ceiling (0 dB, -3 dB, -6 dB, -12 dB)
- **Broadcast timer** — Elapsed time display while on air
- **Mixer controls** — Mic volume, mute, listen mode, and cue mode
- **Multi-receiver** — Up to 4 concurrent listeners per room
- **TURN relay** — Dynamic credential fetching via Metered.ca (or static config)
- **Auto-reconnect** — WebSocket reconnection with exponential backoff

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌──────────────┐
│  Broadcaster │ ◄────────────────► │   Signaling  │ ◄────────────────► │  Receiver(s) │
│   (React)    │                    │   Server     │                    │   (React)    │
└──────┬───────┘                    │  (Node.js)   │                    └──────┬───────┘
       │                            └──────┬───────┘                           │
       │                                   │                                   │
       │        WebRTC (Peer-to-Peer)      │    TURN relay (when needed)       │
       └───────────────────────────────────┼───────────────────────────────────┘
                                           │
                                    ┌──────┴───────┐
                                    │  TURN Server │
                                    │  (Metered)   │
                                    └──────────────┘
```

**Broadcaster audio graph (Web Audio API):**

```
Microphone ─► Mic Effects ─► Gain ─┐
                                   ├─► Broadcast Bus (stereo) ─► Limiter ─► WebRTC
Soundboard Pads ─► Gain ──────────┘                            └─► VU Meter
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)

### 1. Clone and install

```bash
git clone https://github.com/specialopsio/quetalcast.git
cd quetalcast

# Install frontend dependencies
pnpm install

# Install server dependencies
cd server && pnpm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set ADMIN_PASSWORD and SESSION_SECRET
```

### 3. Run locally

```bash
# Terminal 1 — signaling server
cd server
pnpm run dev

# Terminal 2 — frontend
pnpm run dev
```

- Frontend: `http://localhost:5173`
- Server: `http://localhost:3001`

### 4. Use the app

1. Open `http://localhost:5173` and log in with your configured password
2. Select an audio input device
3. Click **Go On Air** — a room ID is generated and copied
4. Share the receiver link; listeners open it and click **Join**

## Deployment (Fly.io)

The project includes a multi-stage `Dockerfile` and `fly.toml` for [Fly.io](https://fly.io) deployment.

```bash
# Install Fly CLI: https://fly.io/docs/getting-started/installing-flyctl/
fly launch

# Set secrets
fly secrets set SESSION_SECRET="your-random-secret"
fly secrets set ADMIN_PASSWORD="your-password"
fly secrets set METERED_APP_NAME="yourapp.metered.live"
fly secrets set METERED_API_KEY="your-metered-api-key"

# Deploy
fly deploy
```

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server listen port |
| `ALLOWED_ORIGIN` | `*` | CORS origin (set to your domain in production) |
| `REQUIRE_TLS` | `false` | Require HTTPS for cookies |
| `SESSION_SECRET` | `dev-secret...` | Session cookie signing secret |
| `ADMIN_PASSWORD` | `admin` | Broadcaster login password |
| `METERED_APP_NAME` | — | Metered.ca app name for dynamic TURN credentials |
| `METERED_API_KEY` | — | Metered.ca API key |
| `TURN_URL` | — | Static TURN server URL (alternative to Metered) |
| `TURN_USERNAME` | — | Static TURN username |
| `TURN_CREDENTIAL` | — | Static TURN credential |
| `LOG_DIR` | `server/logs` | Log file directory |
| `LOG_LEVEL` | `info` | Log level (error, warn, info, debug) |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_WS_URL` | auto-detected | WebSocket signaling URL |
| `VITE_DEBUG` | `false` | Enable verbose debug logging in browser console |

## Project Structure

```
├── src/                        # React frontend (Vite + TypeScript)
│   ├── components/
│   │   ├── EffectsBoard.tsx    # Mic effects UI (enhance, tone, compressor, pitch, delay, reverb)
│   │   ├── SoundBoard.tsx      # 5x2 soundboard pad grid
│   │   ├── LevelMeter.tsx      # Stereo VU meter with dBFS scale
│   │   ├── StatusBar.tsx       # Room ID, timer, connection status
│   │   ├── HealthPanel.tsx     # RTT, packet loss, jitter display
│   │   ├── EventLog.tsx        # Connection event timeline
│   │   ├── Footer.tsx          # Credits and help modal
│   │   └── ui/                 # shadcn/ui primitives
│   ├── hooks/
│   │   ├── useSignaling.ts     # WebSocket signaling with auto-reconnect
│   │   ├── useWebRTC.ts        # WebRTC peer connections + adaptive quality
│   │   ├── useAudioMixer.ts    # Web Audio API mixing graph
│   │   ├── useAudioAnalyser.ts # Audio level analysis
│   │   └── useMicEffects.ts    # Mic effect chain (enhance, compressor, pitch shift worklets)
│   ├── lib/
│   │   ├── auth.ts             # Client-side session management
│   │   ├── debug.ts            # VITE_DEBUG-gated console logging
│   │   └── webrtc-stats.ts     # Stats parsing utilities
│   └── pages/
│       ├── Login.tsx           # Broadcaster authentication
│       ├── Broadcaster.tsx     # Main broadcast control page
│       ├── Receiver.tsx        # Listener page
│       └── Admin.tsx           # Room management dashboard
├── server/                     # Node.js signaling server
│   ├── index.js                # Express + WebSocket + ICE config endpoint
│   ├── room-manager.js         # Multi-receiver room management
│   ├── auth.js                 # Session management with expiry
│   └── logger.js               # Pino JSON logging
├── public/
│   ├── pitch-shift-processor.js  # AudioWorklet for real-time pitch shifting
│   └── noise-gate-processor.js   # AudioWorklet for noise gate (Enhance effect)
├── Dockerfile                  # Multi-stage production build
├── fly.toml                    # Fly.io deployment config
└── docker-compose.yml          # Local Docker setup
```

## Security

- **Session auth** — HTTP-only cookies with configurable secret and server-side expiry
- **WebSocket auth** — Broadcaster connections require valid session; receiver connections are open
- **Rate limiting** — WebSocket message throttling to prevent abuse
- **Payload limits** — Maximum WebSocket message size enforced
- **CORS** — Configurable allowed origin
- **SDP/ICE validation** — Relayed WebRTC data is validated before forwarding
- **HTTPS** — Required for `getUserMedia` in production; use a reverse proxy (Caddy, nginx) or Fly.io for TLS

## TURN Server

WebRTC peer-to-peer connections can fail behind restrictive NATs or firewalls. A TURN relay server solves this.

**Recommended: [Metered.ca](https://www.metered.ca/)** — Set `METERED_APP_NAME` and `METERED_API_KEY` and the server will dynamically fetch temporary TURN credentials.

**Alternative:** Set `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL` for a static TURN server.

If no TURN configuration is provided, the app falls back to STUN-only (Google STUN servers).

## License

[MIT](LICENSE) — built by [SpecialOPS](https://specialops.io)
