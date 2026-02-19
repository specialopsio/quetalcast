/**
 * Changelog entries — curated list of meaningful releases.
 * Not every commit; only final solutions that stuck.
 */

export interface ChangelogEntry {
  date: string;
  version: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-02-19',
    version: '0.10.0',
    items: [
      'Stream URL now serves MP3 via server-side FFmpeg transcoding (WebM→MP3) with Icecast-compatible ICY headers',
      'Silence keepalive: relay stream stays alive for up to 10 minutes when broadcaster disconnects so VLC/RadioDJ don\'t drop',
      'Broadcast recovery: if the browser closes unexpectedly, reopening prompts to resume the previous stream',
      'Pre-broadcast settings modal with stream title, description, and custom URL picker',
      'Room slug history stored server-side with file persistence; dropdown shows live/available status',
      'Custom room IDs can be freely reused across broadcasts (blocked only while live)',
      'Hardened server for long-running stream durability: error-resilient relay writers, FFmpeg lifecycle safety, graceful shutdown, proxy buffering bypass, and defensive resource cleanup',
      'Changelog moved to dedicated /changelog page with version timeline',
      'Headphones button matches mute/solo button size on mixer strips',
      'Version number displayed in footer',
    ],
  },
  {
    date: '2026-02-16',
    version: '0.9.0',
    items: [
      'Built-in HTTP audio relay — every broadcast gets a VLC/RadioDJ stream URL',
      'Per-channel headphone monitor buttons on mixer strips',
      'Sound pad persistence and play logging',
      'Custom receive URLs with localStorage history',
      'Receiver share links clarified (browser vs media player)',
    ],
  },
  {
    date: '2026-02-12',
    version: '0.8.0',
    items: [
      'Mixer strip redesign: channel strips with level, mute, solo, pan, and LED meters',
      'Broadcaster layout persistence (volume, effects, sound pads, mixer state)',
      'Mono microphone handling and stereo meter fixes',
      'Docs page replaces help modal; community profile files (code of conduct, contributing)',
      'Chat history, join/leave messages, unread badge',
      'Auto-identify songs via AcoustID audio fingerprinting',
      'System audio capture in mixer controls',
      'Recording continues after broadcast ends; MP3 included in ZIP',
    ],
  },
  {
    date: '2026-02-11',
    version: '0.7.0',
    items: [
      'Track list with Deezer search, album artwork, and metadata',
      'Broadcaster integrations for streaming to external platforms',
      'Live chat, listener count, keyboard shortcuts',
      'Mic effects: Compressor and Enhance (noise gate, rumble filter, clarity)',
      'Audio quality presets (High, Auto, Low)',
      'Security: HMAC-signed stateless tokens, authentic broadcaster actions',
      'TURN server support, WebSocket heartbeat, auto-reconnect',
      'Pitch shifter, output limiter, stereo VU meter',
      'Broadcast timer, receiver retry link',
      'Footer with SpecialOPS credit, Help modal',
    ],
  },
  {
    date: '2026-02-10',
    version: '0.6.0',
    items: [
      'Mixer controls: mic volume, mute, listen, cue mode',
      'Soundboard with audio mixing into broadcast',
      'Server-side auth with ADMIN_PASSWORD',
      'Fly.io deployment',
    ],
  },
];
