import type { ChannelAnalysis } from '@/hooks/useAudioAnalyser';

interface LevelMeterProps {
  left: ChannelAnalysis;
  right: ChannelAnalysis;
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

const pos12 = dbToPosition(-12);
const pos6 = dbToPosition(-6);

const SCALE_MARKS = [
  { db: -48, label: '-48' },
  { db: -36, label: '-36' },
  { db: -24, label: '-24' },
  { db: -18, label: '-18' },
  { db: -12, label: '-12' },
  { db: -6, label: '-6' },
  { db: 0, label: '0' },
];

function MeterBar({ channel, segments, channelLabel }: { channel: ChannelAnalysis; segments: number; channelLabel: string }) {
  const levelPos = dbToPosition(channel.level);
  const peakPos = dbToPosition(channel.peak);
  const activeSegments = Math.round(levelPos * segments);
  const peakSegment = Math.round(peakPos * segments);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-muted-foreground w-3 text-right shrink-0">{channelLabel}</span>
      <div className="flex gap-[2px] h-3 items-end flex-1">
        {Array.from({ length: segments }).map((_, i) => {
          const ratio = i / segments;
          const isActive = i < activeSegments;
          const isPeak = i === peakSegment && channel.peak > MIN_DB + 1;

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
    </div>
  );
}

export function LevelMeter({ left, right, label = 'Level', segments = 48 }: LevelMeterProps) {
  const clipping = left.clipping || right.clipping;
  const maxLevel = Math.max(left.level, right.level);

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-2">
        <span className="panel-header mb-0">{label}</span>
        <div className="flex items-center gap-3">
          {maxLevel > MIN_DB && (
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {maxLevel.toFixed(1)} dB
            </span>
          )}
          {clipping && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-destructive animate-pulse">
              CLIP
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <MeterBar channel={left} segments={segments} channelLabel="L" />
        <MeterBar channel={right} segments={segments} channelLabel="R" />
      </div>
      <div className="flex justify-between mt-1 pl-5 pr-0.5">
        {SCALE_MARKS.map((mark) => (
          <span
            key={mark.db}
            className="text-[9px] font-mono text-muted-foreground"
          >
            {mark.label}
          </span>
        ))}
      </div>
    </div>
  );
}
