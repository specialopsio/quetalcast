import { Link } from 'react-router-dom';

export default function DocsOverview() {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed [&_strong]:text-foreground">
      <p className="text-base">
        QueTal Cast is a real-time audio broadcasting app for low-latency, high-quality streaming
        from a single broadcaster to multiple listeners. Built with WebRTC, React, and Node.js.
      </p>

      <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Quick links</h2>
      <ul className="space-y-2 list-none pl-0">
        <li>
          <Link to="/docs/broadcaster" className="text-primary hover:underline">
            Broadcaster
          </Link>
          {' — '}
          Level meter, audio controls, going on air, sounds, effects, track list, recording
        </li>
        <li>
          <Link to="/docs/receiver" className="text-primary hover:underline">
            Receiver
          </Link>
          {' — '}
          Tuning in, listening, chat, track list, reconnecting
        </li>
        <li>
          <Link to="/docs/integrations" className="text-primary hover:underline">
            Integrations & Shortcuts
          </Link>
          {' — '}
          Icecast, Shoutcast, Radio.co, keyboard shortcuts
        </li>
      </ul>

      <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Getting started</h2>
      <ol className="list-decimal list-inside space-y-2 pl-1">
        <li>Log in with your credentials.</li>
        <li>
          Expand <strong>Audio Controls</strong> and select your audio input. The level meter at the
          top immediately shows your input so you can dial in before going live.
        </li>
        <li>Click <strong>Go On Air</strong> — a room ID is created.</li>
        <li>Use <strong>Copy Receiver Link</strong> and share it with listeners.</li>
      </ol>
    </div>
  );
}
