import { Disc3, ListMusic, Download } from 'lucide-react';

export interface Track {
  title: string;
  time: string;
}

interface TrackListProps {
  tracks: Track[];
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function downloadCsv(tracks: Track[]) {
  // Tracks are stored newest-first; reverse for chronological CSV
  const rows = [...tracks].reverse();
  const header = 'Time,Title';
  const lines = rows.map((t) => `${escapeCsvField(t.time)},${escapeCsvField(t.title)}`);
  const csv = [header, ...lines].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `quetalcast-tracklist-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TrackList({ tracks }: TrackListProps) {
  if (tracks.length === 0) return null;

  return (
    <div className="panel">
      <div className="flex items-center justify-between">
        <div className="panel-header flex items-center gap-1.5">
          <ListMusic className="h-3.5 w-3.5" />
          Track List
          <span className="text-muted-foreground/60 font-normal">({tracks.length})</span>
        </div>
        <button
          onClick={() => downloadCsv(tracks)}
          className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
          title="Download track list as CSV"
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
      </div>
      <div className="space-y-0.5 max-h-64 overflow-y-auto scrollbar-thin">
        {tracks.map((track, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-xs ${
              i === 0 ? 'bg-primary/5' : ''
            }`}
          >
            <Disc3
              className={`h-3.5 w-3.5 shrink-0 ${
                i === 0 ? 'text-primary animate-spin' : 'text-muted-foreground/40'
              }`}
              style={i === 0 ? { animationDuration: '3s' } : undefined}
            />
            <span className="text-muted-foreground/60 tabular-nums shrink-0 font-mono">
              {track.time}
            </span>
            <span className={`truncate ${i === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {track.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
