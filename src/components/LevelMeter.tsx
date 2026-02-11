interface LevelMeterProps {
  level: number;     // dBFS (-60 to 0)
  peak?: number;     // dBFS peak hold
  clipping?: boolean;
  label?: string;
  segments?: number;
}

const MIN_DB = -60;
const MAX_DB = 0;

/** Map a dBFS value to a 0–1 position on the meter */
function dbToPosition(db: number): number {
  const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
  return (clamped - MIN_DB) / (MAX_DB - MIN_DB);
}

// Scale marks for the meter (dBFS values to display)
const SCALE_MARKS = [
  { db: -48, label: '-48' },
  { db: -36, label: '-36' },
  { db: -24, label: '-24' },
  { db: -18, label: '-18' },
  { db: -12, label: '-12' },
  { db: -6, label: '-6' },
  { db: 0, label: '0' },
];

export function LevelMeter({ level, peak = -60, clipping = false, label = 'Level', segments = 48 }: LevelMeterProps) {
  const levelPos = dbToPosition(level);
  const peakPos = dbToPosition(peak);
  const activeSegments = Math.round(levelPos * segments);
  const peakSegment = Math.round(peakPos * segments);

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-2">
        <span className="panel-header mb-0">{label}</span>
        <div className="flex items-center gap-3">
          {level > MIN_DB && (
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {level.toFixed(1)} dB
            </span>
          )}
          {clipping && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-destructive animate-pulse">
              CLIP
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-[2px] h-6 items-end">
        {Array.from({ length: segments }).map((_, i) => {
          const ratio = i / segments;
          const isActive = i < activeSegments;
          const isPeak = i === peakSegment && peak > MIN_DB + 1;

          // Color thresholds in dB position:
          // Green: up to -12 dB (ratio 0.80)
          // Yellow: -12 to -6 dB (ratio 0.80–0.90)
          // Red: -6 to 0 dB (ratio 0.90–1.0)
          const pos12 = dbToPosition(-12);
          const pos6 = dbToPosition(-6);

          let colorClass = 'bg-muted/40';
          if (isActive || isPeak) {
            if (ratio < pos12) colorClass = 'meter-segment-active-green';
            else if (ratio < pos6) colorClass = 'meter-segment-active-yellow';
            else colorClass = 'meter-segment-active-red';
          }

          return (
            <div
              key={i}
              className={`meter-segment flex-1 h-full ${colorClass} ${isPeak && !isActive ? 'opacity-60' : ''}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 px-0.5">
        {SCALE_MARKS.map((mark) => (
          <span
            key={mark.db}
            className="text-[9px] font-mono text-muted-foreground"
            style={{ position: 'relative' }}
          >
            {mark.label}
          </span>
        ))}
      </div>
    </div>
  );
}
