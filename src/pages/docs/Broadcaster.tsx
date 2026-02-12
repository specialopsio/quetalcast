export default function DocsBroadcaster() {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed [&_strong]:text-foreground space-y-10">
      <p className="text-base">
        The broadcaster view is where you control your stream. All panels (Audio Input, Level Meter,
        Mixer Controls, Track List, Soundboard, Stats, Event Log) have icons in their headers for
        consistency. Mixer controls and the track list are visible before you go on air so you can
        prepare in advance.
      </p>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Level meter</h2>
        <p>
          The level meter is at the <strong>top of the page</strong> so you can see it immediately.
          It works as soon as you select a microphone — a preview stream feeds it before you go on
          air, so you can dial in levels and do a level check before going live. Once on air, it
          shows the mixed broadcast output.
        </p>
        <p className="mt-2">
          The meter shows left (L) and right (R) channels. Green is good, yellow is getting loud,
          red is too hot. A <strong>CLIP</strong> warning means your audio is maxing out — turn it
          down. Aim to keep things in the green, occasionally peaking into yellow.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Mixer controls</h2>
        <p>
          The mixer panel is visible <strong>before</strong> you go on air. Expand it to access:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
          <li>
            <strong>Audio input</strong> — Select your microphone or audio interface. At the top of
            the mixer so the level meter above can show input as soon as you choose.
          </li>
          <li>
            <strong>Mic slider</strong> — Adjust microphone volume. Available pre-broadcast.
          </li>
          <li>
            <strong>Mute</strong> — Silence your mic without losing volume (on air only).
          </li>
          <li>
            <strong>Listen</strong> — Hear what listeners hear (on air only). Off by default to
            avoid feedback.
          </li>
          <li>
            <strong>Cue</strong> — Preview mode. Soundboard plays only for you, nothing goes to
            listeners (on air only).
          </li>
          <li>
            <strong>Limiter</strong> — 0, -3, -6, or -12 dB. Keeps broadcast from getting too loud.
            Lower settings catch more peaks; handy for loud soundboard clips.
          </li>
          <li>
            <strong>System audio</strong> — Route desktop or app audio into your broadcast (on air
            only). Browser asks for screen share with audio; video is discarded.
          </li>
          <li>
            <strong>Audio quality</strong> — High (510 kbps), Auto (adaptive), or Low (32 kbps
            mono).
          </li>
          <li>
            <strong>Record</strong> — Save broadcast as 320 kbps MP3 (on air only).
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Going on air</h2>
        <p>
          Press <strong>Go On Air</strong> to start. A timer shows how long you've been live. The
          room ID appears in the status bar and in the URL (<code>?room=...</code>). Use{" "}
          <strong>Copy Receiver Link</strong> in the top right to share. Each new broadcast creates
          a new room; the room ID is hidden when you go off air.
        </p>
        <p className="mt-2">
          If you have a previous broadcast (track list or logs including "Off air"), a dialog
          appears first: download logs and track list as a ZIP (including MP3 if recording was
          active), copy the room link (24h access), continue the previous broadcast (rejoin same
          room, keep logs and track list), or start a new broadcast.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Soundboard</h2>
        <p>
          The grid of pads below the controls is your soundboard. Tap an empty pad to load an
          audio file. Once loaded:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
          <li>Tap to play or stop.</li>
          <li>Loop icon (top right) — repeat continuously.</li>
          <li>Gear icon (bottom right) — rename or boost volume (up to 300%).</li>
          <li>X (top left) — remove the clip.</li>
        </ul>
        <p className="mt-2">
          Everything on the soundboard is mixed into your broadcast. Use Cue mode to preview clips
          privately before playing them on air.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Effects</h2>
        <p>
          Switch to the <strong>Effects</strong> tab (next to Sounds) for real-time mic effects.
          Tap an effect pad to turn it on or off.
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
          <li>
            <strong>Enhance</strong> — Noise gate, rumble filter, clarity boost.
          </li>
          <li>
            <strong>Reverb</strong> — Room or hall ambience.
          </li>
          <li>
            <strong>Voice Shift</strong> — Deeper or brighter voice.
          </li>
          <li>
            <strong>Delay</strong> — Slapback or rhythmic echo.
          </li>
          <li>
            <strong>Tone</strong> — Bass, mids, treble EQ.
          </li>
          <li>
            <strong>Compressor</strong> — Evens out volume.
          </li>
        </ul>
        <p className="mt-2">
          Tap the gear icon to customize. Effects only apply to your mic — soundboard clips are not
          affected. <strong>Presets</strong> (in the effects panel) save and recall effect profiles
          only (not mixer settings). Built-in: Podcast Voice, DJ Mode, Lo-Fi. Save your own and
          delete with the trash icon.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Track list & Now Playing</h2>
        <p>
          The track list is always visible (collapsible). The <strong>Now Playing</strong> search
          appears at the top when on air — Deezer autocomplete for artist/song, or type freeform.
          Select one to add to the track list; metadata is sent to all listeners in real time and
          pushed to integrations.
        </p>
        <p className="mt-2">
          Every track is shown chronologically; the current track is highlighted at the top with a
          spinning disc. Click any track for a detail modal. Download the track list as CSV (icon
          next to the title) — the file includes the room ID. Track additions appear in the event
          log.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Event log & Stats</h2>
        <p>
          The event log shows connection events, track additions, and chat messages. Download as
          CSV (icon next to the title). Stats panel shows speed, jitter, delay, packet loss, and
          listener count when on air.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Recording</h2>
        <p>
          Press <strong>Record</strong> in the mixer controls to capture your broadcast as a 320
          kbps stereo MP3. A pulsing red dot shows when recording, with elapsed time and file size.
          When you stop, the MP3 downloads automatically. If you end the broadcast while recording,
          recording continues until you stop it or start a new broadcast. The post-broadcast dialog
          can download a ZIP that includes the MP3 when recording was active.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Ending the broadcast</h2>
        <p>
          Press <strong>End Broadcast</strong>. The room ID disappears. Listeners stop receiving
          audio, but the room link remains valid for 24 hours so they can view the track list,
          event log, and chat. Your logs and track list stay until you start a new broadcast. If
          recording, it continues until you stop or start a new broadcast.
        </p>
      </section>
    </div>
  );
}
