import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function Footer() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <footer className="py-4 px-4 text-center text-xs text-muted-foreground/60 flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <span>
            Built by{' '}
            <a
              href="https://specialops.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
            >
              SpecialOPS
            </a>
          </span>
          <span className="text-muted-foreground/30">|</span>
          <button
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
          >
            <HelpCircle className="h-3 w-3" />
            Help
          </button>
        </div>
        <a
          href="https://github.com/specialopsio/quetalcast"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground/40 hover:text-foreground hover:underline underline-offset-2 transition-colors"
        >
          We 🤍 Open Source
        </a>
      </footer>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How to Use QueTal Cast</DialogTitle>
            <DialogDescription>
              Choose a section below to learn how everything works.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="broadcaster" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="broadcaster" className="flex-1">Broadcaster</TabsTrigger>
              <TabsTrigger value="receiver" className="flex-1">Receiver</TabsTrigger>
            </TabsList>

            <TabsContent value="broadcaster" className="space-y-4 text-sm text-muted-foreground leading-relaxed mt-4">
              <section>
                <h3 className="text-foreground font-semibold mb-1">Getting Started</h3>
                <p>
                  Sign in with your credentials. Once you're in, choose your microphone
                  or audio interface from the dropdown at the top of the page.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Level Meter</h3>
                <p>
                  The level meter shows how loud your audio is in real time, with separate
                  bars for left (L) and right (R). It goes from green (good) to yellow
                  (getting loud) to red (too hot). If you see a <strong className="text-foreground">CLIP</strong> warning,
                  your audio is maxing out — turn it down a bit. Aim to keep things
                  in the green, occasionally peaking into yellow.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Going On Air</h3>
                <p>
                  Press <strong className="text-foreground">Go On Air</strong> to start
                  your broadcast. A timer shows how long you've been live. Use the
                  <strong className="text-foreground"> Copy Receiver Link</strong> button in the
                  top right to get a link you can share with anyone who wants to listen.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Mixer Controls</h3>
                <p>
                  While on air, you'll see a collapsible <strong className="text-foreground">Mixer Controls</strong> panel
                  that you can expand or collapse by clicking the header. Inside you'll find:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 pl-1">
                  <li>
                    <strong className="text-foreground">Mic slider</strong> — Adjusts
                    your microphone volume.
                  </li>
                  <li>
                    <strong className="text-foreground">Mute</strong> — Instantly silence
                    your mic without losing your volume setting.
                  </li>
                  <li>
                    <strong className="text-foreground">Listen</strong> — Lets you hear
                    what your listeners are hearing (off by default so you don't get
                    feedback from your own speakers).
                  </li>
                  <li>
                    <strong className="text-foreground">Cue</strong> — Preview mode.
                    Nothing goes out to listeners — soundboard audio plays only for
                    you, so you can test clips before playing them on air.
                  </li>
                  <li>
                    <strong className="text-foreground">Limiter</strong> — Keeps your
                    broadcast from getting too loud. The default (0 dB) only catches
                    extreme peaks. Lower settings like -3, -6, or -12 dB will
                    catch more, which is handy if you have loud soundboard clips
                    or unpredictable audio.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">System Audio</h3>
                <p>
                  Inside the mixer controls, click <strong className="text-foreground">System Audio</strong> to
                  route desktop or application audio into your broadcast. Your browser will
                  ask you to choose a screen or window to share — make sure to check
                  <strong className="text-foreground"> "Share audio"</strong> in the dialog.
                  The video portion is discarded; only the audio is captured. Once active, a
                  volume slider lets you control the system audio level independently from
                  your mic. Click <strong className="text-foreground">Stop System</strong> to
                  disconnect, or use your browser's "Stop sharing" button.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Audio Quality</h3>
                <p>
                  Below the audio input selector you'll find the quality setting.
                  There are three options:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 pl-1">
                  <li>
                    <strong className="text-foreground">High</strong> — Sends the
                    highest quality audio possible (510 kbps stereo). Best when you
                    have a solid internet connection.
                  </li>
                  <li>
                    <strong className="text-foreground">Auto</strong> — Starts at
                    high quality and automatically adjusts if your connection gets
                    shaky. It will drop to low bandwidth when needed and switch
                    back to high once things stabilize. This is the default and
                    recommended for most situations.
                  </li>
                  <li>
                    <strong className="text-foreground">Low</strong> — Uses minimal
                    bandwidth (32 kbps mono). Choose this if you're on a slow or
                    unreliable connection and want to make sure the stream doesn't
                    cut out.
                  </li>
                </ul>
                <p className="mt-1">
                  You can change this setting before or during a broadcast. When set
                  to Auto, a label below the dropdown shows whether you're currently
                  streaming in high quality or low bandwidth.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Soundboard</h3>
                <p>
                  The grid of pads below the controls is your soundboard. Tap an empty
                  pad to load an audio file from your computer. Once loaded:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 pl-1">
                  <li>Tap the pad to <strong className="text-foreground">play</strong> or <strong className="text-foreground">stop</strong> the clip.</li>
                  <li>The <strong className="text-foreground">loop icon</strong> (top right) repeats the clip continuously.</li>
                  <li>The <strong className="text-foreground">gear icon</strong> (bottom right) lets you rename the pad or boost its volume (up to 300% for quiet files).</li>
                  <li>The <strong className="text-foreground">X</strong> (top left) removes the clip from the pad.</li>
                </ul>
                <p className="mt-1">
                  Everything on the soundboard is automatically mixed into your broadcast —
                  listeners hear it alongside your mic. Use Cue mode to preview clips
                  privately before playing them on air.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Effects</h3>
                <p>
                  Switch to the <strong className="text-foreground">Effects</strong> tab
                  (next to Sounds) to add real-time effects to your microphone.
                  Tap an effect pad to turn it on or off — it glows when active.
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 pl-1">
                  <li>
                    <strong className="text-foreground">Enhance</strong> — Cleans
                    up your mic with a noise gate (cuts background noise when
                    you're not speaking), a rumble filter, and a clarity boost
                    to help your voice cut through.
                  </li>
                  <li>
                    <strong className="text-foreground">Reverb</strong> — Adds a
                    room or hall-like ambience to your voice.
                  </li>
                  <li>
                    <strong className="text-foreground">Voice Shift</strong> — Makes
                    your voice sound deeper or brighter.
                  </li>
                  <li>
                    <strong className="text-foreground">Delay</strong> — Creates
                    repeating bounces of your voice, like a slapback or rhythmic echo.
                  </li>
                  <li>
                    <strong className="text-foreground">Tone</strong> — A simple
                    equalizer that lets you boost or cut bass, mids, and treble.
                  </li>
                  <li>
                    <strong className="text-foreground">Compressor</strong> — Evens
                    out your volume so quiet parts are louder and loud parts don't
                    clip. Great for keeping a consistent level.
                  </li>
                </ul>
                <p className="mt-1">
                  Tap the <strong className="text-foreground">gear icon</strong> on
                  any effect to customize it with easy-to-understand sliders.
                  Effects only apply to your mic — soundboard clips are not affected.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Live Chat</h3>
                <p>
                  When on air, a chat button appears in the bottom-right corner of the
                  screen. Tap it to open the chat panel (full-screen on mobile, floating
                  card on desktop). Listeners can send you messages and you can reply.
                  The first time you open chat, you'll be asked for a display name
                  (session-only — not saved). Messages are limited to 280 characters
                  and rate-limited to 1 per second. Incoming chat messages also appear
                  in the event log with a blue icon. An unread badge shows on the
                  chat button when you have new messages while the panel is closed. When
                  new messages arrive and the chat is closed or the tab is in the
                  background, the browser tab title flashes until you view the chat.
                  System messages show when others join or leave the chat (with their name).
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Now Playing</h3>
                <p>
                  The <strong className="text-foreground">Now Playing</strong> field in the
                  mixer controls has built-in <strong className="text-foreground">Deezer search</strong> —
                  start typing an artist or song name and you'll see autocomplete results
                  with album art. Select one to fill "Artist — Title", or type anything
                  freeform. Metadata is sent to all listeners in real time.
                  When using an integration (Icecast, Shoutcast, Radio.co), the
                  metadata is also pushed to the external server so listeners on that
                  platform can see what's playing.
                </p>
              </section>

              {/* Auto-identify section — temporarily disabled in UI; code remains in useAutoIdentify.ts
              <section>
                <h3 className="text-foreground font-semibold mb-1">Auto-Identify</h3>
                <p>
                  Next to the Now Playing input, there's an <strong className="text-foreground">ear icon</strong> toggle.
                  When enabled, the app periodically captures a snippet of your broadcast
                  audio and sends it to the server for fingerprinting via AcoustID
                  (Chromaprint). If a song is recognized, a toast notification appears with the
                  option to <strong className="text-foreground">Add to track list</strong> — it
                  automatically fetches full metadata from Deezer (artwork, album, year,
                  duration, contributors, etc.). The icon pulses when active. Requires an
                  AcoustID API key and <code className="text-foreground">fpcalc</code> installed
                  on the server.
                </p>
              </section>
              */}

              <section>
                <h3 className="text-foreground font-semibold mb-1">Track List</h3>
                <p>
                  Every time you set a new Now Playing value, it's added to a
                  chronological track list that appears below the stats panel. The
                  current track is highlighted at the top with a spinning disc icon.
                  Receivers who join mid-broadcast will see the full history of
                  tracks played so far. Up to 100 tracks are stored per session.
                  Click any track to view a detail modal with full metadata including
                  artwork, album, duration, BPM, label, contributors, and more.
                  You can also download the full track list as a CSV file.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Recording</h3>
                <p>
                  Press the <strong className="text-foreground">Record</strong> button in
                  the mixer controls to capture your broadcast as a 320 kbps stereo MP3.
                  A pulsing red dot shows when recording is active, along with elapsed time
                  and file size. When you stop recording (or end the broadcast), the MP3
                  automatically downloads to your computer. Recording uses an energy-efficient
                  AudioWorklet + Web Worker pipeline.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Keyboard Shortcuts</h3>
                <p>
                  While on air, use these keys for hands-free control (disabled when
                  typing in text inputs):
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 pl-1">
                  <li><strong className="text-foreground">Space</strong> — Toggle mute</li>
                  <li><strong className="text-foreground">R</strong> — Toggle recording</li>
                  <li><strong className="text-foreground">L</strong> — Toggle listen</li>
                  <li><strong className="text-foreground">C</strong> — Toggle cue mode</li>
                  <li><strong className="text-foreground">1–9, 0</strong> — Trigger soundboard pads 1–10</li>
                  <li><strong className="text-foreground">?</strong> — Show/hide shortcuts reference</li>
                </ul>
                <p className="mt-1">
                  Click the keyboard icon next to "Broadcaster" in the header to see
                  the full shortcut reference.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Audio Presets</h3>
                <p>
                  The <strong className="text-foreground">Presets</strong> dropdown in the
                  mixer saves and recalls your mic volume, limiter, quality, and all effect
                  settings at once. Three built-in presets are included:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 pl-1">
                  <li><strong className="text-foreground">Podcast Voice</strong> — Enhance + compressor, high quality</li>
                  <li><strong className="text-foreground">DJ Mode</strong> — Tone + compressor, high quality</li>
                  <li><strong className="text-foreground">Lo-Fi</strong> — Echo + voice shift + tone, low quality</li>
                </ul>
                <p className="mt-1">
                  Select "Save Current…" to create your own presets (stored in
                  localStorage). User presets can be deleted with the trash icon.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Integrations</h3>
                <p>
                  Before going on air, click the <strong className="text-foreground">Integrations</strong> button
                  to connect to an external streaming platform (Icecast, Shoutcast, or
                  Radio.co). Enter your server credentials and use the
                  <strong className="text-foreground"> Test Connection</strong> button to
                  verify. You can save credentials to localStorage with the "Remember"
                  checkbox. When broadcasting with an integration, audio goes to the
                  external platform, but a room is still created so listeners can access
                  chat, track list, and now-playing metadata. Now Playing metadata is
                  automatically forwarded to the external server's admin API so listeners
                  on those platforms can see what's playing too.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Listener Count</h3>
                <p>
                  While on air, the Stats panel shows how many receivers are currently
                  connected alongside speed, jitter, delay, and packet loss metrics.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Ending the Broadcast</h3>
                <p>
                  Press <strong className="text-foreground">End Broadcast</strong> when
                  you're done. Listeners will be disconnected and your room will close.
                  If you're recording, the MP3 will be saved automatically.
                </p>
              </section>
            </TabsContent>

            <TabsContent value="receiver" className="space-y-4 text-sm text-muted-foreground leading-relaxed mt-4">
              <section>
                <h3 className="text-foreground font-semibold mb-1">Tuning In</h3>
                <p>
                  Open the link shared by the broadcaster — it will take you straight to
                  their broadcast. If you have a Room ID but no link, paste it into the
                  field on the page and press <strong className="text-foreground">Join</strong>.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Listening</h3>
                <p>
                  Once you're connected, you'll see a <strong className="text-foreground">Tap to
                  Listen</strong> button. Give it a tap and you'll start hearing the
                  broadcast right away.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Audio Level</h3>
                <p>
                  While listening, a level meter shows how strong the incoming audio is
                  on the left (L) and right (R) channels. If you see the meter moving
                  but can't hear anything, check that your volume is turned up and your
                  speakers or headphones are connected.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Live Chat</h3>
                <p>
                  Once listening, a chat button appears in the bottom-right corner of
                  the screen. Tap it to open the chat panel (full-screen on mobile,
                  floating card on desktop). When you join, you'll see the full chat
                  history from the broadcast. The first time you open chat, you'll be
                  asked for a display name. Send messages to the broadcaster and see
                  their replies. Messages are limited to 280 characters, 1 per second.
                  System messages show when others join or leave the chat (with their name). An unread
                  badge shows on the button when you have new messages while the panel
                  is closed. The browser tab title flashes when new messages arrive
                  until you view the chat.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Now Playing</h3>
                <p>
                  If the broadcaster sets stream metadata, you'll see a "Now Playing"
                  bar with a spinning disc icon showing the current track or show name.
                  This updates in real time.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Track List</h3>
                <p>
                  A track list appears below the stats panel showing every track
                  played during the broadcast, with album artwork, duration, and
                  release year. The current track is highlighted at the top. If you
                  join mid-broadcast, you'll see the full history of tracks played
                  so far. Click any track to view a detail modal with full metadata
                  including artwork, album, BPM, label, contributors, and more.
                  You can also download the track list as a CSV file.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Auto-Reconnect</h3>
                <p>
                  If your connection drops during a broadcast, the app automatically
                  tries to reconnect with increasing delays (1s, 2s, 4s, 8s, up to 15s)
                  for up to 5 attempts. You'll see a "Reconnecting… (attempt X of 5)"
                  message. If all attempts fail, a "Connection lost" message appears
                  with a manual <strong className="text-foreground">Try again</strong> button.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">When the Broadcast Ends</h3>
                <p>
                  If the broadcaster goes off air, you'll see a message letting you know.
                  You can tap <strong className="text-foreground">Retry this broadcast</strong> to
                  try again, or paste a different Room ID to join another broadcast.
                </p>
              </section>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
