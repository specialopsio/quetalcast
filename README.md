# QueTal Cast

Real-time audio broadcasting application built with WebRTC, React, and Node.js. Designed for low-latency, high-quality audio streaming from a single broadcaster to multiple listeners.

## Features

- **High-fidelity audio** — Opus codec at up to 510 kbps stereo with adaptive quality (High / Auto / Low)
- **Sounds** — 5x2 pad grid with MP3 loading, loop toggle, per-pad volume (up to 300%), and broadcast mixing
- **Mic effects** — Enhance (noise gate, rumble filter, clarity boost), tone/EQ, compressor, pitch shift, delay, and reverb with per-effect settings
- **Audio presets** — Save and recall effect profiles (effects only, not mixer). In effects panel. 3 built-in presets (Podcast Voice, DJ Mode, Lo-Fi) plus unlimited custom presets stored in localStorage
- **Stereo VU meter** — Calibrated dBFS metering with peak hold. At top of page; works as soon as you select a mic (preview stream) so you can level-check before going live
- **Output limiter** — Selectable ceiling (0 dB, -3 dB, -6 dB, -12 dB)
- **Broadcast timer** — Elapsed time display while on air
- **Mixer controls** — Collapsible panel with audio input selector, mic volume, mute, listen mode, cue mode, and system audio routing. Visible pre-broadcast so you can dial in before going live
- **System audio** — Route desktop or application audio into the broadcast via screen share audio capture, with independent volume control. Connect before going on air to set levels and prep the mix
- **Live chat** — Bidirectional chat via floating action button (full-screen on mobile, floating panel on desktop). Users provide a display name before chatting. Chat history is sent to new receivers on join. Join/leave system messages appear when someone joins or leaves the chat (with their name). Unread badge on FAB when chat is closed; browser tab title flashes when new messages arrive until viewed. Rate-limited to 1 message per second, max 280 characters
- **Listener count** — Real-time count of connected listeners displayed in the Stats panel during broadcast
- **Now playing** — Broadcaster sets stream metadata with Deezer-powered autocomplete (artist + song search with album art). Visible to all listeners in real time. Metadata is also forwarded to external integration streams (Icecast/Shoutcast)
- **Track list** — Chronological history of every track played. Always visible (collapsible). Now Playing search at top when on air. New receivers get full history on join. CSV download (icon next to title) includes room ID. Event log also has CSV download next to title
<!-- Auto-identify (temporarily disabled): Automatic song identification using AcoustID/Chromaprint. Ear icon toggle during broadcast. Code remains in useAutoIdentify.ts and audio-identify.js for future re-enable. -->
- **Local recording** — Record your broadcast as a 320 kbps stereo MP3, auto-downloaded when you stop. Start recording before going on air to capture from the moment you hit record. If you end the broadcast while recording, recording continues until you stop it or click Download ZIP in the modal. Recording also continues when you start a new broadcast — use the Record button or Download ZIP to stop and save. Uses AudioWorklet + Web Worker for energy-efficient encoding
- **Keyboard shortcuts** — Space (mute), R (record), L (listen), C (cue), 1–0 (sound pads), ? (help). Active while on air, disabled when typing in inputs
- **Integrations** — Stream to external platforms (Icecast, Shoutcast, Radio.co) via server-side relay. Test connection, remember credentials in localStorage. Room is still created for chat and metadata. Now Playing metadata is automatically pushed to the external server's admin API. For internet-radio.com (Centova Cast), use mount point `/stream` and stop AutoDJ before going live if needed — see docs for details
- **Multi-receiver** — Up to 4 concurrent listeners per room
- **TURN relay** — Dynamic credential fetching via Metered.ca (or static config)
- **Auto-reconnect** — Receivers automatically reconnect on connection drops with exponential backoff (up to 5 attempts). Manual retry available after max attempts
- **Room persistence** — When a broadcast ends, the room ID in the broadcaster status bar is hidden and a new room is created when starting a new broadcast. The previous room remains visible on the receiver page for 24 hours post-broadcast to show events, track list, and chat. CSV exports (event log and track list) include the room ID for reference
- **Post-broadcast flow** — Logs, track list, and chat are not purged until a new broadcast is started. When starting a new broadcast with existing data, a dialog offers to download logs and track list as a ZIP (including MP3 if recording was active), copy the room link (24h access), continue the previous broadcast (rejoin same room, keep logs and track list), or start a new broadcast

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
Microphone ─► Mic Effects ─► Gain ──┐
                                    ├─► Broadcast Bus (stereo) ─► Limiter ─► WebRTC
