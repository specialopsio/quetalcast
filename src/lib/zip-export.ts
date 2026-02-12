import JSZip from 'jszip';
import type { LogEntry } from '@/components/EventLog';
import type { Track } from '@/components/TrackList';

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function formatTime(time: string): string {
  if (time.includes('T') || time.includes('Z')) {
    const d = new Date(time);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
  return time;
}

function formatDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildEventLogCsv(entries: LogEntry[], roomId?: string): string {
  const header = roomId ? 'Room ID,Time,Level,Message' : 'Time,Level,Message';
  const lines = entries.map((e) => {
    const row = [escapeCsvField(e.time), escapeCsvField(e.level), escapeCsvField(e.message)];
    return roomId ? [escapeCsvField(roomId), ...row].join(',') : row.join(',');
  });
  return [header, ...lines].join('\n');
}

function buildTrackListCsv(tracks: Track[], roomId?: string): string {
  const baseHeader = [
    'Time Played', 'Artist', 'Title', 'Album', 'Duration', 'Release Date',
    'ISRC', 'BPM', 'Label', 'Genres', 'Contributors', 'Track #', 'Disc #', 'Explicit',
  ];
  const header = roomId ? ['Room ID', ...baseHeader].join(',') : baseHeader.join(',');

  const rows = [...tracks].reverse();
  const lines = rows.map((t) => {
    const dur = t.duration ? formatDuration(t.duration) : '';
    const contribs = (t.contributors || [])
      .map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`)
      .join('; ');
    const genres = (t.genres || []).join('; ');
    const baseRow = [
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
    ];
    return roomId ? [escapeCsvField(roomId), ...baseRow].join(',') : baseRow.join(',');
  });
  return [header, ...lines].join('\n');
}

/** Download a zip containing event log and track list CSVs */
export async function downloadBroadcastZip(
  logs: LogEntry[],
  tracks: Track[],
  roomId?: string
): Promise<void> {
  const zip = new JSZip();
  const date = new Date().toISOString().slice(0, 10);
  const hash = Math.random().toString(36).slice(2, 8);

  zip.file('event-log.csv', buildEventLogCsv(logs, roomId));
  zip.file('track-list.csv', buildTrackListCsv(tracks, roomId));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quetalcast-broadcast-${date}-${hash}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
