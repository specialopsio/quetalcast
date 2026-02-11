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
                  Sign in with your admin credentials. Once logged in, you'll land on the
                  Broadcaster page where you can select your audio input (microphone or
                  audio interface) from the dropdown.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Level Meter</h3>
                <p>
                  The stereo level meter shows your audio input in real time with separate
                  left (L) and right (R) channels. It's calibrated in <strong className="text-foreground">dBFS</strong> (decibels
                  relative to full scale). The meter turns green, yellow, then red as
                  levels increase. A <strong className="text-foreground">CLIP</strong> warning
                  appears if audio hits the maximum. Aim to keep levels in the green,
                  peaking into yellow.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Going On Air</h3>
                <p>
                  Press <strong className="text-foreground">Go On Air</strong> to start
                  broadcasting. A timer will show how long you've been live. Copy the
                  receiver link using the button in the top right to share with listeners.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Mixer Controls</h3>
                <p>
                  While on air, you'll see controls for your microphone volume, a mute
                  button, and several tools:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 pl-1">
                  <li>
                    <strong className="text-foreground">Mute</strong> — Instantly silence
                    your mic without changing the volume slider.
                  </li>
                  <li>
                    <strong className="text-foreground">Listen</strong> — Hear what's
                    being broadcast through your own speakers (off by default to prevent
                    feedback).
                  </li>
                  <li>
                    <strong className="text-foreground">Cue</strong> — Preview mode.
                    Nothing is sent to listeners. Soundboard audio plays only for you so
                    you can preview clips before sending them on air.
                  </li>
                  <li>
                    <strong className="text-foreground">Limiter</strong> — Prevents
                    the broadcast output from exceeding the selected level. Choose 0 dB
                    (default, catches only clipping), -3 dB, -6 dB, or -12 dB for
                    progressively more aggressive limiting. Useful for taming loud
                    soundboard clips or sudden mic peaks.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Soundboard</h3>
                <p>
                  The grid of pads below the controls is your soundboard. Click an empty
                  pad to load an audio file from your computer. Once loaded:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 pl-1">
                  <li>Tap the pad to <strong className="text-foreground">play</strong> or <strong className="text-foreground">stop</strong> the clip.</li>
                  <li>Use the <strong className="text-foreground">loop icon</strong> (top right) to toggle looping.</li>
                  <li>Use the <strong className="text-foreground">gear icon</strong> (bottom right) to rename the pad or adjust its volume (up to 300% for quiet files).</li>
                  <li>Use the <strong className="text-foreground">X</strong> (top left) to remove the clip.</li>
                </ul>
                <p className="mt-1">
                  Soundboard audio is mixed into your broadcast automatically — listeners
                  hear it alongside your mic unless Cue mode is on.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Ending the Broadcast</h3>
                <p>
                  Press <strong className="text-foreground">End Broadcast</strong> when
                  you're done. Listeners will be disconnected and the room will close.
                </p>
              </section>
            </TabsContent>

            <TabsContent value="receiver" className="space-y-4 text-sm text-muted-foreground leading-relaxed mt-4">
              <section>
                <h3 className="text-foreground font-semibold mb-1">Tuning In</h3>
                <p>
                  Open the receiver link shared by the broadcaster — it already contains
                  the Room ID. If you have a Room ID but no link, paste it into the
                  input field and press <strong className="text-foreground">Join</strong>.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Listening</h3>
                <p>
                  After joining, you'll see a <strong className="text-foreground">Tap to
                  Listen</strong> button. Your browser needs a tap before it can play
                  audio — just press the button and you'll start hearing the broadcast.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">Audio Level</h3>
                <p>
                  Once audio is playing, a stereo level meter shows the incoming audio
                  strength on left (L) and right (R) channels in real time, measured in
                  dB. If you see the meter moving but hear nothing, check your device
                  volume and speaker output.
                </p>
              </section>

              <section>
                <h3 className="text-foreground font-semibold mb-1">When the Broadcast Ends</h3>
                <p>
                  If the broadcaster goes off air, you'll see a message letting you know.
                  You can tap <strong className="text-foreground">Retry this broadcast</strong> to
                  refresh, or paste a new Room ID to join a different broadcast.
                </p>
              </section>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
