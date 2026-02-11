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
      <footer className="py-4 px-4 text-center text-xs text-muted-foreground/60 flex items-center justify-center gap-3">
        <span>
          Built by{' '}
          <a
            href="https://specialops.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            SpecialOPS
          </a>
        </span>
        <span className="text-muted-foreground/30">|</span>
        <button
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          <HelpCircle className="h-3 w-3" />
          Help
        </button>
        <span className="text-muted-foreground/30">|</span>
        <a
          href="https://github.com/specialopsio/quetalcast"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
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
                  While on air, you'll see controls to manage your broadcast:
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
                </ul>
                <p className="mt-1">
                  Tap the <strong className="text-foreground">gear icon</strong> on
                  any effect to customize it with easy-to-understand sliders.
                  Effects only apply to your mic — soundboard clips are not affected.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Ending the Broadcast</h3>
                <p>
                  Press <strong className="text-foreground">End Broadcast</strong> when
                  you're done. Listeners will be disconnected and your room will close.
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