Sound Pads ─► Gain ────────────────┤                             └─► VU Meter
System Audio ─► Gain ──────────────┘
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
2. Expand **Mixer Controls** and select your audio input device — the level meter at top shows input immediately so you can dial in
3. Click **Go On Air** — a room ID is generated and appended to the URL (`?room=...`)
4. Share the receiver link (Copy Receiver Link); listeners open it and click **Join**

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
| `ACOUSTID_API_KEY` | — | AcoustID API key for auto song identification ([get one free](https://acoustid.org/new-application)). *Optional — auto-identify is temporarily disabled.* |
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
│   │   ├── ChatPanel.tsx       # Floating chat FAB + full-screen mobile overlay
│   │   ├── EffectsBoard.tsx    # Mic effects UI (enhance, tone, compressor, pitch, delay, reverb)
│   │   ├── IntegrationsSheet.tsx # External streaming platform config
│   │   ├── NowPlayingInput.tsx # Deezer autocomplete for now-playing metadata
│   │   ├── TrackList.tsx       # Chronological track history display
│   │   ├── SoundBoard.tsx      # 5x2 sound pad grid
│   │   ├── LevelMeter.tsx      # Stereo VU meter with dBFS scale
│   │   ├── StatusBar.tsx       # Room ID, timer, connection status
│   │   ├── HealthPanel.tsx     # RTT, packet loss, jitter display
│   │   ├── EventLog.tsx        # Connection event timeline with chat + CSV export
│   │   ├── Footer.tsx          # Credits and help modal
│   │   └── ui/                 # shadcn/ui primitives
│   ├── hooks/
│   │   ├── useSignaling.ts     # WebSocket signaling with auto-reconnect
│   │   ├── useWebRTC.ts        # WebRTC peer connections + adaptive quality + auto-reconnect
│   │   ├── useAudioMixer.ts    # Web Audio API mixing graph
│   │   ├── useAudioAnalyser.ts # Audio level analysis
│   │   ├── useIntegrationStream.ts # MP3 encoding + WebSocket relay for integrations
│   │   ├── useAutoIdentify.ts  # AcoustID-based auto song identification (temporarily disabled in UI)
│   │   ├── useKeyboardShortcuts.ts # Keyboard shortcut bindings for broadcaster
│   │   ├── useMicEffects.ts    # Mic effect chain (enhance, compressor, pitch shift worklets)
│   │   └── useRecorder.ts      # AudioWorklet + Web Worker MP3 recording
│   ├── lib/
│   │   ├── auth.ts             # Client-side session management
│   │   ├── debug.ts            # VITE_DEBUG-gated console logging
│   │   ├── integrations.ts     # Integration platform registry + localStorage config
│   │   ├── presets.ts          # Audio preset definitions + localStorage management
│   │   ├── webrtc-stats.ts     # Stats parsing utilities
│   │   └── zip-export.ts       # ZIP export of event log + track list
│   └── pages/
│       ├── Login.tsx           # Broadcaster authentication
│       ├── Broadcaster.tsx     # Main broadcast control page
│       ├── Receiver.tsx        # Listener page
│       └── Admin.tsx           # Room management dashboard
├── server/                     # Node.js signaling server
│   ├── index.js                # Express + WebSocket + ICE config + chat/metadata relay + Deezer proxy
│   ├── audio-identify.js       # Chromaprint fingerprinting + AcoustID lookup
│   ├── integration-relay.js    # TCP source client + metadata updater for Icecast/Shoutcast
│   ├── room-manager.js         # Multi-receiver room management with metadata + track list
│   ├── auth.js                 # Session management with expiry
│   └── logger.js               # Pino JSON logging
├── public/
│   ├── lame.min.js             # lamejs library for Web Worker MP3 encoding
│   ├── mp3-encoder-worker.js   # Web Worker for 320 kbps MP3 encoding
│   ├── recorder-processor.js   # AudioWorklet for energy-efficient PCM capture
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
