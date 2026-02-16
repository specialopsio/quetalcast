export default function DocsReceiver() {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed [&_strong]:text-foreground space-y-10">
      <p className="text-base">
        The receiver view is for listeners. Open the link shared by the broadcaster or paste a room
        ID to tune in.
      </p>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Tuning in</h2>
        <p>
          Open the link shared by the broadcaster — it takes you straight to their broadcast. If you
          have a Room ID but no link, paste it into the field and press <strong>Join</strong>.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Listening</h2>
        <p>
          Once connected, you'll see a <strong>Tap to Listen</strong> button. Tap it to start
          hearing the broadcast.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Audio level</h2>
        <p>
          A level meter shows the incoming audio on left (L) and right (R) channels. If the meter
          moves but you hear nothing, check your volume and speakers/headphones.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Live chat</h2>
        <p>
          A chat button appears in the bottom-right corner. Tap it to open the panel (full-screen
          on mobile, floating card on desktop). When you join, you see the full chat history. The
          first time you open chat, you'll be asked for a display name. Send messages to the
          broadcaster and see replies. 280 characters max, 1 per second. System messages show when
          others join or leave. An unread badge appears when you have new messages; the browser tab
          title flashes until you view the chat.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Share links</h2>
        <p>
          Once connected, you'll see a <strong>Receive Link</strong> bar with a Copy button — this
          is the URL for sharing with others so they can tune into the same broadcast.
        </p>
        <p className="mt-2">
          A <strong>Stream URL</strong> is shown for every broadcast — both integration-based and
          standard WebRTC streams. This is a direct audio URL that can be pasted into{" "}
          <strong>RadioDJ</strong> (Options → Track Import → Internet Stream),{" "}
          <strong>VLC</strong> (Media → Open Network Stream), or any other media player
          that accepts standard audio streams. Integration streams use the external Icecast/Shoutcast
          URL; non-integration streams use the built-in WebM/Opus relay.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Now Playing</h2>
        <p>
          When the broadcaster sets stream metadata, you'll see a "Now Playing" bar with a
          spinning disc showing the current track. Updates in real time.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Layout</h2>
        <p>
          The receiver layout mirrors the broadcaster: track list at the top, stats and event log
          below. On mobile, stats are in a 2-column grid.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Track list</h2>
        <p>
          A collapsible track list shows every track played, with album artwork, duration, and
          release year. The current track is highlighted at the top. If you join mid-broadcast,
          you see the full history. Click any track for a detail modal. Download as CSV (icon in the
          header); the file includes the room ID.
        </p>
        <p className="mt-2">
          After the broadcast ends, the room link stays valid for 24 hours — you can still view the
          track list and chat.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Auto-reconnect</h2>
        <p>
          If your connection drops, the app automatically tries to reconnect with increasing
          delays (1s, 2s, 4s, 8s, up to 15s) for up to 5 attempts. You'll see "Reconnecting… (attempt
          X of 5)." If all fail, a "Connection lost" message appears with a manual{' '}
          <strong>Try again</strong> button.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">When the broadcast ends</h2>
        <p>
          When the broadcaster goes off air, you'll see a message. The room link remains valid
          for <strong>24 hours</strong> — you can still view the track list, event log, and chat.
          Post-broadcast chatter continues until the room expires. Tap <strong>Retry this
          broadcast</strong> to try again, or paste a different Room ID to join another broadcast.
        </p>
      </section>
    </div>
  );
}
