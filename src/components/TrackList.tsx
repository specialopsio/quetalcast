import { Disc3, ListMusic, Download } from 'lucide-react';

export interface Track {
  title: string;           // display string "Artist — Song"
  time: string;            // HH:MM:SS when played
  cover?: string;          // small album art URL
  coverMedium?: string;    // medium album art URL
  artist?: string;
  trackTitle?: string;     // song name (distinct from display title)
  album?: string;
  duration?: number;       // seconds
  releaseDate?: string;    // YYYY-MM-DD
  isrc?: string;
  bpm?: number;
  trackPosition?: number;
  diskNumber?: number;
  explicitLyrics?: boolean;
  contributors?: { name: string; role: string }[];
  label?: string;
  genres?: string[];
}

interface TrackListProps {
  tracks: Track[];
}

function formatDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function extractYear(dateStr?: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})/);
  return match ? match[1] : '';
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
  const header = [
    'Time Played', 'Artist', 'Title', 'Album', 'Duration', 'Release Date',
    'ISRC', 'BPM', 'Label', 'Genres', 'Contributors', 'Track #', 'Disc #', 'Explicit',
  ].join(',');

  const lines = rows.map((t) => {
    const dur = t.duration ? formatDuration(t.duration) : '';
    const contribs = (t.contributors || [])
      .map(c => `${c.name}${c.role ? ` (${c.role})` : ''}`)
      .join('; ');
    const genres = (t.genres || []).join('; ');

    return [
      escapeCsvField(t.time),
      escapeCsvField(t.artist || ''),
      escapeCsvField(t.trackTitle || t.title),
      escapeCsvField(t.album || ''),
      escapeCsvField(dur),
      escapeCsvField(t.releaseDate || ''),
      escapeCsvField(t.isrc || ''),
      escapeCsvField(t.bpm ? String(t.bpm) : ''),
      escapeCsvField(t.label || ''),
      escapeCsvField(genres),
      escapeCsvField(contribs),
      escapeCsvField(t.trackPosition ? String(t.trackPosition) : ''),
      escapeCsvField(t.diskNumber ? String(t.diskNumber) : ''),
      escapeCsvField(t.explicitLyrics ? 'Yes' : ''),
    ].join(',');
  });

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

      {/* Column headers */}
      <div className="flex items-center gap-2.5 px-2 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider border-b border-border">
        <span className="w-8 shrink-0" /> {/* artwork column */}
        <span className="w-16 shrink-0">Time</span>
        <span className="flex-1 min-w-0">Title</span>
        <span className="hidden sm:block w-32 shrink-0 truncate">Album</span>
        <span className="w-10 shrink-0 text-right">Dur.</span>
        <span className="hidden sm:block w-10 shrink-0 text-right">Year</span>
      </div>

      <div className="space-y-0 max-h-72 overflow-y-auto scrollbar-thin">
        {tracks.map((track, i) => {
          const year = extractYear(track.releaseDate);
          const dur = formatDuration(track.duration);
          const isCurrent = i === 0;

          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-2 py-1.5 text-xs transition-colors ${
                isCurrent ? 'bg-primary/5' : 'hover:bg-secondary/30'
              }`}
            >
              {/* Artwork */}
              {(track.coverMedium || track.cover) ? (
                <img
                  src={track.coverMedium || track.cover}
                  alt=""
                  className="w-8 h-8 rounded shrink-0 bg-secondary"
                  loading="lazy"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-secondary shrink-0 flex items-center justify-center">
                  <Disc3
                    className={`h-3.5 w-3.5 ${
                      isCurrent ? 'text-primary animate-spin' : 'text-muted-foreground/40'
                    }`}
                    style={isCurrent ? { animationDuration: '3s' } : undefined}
                  />
                </div>
              )}

              {/* Time played */}
              <span className="w-16 shrink-0 text-muted-foreground/60 tabular-nums font-mono">
                {track.time}
              </span>

              {/* Title + Artist */}
              <div className="flex-1 min-w-0">
                <div className={`truncate ${isCurrent ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                  {track.trackTitle || track.title}
                </div>
                {track.artist && (
                  <div className="text-[10px] text-muted-foreground truncate">
                    {track.artist}
                  </div>
                )}
              </div>

              {/* Album */}
              <span className="hidden sm:block w-32 shrink-0 text-muted-foreground truncate text-[11px]">
                {track.album || ''}
              </span>

              {/* Duration */}
              <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground/60 font-mono">
                {dur}
              </span>

              {/* Year */}
              <span className="hidden sm:block w-10 shrink-0 text-right tabular-nums text-muted-foreground/60 font-mono">
                {year}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
