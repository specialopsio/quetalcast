import { Disc3, ListMusic } from 'lucide-react';

export interface Track {
  title: string;
  time: string;
}

interface TrackListProps {
  tracks: Track[];
}

export function TrackList({ tracks }: TrackListProps) {
  if (tracks.length === 0) return null;

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-1.5">
        <ListMusic className="h-3.5 w-3.5" />
        Track List
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
