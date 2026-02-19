import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { CHANGELOG } from '@/lib/changelog';
import { Footer } from '@/components/Footer';

export default function Changelog() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 pb-24">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <History className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Changelog</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-10">
          Project history — meaningful releases
        </p>

        <div className="relative border-l border-border pl-8 space-y-10">
          {CHANGELOG.map((entry, idx) => (
            <div key={entry.version} className="relative">
              <span
                className={`absolute top-1.5 rounded-full -translate-x-1/2 ${
                  idx === 0
                    ? 'w-3 h-3 bg-primary ring-4 ring-primary/20 -left-[32px]'
                    : 'w-2.5 h-2.5 bg-muted-foreground/30 -left-[32px]'
                }`}
              />

              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-sm font-mono font-semibold text-foreground">
                  v{entry.version}
                </span>
                <time
                  dateTime={entry.date}
                  className="text-xs text-muted-foreground"
                >
                  {format(parseISO(entry.date), 'MMMM d, yyyy')}
                </time>
              </div>

              {entry.items.length > 0 && (
                <ul className="space-y-1.5 pl-4">
                  {entry.items.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground list-disc list-outside"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {entry.fixes && entry.fixes.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mt-4 mb-1.5 pl-4">
                    Fixes &amp; improvements
                  </p>
                  <ul className="space-y-1.5 pl-4">
                    {entry.fixes.map((fix, i) => (
                      <li
                        key={i}
                        className="text-sm text-muted-foreground/70 list-disc list-outside"
                      >
                        {fix}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
