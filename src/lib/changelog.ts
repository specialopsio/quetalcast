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
      'Room slug history stored server-side with file persistence; slug picker shows live/available status',
      'Custom room IDs can be freely reused across broadcasts (blocked only while another session with that slug is live)',
      'Stream title and description included in ICY headers (icy-name, icy-description) for media player display',
      'Changelog moved to dedicated /changelog page with version timeline and separate fixes section',
      'Version number displayed in footer',
    ],
    fixes: [
      'Server hardened for long-running stream durability: error-resilient IcyWriter with dead flag, FFmpeg stdin EPIPE handling, and process lifecycle race condition fixes',
      'Graceful shutdown handler (SIGTERM/SIGINT) cleans up FFmpeg processes, relay listeners, and WebSocket connections on deploy',
      'Added X-Accel-Buffering: no header on stream endpoint for Nginx/Fly.io proxy compatibility',
      'Integration WebSocket connections now have ping keepalive to prevent proxy timeout on long streams',
      'FFmpeg probesize increased from 32 to 4096 bytes for reliable WebM header detection without excessive latency',
      'CORS middleware now allows DELETE method for room slug management',
      'Silence keepalive runs for the full 10-minute timeout regardless of whether stream URL listeners are connected',
      'Room slug reclaim during silence keepalive window properly cleans up timers and relay listeners before deleting',
      'Room TTL expiry now defensively cleans up FFmpeg processes and relay listeners',
      'Stream listener abrupt disconnects handled via error events on both req and res',
      'relayHeader only stored in WebM fallback mode to avoid overwriting with non-init-segment data on broadcaster rejoin',
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
      'Receiver share links split into browser link and media player stream URL',
      'Stream URL shown on receiver page with copy button for RadioDJ/VLC',
      'Sound pad persistence and play logging in event log',
    ],
    fixes: [
      'VLC stream compatibility: Safari mono handling, proper WebM init segment forwarding',
      'Relay stream uses signaling WebSocket for binary audio data instead of a separate connection',
      'Fixed TDZ error with useRelayStream hook initialization order',
      'Fixed 500 error on /stream/:roomId caused by em dash in icy-name header',
      'Stream endpoint excluded from SPA catch-all route',
    ],
  },
  {
    date: '2026-02-12',
    version: '0.8.0',
    items: [
      'Mixer strip redesign: channel strips with level sliders, mute, solo, pan knobs, and LED signal meters',
      'Physical fader-style slider thumb on mixer strips',
      'LED-style volume indicators on mixer strip labels',
      'Draggable pan knobs with visual feedback',
      'Broadcaster layout persistence: mixer strips, effects, sound pads, quality mode, and input device saved to localStorage',
      'Docs page replaces help modal with dedicated sections for Broadcaster, Integrations, and Receiver',
      'Community profile files: code of conduct, contributing guide, security policy, issue/PR templates',
      'Chat history sent to new receivers on join; join/leave system messages with participant names',
      'Unread chat badge on FAB; browser tab title flashes on new messages',
      'Auto-identify songs via AcoustID/Chromaprint audio fingerprinting',
      'System audio capture: route desktop or application audio into the broadcast via screen share',
      'Collapsible mixer controls and audio controls panels',
      'Recording continues after broadcast ends; MP3 included in ZIP download',
      'Track detail modal with full metadata on click',
      'internet-radio.com (Centova Cast) setup notes in docs and README',
    ],
    fixes: [
      'Mono microphone inputs normalized to dual-channel before mixer for correct stereo metering',
      'Level meter fixed for mono left-only display using speaker-aware bus mixing',
      'Stereo analyser gracefully falls back to mono duplication on iOS',
      'Mobile layout: stats panel 2-column on mobile, receiver mirrors broadcast panel order',
      'Track list and autocomplete dropdown no longer clipped by accordion overflow',
      'Volume and pan readouts display correctly on mixer strips',
      'Mixer strip order: Mic, Sound Pads, System Audio',
      'Icons added to Sounds / Effects accordion in collapsed state',
    ],
  },
  {
    date: '2026-02-11',
    version: '0.7.0',
    items: [
      'Track list with Deezer-powered search, album artwork, and rich metadata',
      'CSV download for track list and event log (includes room ID)',
      'Now Playing metadata with Deezer autocomplete — visible to all receivers in real time',
      'Broadcaster integrations: stream to Icecast, Shoutcast, or Radio.co via server-side relay',
      'Configurable stream quality: bitrate (128/192/256/320 kbps) and channels (stereo/mono)',
      'Now Playing metadata automatically pushed to external server admin API',
      'Live chat via floating action button with name prompt, full-screen on mobile',
      'Real-time listener count displayed in broadcaster Event Log header',
      'Audio quality presets: High (510 kbps stereo Opus), Auto (adaptive), Low (32 kbps mono)',
      'Keyboard shortcuts: Space (mute), R (record), L (listen), C (cue), 1–0 (sound pads), ? (help)',
      'Audio presets: save and recall effect profiles with 3 built-in presets (Podcast Voice, DJ Mode, Lo-Fi)',
      'Mic effects: Enhance (noise gate, rumble filter, clarity boost), Compressor',
      'Pitch shifter worklet for real-time voice modification',
      'Output limiter with selectable ceiling (0, -3, -6, -12 dB) and brickwall clipper',
      'Stereo VU meter with calibrated dBFS scale, separate L/R channels, and peak readout',
      'Broadcast elapsed timer',
      'Auto-reconnect for receivers on connection drop with exponential backoff (up to 5 attempts)',
      'TURN server support: Metered.ca dynamic credentials or static TURN config',
      'WebSocket heartbeat (25s ping) to prevent proxy timeout',
      'Energy-efficient local MP3 recorder using AudioWorklet + Web Worker at 320 kbps',
      'Security: HMAC-signed stateless session tokens, authenticated broadcaster WebSocket actions, locked broadcaster slot',
      'Multi-receiver support: up to 4 concurrent listeners per room',
    ],
    fixes: [
      'Receiver meter fixed to show both channels correctly',
      'CUE mode mutes WebRTC output instead of the broadcast bus so mic monitoring works',
      'VU meter scale labels aligned and peak readout added',
      'Expired sessions handled gracefully after server restart',
      'Effects grid changed to 4x1 layout; Echo renamed to Reverb throughout',
      'Receiver retry link on errored connection page',
      'Mobile zoom on input focus prevented',
      'Footer with SpecialOPS credit and Help modal',
      'Room IDs shortened to 7 characters',
    ],
  },
  {
    date: '2026-02-10',
    version: '0.6.0',
    items: [
      'Initial release: WebRTC audio broadcasting from one broadcaster to listeners',
      'Soundboard: 5x2 pad grid with MP3 loading, loop toggle, per-pad volume (up to 300%), and broadcast mixing',
      'Mixer controls: mic volume, mute, listen, and cue mode',
      'Server-side auth with ADMIN_PASSWORD environment variable',
      'Fly.io deployment with multi-stage Dockerfile',
      'Audio input device selector with custom shadcn Select',
    ],
    fixes: [
      'Fixed Go On Air not working due to stale closure race condition',
      'Fixed receiver level meter not showing output',
    ],
  },
];
