export default function DocsBroadcaster() {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed [&_strong]:text-foreground space-y-10">
      <p className="text-base">
        The broadcaster view is where you control your stream. All panels (Audio Input, Level Meter,
        Audio Controls, Track List, Sounds / Effects, Stats, Event Log) have icons in their headers for
        consistency. Audio controls and the track list are visible before you go on air so you can
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
        <h2 className="text-lg font-semibold text-foreground mb-3">Audio controls</h2>
        <p>
          The audio controls panel is visible <strong>before</strong> you go on air. Expand it to access:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
          <li>
            <strong>Mute, Listen, Cue, Limiter</strong> — Top row. Mute silences your mic; Listen lets you hear
            what listeners hear (on air only); Cue previews sounds for you only (on air only); Limiter
            sets the ceiling (0, -3, -6, or -12 dB).
          </li>
          <li>
            <strong>Audio input</strong> — Select your microphone or audio interface. At the top so the
            level meter above can show input as soon as you choose.
          </li>
          <li>
            <strong>System audio</strong> — Route desktop or app audio into your broadcast. Connect button
            only; volume and pan are in the Mixer Board below. Browser asks for screen share with
            audio; video is discarded.
          </li>
          <li>
            <strong>Audio quality</strong> — High (510 kbps), Auto (adaptive), or Low (32 kbps mono).
          </li>
          <li>
            <strong>Record</strong> — Save as 320 kbps MP3. Start before going on air to capture
            from the moment you hit record, or during broadcast for the full mix.
          </li>
          <li>
            <strong>Mixer Board</strong> — Collapsible section with channel strips in this order: Mic,
            SOUND PADS, then System Audio. Each strip has a level slider, Mute (M), Solo (S), and
            Headphone Monitor buttons, plus a pan knob. The headphone button (green when active)
            toggles local monitoring for that channel — hear it through your speakers/headphones
            without affecting the broadcast. Pads monitor is on by default; Mic and System are off.
            Use the pads monitor toggle to play soundboard clips to listeners without hearing them
            yourself. A vertical LED signal meter (live audio level, not slider value)
            appears at the left of each strip label. Strip labels also show the current level inline
            (for example, <code>Mic 100%</code>). Pan readouts are always visible above each knob; drag
            or mouse-wheel to adjust stereo position, and double-click to center. System Audio strip
            is grayed when not connected. Monitor states are persisted to localStorage.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Saved layout</h2>
        <p>
          Broadcaster layout is saved to <code>localStorage</code> and restored on reload. This includes
          sound pads, mixer strip values (volume, mute, solo, pan, monitor), effects state and
          parameters, quality mode, and selected input device.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Custom receive URL</h2>
        <p>
          Before going on air, the <strong>Receive URL</strong> panel lets you set a custom slug for
          your receive link. For example, type <code>elpasorocks</code> and listeners can go to{" "}
          <code>/receive/elpasorocks</code>. Leave it blank to auto-generate a random ID.
        </p>
        <p className="mt-2">
          Rules: lowercase letters, numbers, and hyphens only. 3–40 characters. No leading or
          trailing hyphens, no consecutive hyphens.
        </p>
        <p className="mt-2">
          Previously used slugs are stored on the server and shown as suggestions when you focus
          the input — each one displays a live/available status indicator. You can remove saved
          slugs with the X button. Custom slugs can be freely reused across broadcasts; they are
          only blocked while a room with that slug is currently live.
        </p>
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
        <h2 className="text-lg font-semibold text-foreground mb-3">Sounds</h2>
        <p>
          The grid of pads below the controls is your sounds grid. Tap an empty pad to load an
          audio file. Once loaded:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
          <li>Tap to play or stop.</li>
          <li>Loop icon (top right) — repeat continuously.</li>
          <li>Gear icon (bottom right) — rename or boost volume (up to 300%).</li>
          <li>X (top left) — remove the clip.</li>
        </ul>
        <p className="mt-2">
          Everything on the sounds grid is mixed into your broadcast. Use Cue mode to preview clips
          privately before playing them on air.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Sounds & Effects</h2>
        <p>
          The <strong>Sounds / Effects</strong> section is collapsible. When expanded, use the
          music and sparkle icons to switch between <strong>Sounds</strong> (the pad grid) and{' '}
          <strong>Effects</strong> (real-time mic effects).
        </p>
        <p className="mt-2">
          In <strong>Effects</strong> mode, tap an effect pad to turn it on or off.
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
          Tap the gear icon to customize. Effects only apply to your mic — sound clips are not
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
          The event log shows connection events, track additions, and chat messages. The header
          displays the listener count when on air. Download as CSV (icon next to the title). Stats
          panel shows speed, jitter, delay, and packet loss.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Recording</h2>
        <p>
          Press <strong>Record</strong> in the audio controls to capture as a 320 kbps stereo MP3. A
          pulsing red dot shows when recording, with elapsed time and file size. When you stop,
          the MP3 downloads automatically. Start recording before going on air to capture from the
          moment you hit record (mic only); during broadcast you capture the full mix. If you end
          the broadcast while recording, recording continues until you stop it or click Download ZIP
          in the "Start New Broadcast" modal. Recording also continues when you click Start New
          Broadcast — use the Record button or Download ZIP to stop and save.
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
