import { useRef, useEffect } from 'react';

export interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

interface EventLogProps {
  entries: LogEntry[];
  maxEntries?: number;
}

const levelColors: Record<string, string> = {
  info: 'text-foreground',
  warn: 'text-accent',
  error: 'text-destructive',
};

export function EventLog({ entries, maxEntries = 30 }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = entries.slice(-maxEntries);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="panel flex flex-col">
      <div className="panel-header">Event Log</div>
      <div
        ref={scrollRef}
        className="event-log flex-1 overflow-y-auto max-h-48 scrollbar-thin"
      >
        {visible.length === 0 && (
          <div className="text-muted-foreground text-center py-4 text-xs">No events yet</div>
        )}
        {visible.map((entry, i) => (
          <div key={i} className="event-log-entry flex">
            <span className="event-log-time shrink-0">{entry.time}</span>
            <span className={levelColors[entry.level]}>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function createLogEntry(message: string, level: LogEntry['level'] = 'info'): LogEntry {
  return {
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    message,
    level,
  };
}
