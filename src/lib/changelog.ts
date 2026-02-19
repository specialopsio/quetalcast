/**
 * Changelog entries — curated list of meaningful releases.
 * `items` = features / enhancements, `fixes` = bug fixes / minor improvements.
 */

export interface ChangelogEntry {
  date: string;
  version: string;
  items: string[];
  fixes?: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-02-19',
    version: '0.10.0',
    items: [
      'Stream relay now serves MP3 via server-side FFmpeg transcoding (WebM→MP3) with Icecast-compatible ICY headers for universal player support',
      'Pre-broadcast settings modal: set stream title, description, and custom URL before going on air — title and description persist in localStorage',
      'Silence keepalive: relay stream feeds silent MP3 frames for up to 10 minutes when the broadcaster disconnects so VLC/RadioDJ don\'t drop the connection',
      'Broadcast recovery: if the browser closes unexpectedly, reopening the page detects the previous broadcast and prompts to resume it',
      'Room slug history moved to server-side file persistence; slug picker shows live/available status indicators',
      'Stream title and description included in ICY headers (icy-name, icy-description) for media player display',
      'Changelog moved to dedicated /changelog page with version timeline and separate fixes section',
      'Version number displayed in footer',
    ],
    fixes: [
      'Server hardened for long-running streams: error-resilient IcyWriter with dead flag, FFmpeg stdin EPIPE handling, process lifecycle race condition fixes',
      'Graceful shutdown handler (SIGTERM/SIGINT) cleans up FFmpeg processes, relay listeners, and WebSocket connections on deploy',
      'X-Accel-Buffering: no header on stream endpoint for Nginx/Fly.io proxy compatibility',
      'Integration WebSocket connections now have ping keepalive to prevent proxy timeout on long streams',
      'FFmpeg probesize increased from 32 to 4096 bytes for reliable WebM header detection',
      'CORS middleware allows DELETE method for room slug management',
      'Silence keepalive runs for full 10-minute timeout regardless of stream URL listener count',
      'Room slug reclaim during silence keepalive window properly cleans up timers and relay listeners',
      'Room TTL expiry defensively cleans up FFmpeg processes and relay listeners',
      'Stream listener abrupt disconnects handled via error events on req and res',
      'relayHeader only stored in WebM fallback mode to prevent overwrite on broadcaster rejoin',
      'Headphones button matches mute/solo button size on mixer strips',
    ],
  },
  {
    date: '2026-02-16',
    version: '0.9.0',
    items: [
      'Built-in HTTP audio relay: every broadcast gets a /stream/:roomId URL for VLC, RadioDJ, and other media players',
      'Per-channel headphone monitor buttons on mixer strips — hear or silence any channel locally without affecting listeners',
      'Custom receive URLs with slug picker (e.g. /receive/elpasorocks) — lowercase letters, numbers, hyphens, 3–40 chars',
      'Receiver share links split into browser link and media player stream URL with copy button',
      'Sound pad persistence across page reloads; pad play events logged in event log',
    ],
    fixes: [
      'Relay uses signaling WebSocket for binary audio instead of a separate connection',
      'VLC stream: Safari mono handling, proper WebM init segment forwarding',
      'Fixed TDZ error with useRelayStream hook initialization order',
      'Fixed 500 error on /stream/:roomId caused by em dash in icy-name header',
      'Stream endpoint excluded from SPA catch-all route',
    ],
  },
  {
    date: '2026-02-13',
    version: '0.8.3',
    items: [],
    fixes: [
      'internet-radio.com (Centova Cast) streaming compatibility improvements',
    ],
  },
  {
    date: '2026-02-12',
    version: '0.8.2',
    items: [
      'Mixer strip redesign: channel strips with level sliders, mute, solo, pan knobs, and LED signal meters',
      'Physical fader-style slider thumb on mixer strips',
      'LED-style volume indicators on mixer strip labels',
      'Draggable pan knobs with visual feedback',
      'Broadcaster layout persistence: mixer strips, effects, sound pads, quality mode, and input device saved to localStorage',
      'Mixer strip order: Mic, Sound Pads, System Audio',
    ],
    fixes: [
      'Mono mic inputs normalized to dual-channel before mixer for correct stereo metering',
      'Mono left-only meter fixed with speaker-aware bus mixing',
      'Volume and pan readouts display correctly on mixer strips',
    ],
  },
  {
    date: '2026-02-12',
    version: '0.8.1',
    items: [
      'internet-radio.com (Centova Cast) setup notes in docs and README',
    ],
    fixes: [
      'Stereo analyser gracefully falls back to mono duplication on iOS',
      'Mobile layout: stats panel 2-column, receiver mirrors broadcast panel order',
      'Mono input level meter, mixer mobile layout, and stats unit display fixes',
      'Icons added to Sounds / Effects accordion in collapsed state',
    ],
  },
  {
    date: '2026-02-12',
    version: '0.8.0',
    items: [
      'System audio capture: route desktop or application audio into the broadcast via screen share',
      'Auto-identify songs via AcoustID/Chromaprint audio fingerprinting',
      'Chat history sent to new receivers on join; join/leave system messages with participant names',
      'Unread chat badge on FAB; browser tab title flashes on new messages',
      'Docs page replaces help modal with dedicated sections for Broadcaster, Integrations, and Receiver',
      'Community profile files: code of conduct, contributing guide, security policy, issue/PR templates',
      'Recording continues after broadcast ends; MP3 included in ZIP download',
      'Collapsible mixer controls and audio controls panels',
    ],
    fixes: [
      'Autocomplete dropdown no longer clipped by accordion overflow',
      'Chat join/leave messages only fire when someone actually sends their first message',
    ],
  },
  {
    date: '2026-02-11',
    version: '0.7.4',
    items: [
      'Track list with Deezer-powered search, album artwork, and rich metadata (album, year, ISRC, BPM, label, contributors)',
      'Track detail modal with full metadata on click',
      'CSV download for track list and event log (includes room ID)',
      'Now Playing metadata automatically pushed to external integration server admin API',
    ],
    fixes: [
      'Tracks only added on explicit commit (Enter or Deezer selection) instead of on blur',
      'Track times shown in user local timezone instead of server time',
      'Chat FAB shown on receiver as soon as room is joined',
    ],
  },
  {
    date: '2026-02-11',
    version: '0.7.3',
    items: [
      'Broadcaster integrations: stream to Icecast, Shoutcast, or Radio.co via server-side relay',
      'Configurable stream quality: bitrate (128/192/256/320 kbps) and channels (stereo/mono)',
      'Energy-efficient local MP3 recorder using AudioWorklet + Web Worker at 320 kbps',
      'Bidirectional live chat with name prompt, full-screen on mobile, floating panel on desktop',
      'Real-time listener count displayed in broadcaster Stats panel',
      'Now Playing stream metadata visible to all receivers in real time',
      'Keyboard shortcuts: Space (mute), R (record), L (listen), C (cue), 1–0 (sound pads), ? (help)',
      'Audio presets: save and recall effect profiles with 3 built-in presets (Podcast Voice, DJ Mode, Lo-Fi)',
      'Receiver auto-reconnect on connection drop with exponential backoff (up to 5 attempts)',
    ],
  },
  {
    date: '2026-02-11',
    version: '0.7.2',
    items: [
      'TURN server support: Metered.ca dynamic credentials or static TURN config',
      'WebSocket heartbeat (25s ping) to prevent proxy timeout',
      'Mic effects: Compressor with threshold, ratio, and gain controls',
      'Mic effects: Enhance with noise gate, rumble filter, and clarity boost',
      'Pitch shifter AudioWorklet for real-time voice modification',
      'HMAC-signed stateless session tokens replace in-memory sessions',
      'Open-source release: MIT license, KTAL-LP favicon and OpenGraph image',
      'VITE_DEBUG env variable to toggle frontend debug logging',
    ],
    fixes: [
      'CUE mode mutes WebRTC output instead of broadcast bus so mic monitoring works',
      'Effect parameters apply immediately on slider change (removed Save button)',
    ],
  },
  {
    date: '2026-02-11',
    version: '0.7.1',
    items: [
      'Audio quality presets: High (510 kbps stereo Opus CBR), Auto (adaptive), Low (32 kbps mono)',
      'Security hardening: authenticated WebSocket broadcaster actions, locked broadcaster slot',
      'Multi-receiver support: up to 4 concurrent listeners per room',
    ],
    fixes: [
      'Expired sessions handled gracefully after server restart',
      'Receiver meter fixed to show both channels correctly',
      'VU meter scale labels aligned and peak readout added',
    ],
  },
  {
    date: '2026-02-11',
    version: '0.7.0',
    items: [
      'Stereo VU meter with calibrated dBFS scale, separate L/R channels, and peak hold',
      'Output limiter with selectable ceiling (0, -3, -6, -12 dB) and brickwall clipper',
      'Broadcast elapsed timer',
      'Mic effects panel with tabbed Sounds / Effects UI',
    ],
  },
  {
    date: '2026-02-11',
    version: '0.6.1',
    items: [
      'Footer with SpecialOPS credit and Help modal',
      'Receiver retry link on errored connection page',
      'User-friendly off-air state replacing dev server message',
    ],
    fixes: [
      'Cue mode: mute entire broadcast output so receiver hears nothing',
      'Room IDs shortened to 7 characters',
      'Mobile zoom on input focus prevented',
      'Off-air message for errored connections and footer positioning',
      'User-facing text rewritten to be friendly and non-technical',
    ],
  },
  {
    date: '2026-02-10',
    version: '0.6.0',
    items: [
      'Initial release: WebRTC audio broadcasting from one broadcaster to listeners',
      'Soundboard: 5x2 pad grid with MP3 loading, loop toggle, per-pad volume (up to 300%), and broadcast mixing',
      'Mixer controls: mic volume, mute, listen, and cue mode',
      'Audio input device selector with custom shadcn Select',
      'Server-side auth with ADMIN_PASSWORD environment variable',
      'Fly.io deployment with multi-stage Dockerfile',
    ],
    fixes: [
      'Fixed Go On Air not working due to stale closure race condition',
      'Fixed receiver level meter not showing output',
    ],
  },
];
