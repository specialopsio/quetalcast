export default function DocsIntegrations() {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed [&_strong]:text-foreground space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Integrations</h2>
        <p>
          Before going on air, click the <strong>Integrations</strong> button to connect to an
          external streaming platform (Icecast, Shoutcast, or Radio.co). Enter your server
          credentials and use <strong>Test Connection</strong> to verify. You can save credentials
          to localStorage with the "Remember" checkbox.
        </p>
        <p className="mt-2">
          When broadcasting with an integration, audio goes to the external platform, but a room is
          still created so listeners can access chat, track list, and now-playing metadata. Now
          Playing metadata is automatically forwarded to the external server's admin API so
          listeners on those platforms can see what's playing too.
        </p>

        <h3 className="text-base font-semibold text-foreground mt-6 mb-2">internet-radio.com (Centova Cast)</h3>
        <p>
          internet-radio.com uses Centova Cast v3. Find your settings under <strong>Settings → Stream</strong> and{' '}
          <strong>Settings → Mount Points</strong>.
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
          <li>
            <strong>Mount point</strong> — The default is <code>/stream</code>, not <code>/live</code>. Enter the exact
            mount from your control panel; listeners must connect to the same path.
          </li>
          <li>
            <strong>AutoDJ</strong> — If AutoDJ is running on the mount point, stop it before going live, or ensure
            source override is enabled so your live stream takes priority.
          </li>
          <li>
            <strong>Source password</strong> — Use the administrator/source password from Settings → Stream.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Keyboard shortcuts</h2>
        <p>
          While on air, use these keys for hands-free control (disabled when typing in text
          inputs):
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 pl-1">
          <li>
            <strong>Space</strong> — Toggle mute
          </li>
          <li>
            <strong>R</strong> — Toggle recording
          </li>
          <li>
            <strong>L</strong> — Toggle listen
          </li>
          <li>
            <strong>C</strong> — Toggle cue mode
          </li>
          <li>
            <strong>1–9, 0</strong> — Trigger sound pads 1–10
          </li>
          <li>
            <strong>?</strong> — Show/hide shortcuts reference
          </li>
        </ul>
        <p className="mt-2">
          Click the keyboard icon next to "Broadcaster" in the header to see the full shortcut
          reference.
        </p>
      </section>
    </div>
  );
}
