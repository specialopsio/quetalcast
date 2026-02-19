import { format, parseISO } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { CHANGELOG } from '@/lib/changelog';
import { History } from 'lucide-react';

interface ChangelogSheetProps {
  triggerClassName?: string;
}

export function ChangelogSheet({ triggerClassName }: ChangelogSheetProps) {
  return (
    <Sheet>
      <SheetTrigger
        className={
          triggerClassName ??
          'inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors'
        }
      >
        <History className="h-3 w-3" />
        Changelog
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-[70dvh] overflow-y-auto rounded-t-xl"
      >
        <div className="max-w-2xl mx-auto">
          <SheetHeader className="text-left pb-4 border-b border-border">
            <SheetTitle className="text-lg font-semibold">Changelog</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Meaningful releases from the last 30 days
            </p>
          </SheetHeader>
          <div className="mt-6 space-y-8">
          {CHANGELOG.map((entry) => (
            <div key={entry.date} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <time
                  dateTime={entry.date}
                  className="text-sm font-medium text-foreground"
                >
                  {format(parseISO(entry.date), 'MMMM d, yyyy')}
                </time>
                {entry.version && (
                  <span className="text-xs font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    v{entry.version}
                  </span>
                )}
              </div>
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
            </div>
          ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
