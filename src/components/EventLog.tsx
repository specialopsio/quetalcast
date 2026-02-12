import { useRef, useEffect } from 'react';
import { MessageCircle, Download } from 'lucide-react';

export interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'chat';
}

interface EventLogProps {
  entries: LogEntry[];
  maxEntries?: number;
  roomId?: string;
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function downloadEventLogCsv(entries: LogEntry[], roomId?: string) {
  const header = roomId ? 'Room ID,Time,Level,Message' : 'Time,Level,Message';
  const lines = entries.map((e) => {
    const row = [escapeCsvField(e.time), escapeCsvField(e.level), escapeCsvField(e.message)];
    return roomId ? [escapeCsvField(roomId), ...row].join(',') : row.join(',');
  });
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  const shortHash = Math.random().toString(36).slice(2, 8);
  a.download = `quetalcast-eventlog-${date}-${shortHash}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const levelColors: Record<string, string> = {
  info: 'text-foreground',
  warn: 'text-accent',
  error: 'text-destructive',
  chat: 'text-blue-400',
};

export function EventLog({ entries, maxEntries = 30, roomId }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = entries.slice(-maxEntries);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="panel flex flex-col">
      <div className="flex items-center justify-between">
        <div className="panel-header !mb-0">Event Log</div>
        {entries.length > 0 && (
          <button
            onClick={() => downloadEventLogCsv(entries, roomId)}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
            title="Download event log as CSV"
          >
            <Download className="h-3 w-3" />
          </button>
        )}
      </div>
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
            <span className={`flex items-center gap-1 ${levelColors[entry.level]}`}>
              {entry.level === 'chat' && <MessageCircle className="h-3 w-3 shrink-0" />}
              {entry.message}
            </span>
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
