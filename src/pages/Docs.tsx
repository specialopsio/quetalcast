import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Footer } from '@/components/Footer';

const DocSection = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24">
    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border flex items-center gap-2">
      {title}
    </h2>
    <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed [&_strong]:text-foreground">
      {children}
    </div>
  </section>
);

const DocSubsection = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24 mt-10">
    <h3 className="text-base font-semibold text-foreground mb-3">{title}</h3>
    <div className="space-y-3 text-sm text-muted-foreground leading-relaxed [&_strong]:text-foreground">
      {children}
    </div>
  </section>
);

const SIDEBAR_LINKS = [
  { id: 'broadcaster', label: 'Broadcaster' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'level-meter', label: 'Level Meter' },
  { id: 'going-on-air', label: 'Going On Air' },
  { id: 'mixer-controls', label: 'Mixer Controls' },
  { id: 'system-audio', label: 'System Audio' },
  { id: 'audio-quality', label: 'Audio Quality' },
  { id: 'soundboard', label: 'Soundboard' },
  { id: 'effects', label: 'Effects' },
  { id: 'live-chat', label: 'Live Chat' },
  { id: 'now-playing', label: 'Now Playing' },
  { id: 'track-list', label: 'Track List' },
  { id: 'recording', label: 'Recording' },
  { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts' },
  { id: 'audio-presets', label: 'Audio Presets' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'listener-count', label: 'Listener Count' },
  { id: 'ending-broadcast', label: 'Ending the Broadcast' },
  { id: 'receiver', label: 'Receiver' },
  { id: 'receiver-tuning', label: 'Tuning In' },
  { id: 'receiver-listening', label: 'Listening' },
  { id: 'receiver-audio-level', label: 'Audio Level' },
  { id: 'receiver-chat', label: 'Live Chat' },
  { id: 'receiver-now-playing', label: 'Now Playing' },
  { id: 'receiver-track-list', label: 'Track List' },
  { id: 'receiver-reconnect', label: 'Auto-Reconnect' },
  { id: 'receiver-broadcast-ends', label: 'When the Broadcast Ends' },
];

export default function Docs() {
  return (
    <div className="min-h-[100dvh] bg-background flex">
      {/* Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border p-4 sticky top-0 h-[100dvh] overflow-y-auto">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>
        <nav className="space-y-1">
          {SIDEBAR_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="block py-1.5 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-colors truncate"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto px-4 py-12 pb-24">
          <div className="flex items-center gap-3 mb-8">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">QueTal Cast Documentation</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                How to use every feature of the broadcast app
              </p>
            </div>
          </div>

          <DocSection id="broadcaster" title="Broadcaster">
            <p className="mb-6">
              The broadcaster view is where you control your stream. Sign in, select your mic,
              and go on air. Everything below describes the tools available while broadcasting.
            </p>

            <DocSubsection id="getting-started" title="Getting Started">
              <p>
                Sign in with your credentials. Once you're in, choose your microphone
                or audio interface from the dropdown at the top of the page.
              </p>
            </DocSubsection>

            <DocSubsection id="level-meter" title="Level Meter">
              <p>
                The level meter shows how loud your audio is in real time, with separate
                bars for left (L) and right (R). It goes from green (good) to yellow
                (getting loud) to red (too hot). If you see a <strong>CLIP</strong> warning,
                your audio is maxing out — turn it down a bit. Aim to keep things
                in the green, occasionally peaking into yellow.
              </p>
            </DocSubsection>

            <DocSubsection id="going-on-air" title="Going On Air">
              <p>
                Press <strong>Go On Air</strong> to start your broadcast. A timer shows how
                long you've been live. The room ID appears in the status bar while live. Use
                the <strong>Copy Receiver Link</strong> button in the top right to get a
                link you can share with anyone who wants to listen. Each new broadcast creates
                a new room; the room ID is hidden when you go off air.
              </p>
            </DocSubsection>

            <DocSubsection id="mixer-controls" title="Mixer Controls">
              <p>
                While on air, you'll see a collapsible <strong>Mixer Controls</strong> panel
                that you can expand or collapse by clicking the header. Inside you'll find:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
                <li><strong>Mic slider</strong> — Adjusts your microphone volume.</li>
                <li><strong>Mute</strong> — Instantly silence your mic without losing your volume setting.</li>
                <li><strong>Listen</strong> — Lets you hear what your listeners are hearing (off by default so you don't get feedback from your own speakers).</li>
                <li><strong>Cue</strong> — Preview mode. Nothing goes out to listeners — soundboard audio plays only for you, so you can test clips before playing them on air.</li>
                <li><strong>Limiter</strong> — Keeps your broadcast from getting too loud. The default (0 dB) only catches extreme peaks. Lower settings like -3, -6, or -12 dB will catch more, which is handy if you have loud soundboard clips or unpredictable audio.</li>
              </ul>
            </DocSubsection>

            <DocSubsection id="system-audio" title="System Audio">
              <p>
                Inside the mixer controls, click <strong>System Audio</strong> to route desktop
                or application audio into your broadcast. Your browser will ask you to choose a
                screen or window to share — make sure to check <strong>"Share audio"</strong> in
                the dialog. The video portion is discarded; only the audio is captured. Once
                active, a volume slider lets you control the system audio level independently
                from your mic. Click <strong>Stop System</strong> to disconnect, or use your
                browser's "Stop sharing" button.
              </p>
            </DocSubsection>

            <DocSubsection id="audio-quality" title="Audio Quality">
              <p>
                Below the audio input selector you'll find the quality setting. There are three options:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
                <li><strong>High</strong> — Sends the highest quality audio possible (510 kbps stereo). Best when you have a solid internet connection.</li>
                <li><strong>Auto</strong> — Starts at high quality and automatically adjusts if your connection gets shaky. It will drop to low bandwidth when needed and switch back to high once things stabilize. This is the default and recommended for most situations.</li>
                <li><strong>Low</strong> — Uses minimal bandwidth (32 kbps mono). Choose this if you're on a slow or unreliable connection and want to make sure the stream doesn't cut out.</li>
              </ul>
              <p className="mt-2">
                You can change this setting before or during a broadcast. When set to Auto, a
                label below the dropdown shows whether you're currently streaming in high quality
                or low bandwidth.
              </p>
            </DocSubsection>

            <DocSubsection id="soundboard" title="Soundboard">
              <p>
                The grid of pads below the controls is your soundboard. Tap an empty pad to load
                an audio file from your computer. Once loaded:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
                <li>Tap the pad to <strong>play</strong> or <strong>stop</strong> the clip.</li>
                <li>The <strong>loop icon</strong> (top right) repeats the clip continuously.</li>
                <li>The <strong>gear icon</strong> (bottom right) lets you rename the pad or boost its volume (up to 300% for quiet files).</li>
                <li>The <strong>X</strong> (top left) removes the clip from the pad.</li>
              </ul>
              <p className="mt-2">
                Everything on the soundboard is automatically mixed into your broadcast — listeners
                hear it alongside your mic. Use Cue mode to preview clips privately before playing
                them on air.
              </p>
            </DocSubsection>

            <DocSubsection id="effects" title="Effects">
              <p>
                Switch to the <strong>Effects</strong> tab (next to Sounds) to add real-time
                effects to your microphone. Tap an effect pad to turn it on or off — it glows
                when active.
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
                <li><strong>Enhance</strong> — Cleans up your mic with a noise gate (cuts background noise when you're not speaking), a rumble filter, and a clarity boost to help your voice cut through.</li>
                <li><strong>Reverb</strong> — Adds a room or hall-like ambience to your voice.</li>
                <li><strong>Voice Shift</strong> — Makes your voice sound deeper or brighter.</li>
                <li><strong>Delay</strong> — Creates repeating bounces of your voice, like a slapback or rhythmic echo.</li>
                <li><strong>Tone</strong> — A simple equalizer that lets you boost or cut bass, mids, and treble.</li>
                <li><strong>Compressor</strong> — Evens out your volume so quiet parts are louder and loud parts don't clip. Great for keeping a consistent level.</li>
              </ul>
              <p className="mt-2">
                Tap the <strong>gear icon</strong> on any effect to customize it with easy-to-understand
                sliders. Effects only apply to your mic — soundboard clips are not affected.
              </p>
            </DocSubsection>

            <DocSubsection id="live-chat" title="Live Chat">
              <p>
                When on air, a chat button appears in the bottom-right corner of the screen. Tap
                it to open the chat panel (full-screen on mobile, floating card on desktop).
                Listeners can send you messages and you can reply. The first time you open chat,
                you'll be asked for a display name (session-only — not saved). Messages are
                limited to 280 characters and rate-limited to 1 per second. Incoming chat
                messages also appear in the event log with a blue icon. An unread badge shows on
                the chat button when you have new messages while the panel is closed. When new
                messages arrive and the chat is closed or the tab is in the background, the
                browser tab title flashes until you view the chat. System messages show when
                others join or leave the chat (with their name).
              </p>
            </DocSubsection>

            <DocSubsection id="now-playing" title="Now Playing">
              <p>
                The <strong>Now Playing</strong> search at the top of the track list has built-in
                <strong> Deezer search</strong> — type an artist or song name for autocomplete
                results with album art. Select one to add to the track list, or type anything
                freeform. Metadata is sent to all listeners in real time. When using an
                integration (Icecast, Shoutcast, Radio.co), metadata is also pushed to the
                external server.
              </p>
            </DocSubsection>

            <DocSubsection id="track-list" title="Track List">
              <p>
                The track list appears above the soundboard, collapsible by clicking the header.
                The <strong>Now Playing</strong> search is at the top so you can add tracks
                quickly. Every track you add is shown chronologically; the current track is
                highlighted at the top with a spinning disc icon. Receivers who join mid-broadcast
                see the full history. Up to 100 tracks are stored per session. Click any track
                for a detail modal with full metadata. Download the track list as CSV (icon next
                to the count) — the file includes the room ID. Track additions appear in the
                event log; the event log also has a CSV download.
              </p>
            </DocSubsection>

            <DocSubsection id="recording" title="Recording">
              <p>
                Press the <strong>Record</strong> button in the mixer controls to capture your
                broadcast as a 320 kbps stereo MP3. A pulsing red dot shows when recording is
                active, along with elapsed time and file size. When you stop recording (or end
                the broadcast), the MP3 automatically downloads to your computer. Recording uses
                an energy-efficient AudioWorklet + Web Worker pipeline.
              </p>
            </DocSubsection>

            <DocSubsection id="keyboard-shortcuts" title="Keyboard Shortcuts">
              <p>
                While on air, use these keys for hands-free control (disabled when typing in
                text inputs):
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
                <li><strong>Space</strong> — Toggle mute</li>
                <li><strong>R</strong> — Toggle recording</li>
                <li><strong>L</strong> — Toggle listen</li>
                <li><strong>C</strong> — Toggle cue mode</li>
                <li><strong>1–9, 0</strong> — Trigger soundboard pads 1–10</li>
                <li><strong>?</strong> — Show/hide shortcuts reference</li>
              </ul>
              <p className="mt-2">
                Click the keyboard icon next to "Broadcaster" in the header to see the full
                shortcut reference.
              </p>
            </DocSubsection>

            <DocSubsection id="audio-presets" title="Audio Presets">
              <p>
                The <strong>Presets</strong> dropdown in the effects panel saves and recalls
                effect profiles. Three built-in presets are included:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
                <li><strong>Podcast Voice</strong> — Enhance + compressor, high quality</li>
                <li><strong>DJ Mode</strong> — Tone + compressor, high quality</li>
                <li><strong>Lo-Fi</strong> — Echo + voice shift + tone, low quality</li>
              </ul>
              <p className="mt-2">
                Select "Save Current…" to create your own presets (stored in localStorage).
                User presets can be deleted with the trash icon.
              </p>
            </DocSubsection>

            <DocSubsection id="integrations" title="Integrations">
              <p>
                Before going on air, click the <strong>Integrations</strong> button to connect
                to an external streaming platform (Icecast, Shoutcast, or Radio.co). Enter your
                server credentials and use the <strong>Test Connection</strong> button to
                verify. You can save credentials to localStorage with the "Remember" checkbox.
                When broadcasting with an integration, audio goes to the external platform, but
                a room is still created so listeners can access chat, track list, and now-playing
                metadata. Now Playing metadata is automatically forwarded to the external
                server's admin API so listeners on those platforms can see what's playing too.
              </p>
            </DocSubsection>

            <DocSubsection id="listener-count" title="Listener Count">
              <p>
                While on air, the Stats panel shows how many receivers are currently connected
                alongside speed, jitter, delay, and packet loss metrics.
              </p>
            </DocSubsection>

            <DocSubsection id="ending-broadcast" title="Ending the Broadcast">
              <p>
                Press <strong>End Broadcast</strong> when you're done. The room ID disappears
                from your status bar. Listeners will stop receiving audio, but the room link
                remains valid for 24 hours so they can still view the track list, event log, and
                chat. Your logs and track list are not cleared — they stay until you start a new
                broadcast. If you're recording, the MP3 will be saved automatically.
              </p>
              <p className="mt-2">
                When you start a <strong>new</strong> broadcast and you have previous logs or
                track list, a dialog appears letting you download both as a ZIP, copy the room
                link (for 24h access), or continue to start fresh. A new room ID is created for
                each broadcast.
              </p>
            </DocSubsection>
          </DocSection>

          <DocSection id="receiver" title="Receiver">
            <p className="mb-6">
              The receiver view is for listeners. Open the link shared by the broadcaster or paste
              a room ID to tune in.
            </p>

            <DocSubsection id="receiver-tuning" title="Tuning In">
              <p>
                Open the link shared by the broadcaster — it will take you straight to their
                broadcast. If you have a Room ID but no link, paste it into the field on the
                page and press <strong>Join</strong>.
              </p>
            </DocSubsection>

            <DocSubsection id="receiver-listening" title="Listening">
              <p>
                Once you're connected, you'll see a <strong>Tap to Listen</strong> button. Give
                it a tap and you'll start hearing the broadcast right away.
              </p>
            </DocSubsection>

            <DocSubsection id="receiver-audio-level" title="Audio Level">
              <p>
                While listening, a level meter shows how strong the incoming audio is on the left
                (L) and right (R) channels. If you see the meter moving but can't hear anything,
                check that your volume is turned up and your speakers or headphones are connected.
              </p>
            </DocSubsection>

            <DocSubsection id="receiver-chat" title="Live Chat">
              <p>
                Once listening, a chat button appears in the bottom-right corner of the screen.
                Tap it to open the chat panel (full-screen on mobile, floating card on desktop).
                When you join, you'll see the full chat history from the broadcast. The first
                time you open chat, you'll be asked for a display name. Send messages to the
                broadcaster and see their replies. Messages are limited to 280 characters, 1 per
                second. System messages show when others join or leave the chat (with their
                name). An unread badge shows on the button when you have new messages while the
                panel is closed. The browser tab title flashes when new messages arrive until you
                view the chat.
              </p>
            </DocSubsection>

            <DocSubsection id="receiver-now-playing" title="Now Playing">
              <p>
                If the broadcaster sets stream metadata, you'll see a "Now Playing" bar with a
                spinning disc icon showing the current track or show name. This updates in real
                time.
              </p>
            </DocSubsection>

            <DocSubsection id="receiver-track-list" title="Track List">
              <p>
                A collapsible track list shows every track played during the broadcast, with
                album artwork, duration, and release year. The current track is highlighted at
                the top. If you join mid-broadcast, you'll see the full history. After the
                broadcast ends, the room link stays valid for 24 hours — you can still view the
                track list and chat. Click any track for a detail modal. Download the track list
                as CSV (icon in the header); the file includes the room ID.
              </p>
            </DocSubsection>

            <DocSubsection id="receiver-reconnect" title="Auto-Reconnect">
              <p>
                If your connection drops during a broadcast, the app automatically tries to
                reconnect with increasing delays (1s, 2s, 4s, 8s, up to 15s) for up to 5 attempts.
                You'll see a "Reconnecting… (attempt X of 5)" message. If all attempts fail, a
                "Connection lost" message appears with a manual <strong>Try again</strong> button.
              </p>
            </DocSubsection>

            <DocSubsection id="receiver-broadcast-ends" title="When the Broadcast Ends">
              <p>
                If the broadcaster goes off air, you'll see a message letting you know. The room
                link remains valid for <strong>24 hours</strong> — you can still view the track
                list, event log, and chat, and post-broadcast chatter continues to work until the
                room expires. You can tap <strong>Retry this broadcast</strong> to try again, or
                paste a different Room ID to join another broadcast.
              </p>
            </DocSubsection>
          </DocSection>

          <Footer />
        </div>
      </main>
    </div>
  );
}
