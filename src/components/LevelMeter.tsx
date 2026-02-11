interface LevelMeterProps {
  level: number;
  peak?: number;
  clipping?: boolean;
  label?: string;
  segments?: number;
}

export function LevelMeter({ level, peak = 0, clipping = false, label = 'Level', segments = 40 }: LevelMeterProps) {
  const activeSegments = Math.round(level * segments);
  const peakSegment = Math.round(peak * segments);

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-2">
        <span className="panel-header mb-0">{label}</span>
        {clipping && (
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-destructive animate-pulse">
            CLIP
          </span>
        )}
      </div>
      <div className="flex gap-[2px] h-6 items-end">
        {Array.from({ length: segments }).map((_, i) => {
          const ratio = i / segments;
          const isActive = i < activeSegments;
          const isPeak = i === peakSegment && peak > 0.01;

          let colorClass = 'bg-muted/40';
          if (isActive || isPeak) {
            if (ratio < 0.6) colorClass = 'meter-segment-active-green';
            else if (ratio < 0.85) colorClass = 'meter-segment-active-yellow';
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
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-muted-foreground">-∞</span>
        <span className="text-[9px] font-mono text-muted-foreground">-18</span>
        <span className="text-[9px] font-mono text-muted-foreground">-6</span>
        <span className="text-[9px] font-mono text-muted-foreground">0dB</span>
      </div>
    </div>
  );
}
