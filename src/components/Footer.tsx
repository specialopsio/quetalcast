import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export function Footer() {
  return (
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
        <Link
          to="/docs"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          Docs
        </Link>
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
  );
}
