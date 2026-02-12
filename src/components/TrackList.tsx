import { useState } from 'react';
import { Disc3, ListMusic, Download, Clock, Music, Tag, Hash, Gauge, Users, Building2, Layers, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export interface Track {
  title: string;           // display string "Artist — Song"
  time: string;            // ISO timestamp or HH:MM:SS when played
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

/** Format an ISO timestamp or HH:MM:SS string into the user's local time */
function formatTime(time: string): string {
  if (time.includes('T') || time.includes('Z')) {
    const d = new Date(time);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
  return time;
}

function extractYear(dateStr?: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})/);
  return match ? match[1] : '';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function downloadCsv(tracks: Track[]) {
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
      escapeCsvField(formatTime(t.time)),
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

/* ── Detail row inside the modal ── */
function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">{label}</div>
        <div className="text-sm text-foreground mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

/* ── Track Detail Modal ── */
function TrackDetailModal({ track, open, onOpenChange }: { track: Track | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!track) return null;

  const artSrc = track.coverMedium || track.cover;
  const dur = formatDuration(track.duration);
  const year = extractYear(track.releaseDate);
  const fullDate = formatDate(track.releaseDate);
  const genres = (track.genres || []).join(', ');

  // Group contributors by role
  const contribsByRole: Record<string, string[]> = {};
  for (const c of track.contributors || []) {
    const role = c.role || 'Artist';
    if (!contribsByRole[role]) contribsByRole[role] = [];
    contribsByRole[role].push(c.name);
  }

  const hasDetails = track.album || dur || track.releaseDate || track.isrc || track.bpm ||
    track.label || genres || track.trackPosition || (track.contributors && track.contributors.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Hero — artwork + primary info */}
        <div className="relative">
          {artSrc ? (
            <div className="relative">
              {/* Blurred background */}
              <div
                className="absolute inset-0 bg-cover bg-center blur-2xl scale-110 opacity-30"
                style={{ backgroundImage: `url(${artSrc})` }}
              />
              <div className="relative flex flex-col items-center pt-8 pb-6 px-6">
                <img
                  src={artSrc}
                  alt=""
                  className="w-40 h-40 rounded-lg shadow-2xl bg-secondary"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center pt-8 pb-6 px-6">
              <div className="w-40 h-40 rounded-lg bg-secondary flex items-center justify-center">
                <Disc3 className="h-16 w-16 text-muted-foreground/30" />
              </div>
            </div>
          )}

          {/* Title area */}
          <div className="px-6 pb-4 text-center">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                {track.trackTitle || track.title}
              </DialogTitle>
              {track.artist && (
                <DialogDescription className="text-sm text-primary font-medium mt-1">
                  {track.artist}
                </DialogDescription>
              )}
            </DialogHeader>
            {track.album && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {track.album}{year ? ` · ${year}` : ''}
              </p>
            )}
            {/* Quick badges */}
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              {dur && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  <Clock className="h-2.5 w-2.5" /> {dur}
                </span>
              )}
              {track.bpm ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  <Gauge className="h-2.5 w-2.5" /> {track.bpm} BPM
                </span>
              ) : null}
              {track.explicitLyrics && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-2.5 w-2.5" /> Explicit
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                <Clock className="h-2.5 w-2.5" /> Played {formatTime(track.time)}
              </span>
            </div>
          </div>
        </div>

        {/* Details section */}
        {hasDetails && (
          <div className="px-6 pb-6 border-t border-border">
            <div className="divide-y divide-border/50">
              {/* Contributors */}
              {Object.keys(contribsByRole).length > 0 && (
                <div className="py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">Credits</span>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(contribsByRole).map(([role, names]) => (
                      <div key={role} className="flex items-baseline gap-2">
                        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider shrink-0 w-20 text-right">{role}</span>
                        <span className="text-xs text-foreground">{names.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DetailRow icon={Music} label="Album" value={track.album || ''} />
              <DetailRow icon={Tag} label="Release Date" value={fullDate} />
              <DetailRow icon={Building2} label="Label" value={track.label || ''} />
              <DetailRow icon={Layers} label="Genres" value={genres} />
              <DetailRow icon={Hash} label="ISRC" value={track.isrc || ''} />

              {(track.trackPosition || track.diskNumber) ? (
                <DetailRow
                  icon={ListMusic}
                  label="Position"
                  value={[
                    track.trackPosition ? `Track ${track.trackPosition}` : '',
                    track.diskNumber ? `Disc ${track.diskNumber}` : '',
                  ].filter(Boolean).join(' · ')}
                />
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Main TrackList Component ── */
export function TrackList({ tracks }: TrackListProps) {
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  if (tracks.length === 0) return null;

  return (
    <>
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
          <span className="w-8 shrink-0" />
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
              <button
                key={i}
                onClick={() => setSelectedTrack(track)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                  isCurrent ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-secondary/50'
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
                  {formatTime(track.time)}
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Track Detail Modal */}
      <TrackDetailModal
        track={selectedTrack}
        open={!!selectedTrack}
        onOpenChange={(open) => { if (!open) setSelectedTrack(null); }}
      />
    </>
  );
}
