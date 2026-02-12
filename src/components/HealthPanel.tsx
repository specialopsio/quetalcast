import { BarChart2 } from 'lucide-react';
import type { WebRTCStats } from '@/lib/webrtc-stats';

interface HealthPanelProps {
  stats: WebRTCStats | null;
  connectionState: string;
  iceConnectionState: string;
  signalingState: string;
  peerConnected: boolean;
  /** Optional listener count — shown only when provided (broadcaster) */
  listenerCount?: number;
}

function StatItem({ label, value, unit, warn }: { label: string; value: string | number; unit?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`stat-value ${warn ? 'text-destructive' : ''}`}>
        {value}
        {unit && <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function StateIndicator({ label, value }: { label: string; value: string }) {
  const colorMap: Record<string, string> = {
    connected: 'text-primary',
    completed: 'text-primary',
    stable: 'text-primary',
    checking: 'text-accent',
    connecting: 'text-accent',
    'have-local-offer': 'text-accent',
    'have-remote-offer': 'text-accent',
    new: 'text-muted-foreground',
    disconnected: 'text-destructive',
    failed: 'text-destructive',
    closed: 'text-muted-foreground',
  };

  const friendlyValue: Record<string, string> = {
    connected: 'Good',
    completed: 'Good',
    stable: 'Stable',
    checking: 'Checking…',
    connecting: 'Connecting…',
    'have-local-offer': 'Setting up…',
    'have-remote-offer': 'Setting up…',
    new: 'Waiting',
    disconnected: 'Lost',
    failed: 'Failed',
    closed: 'Closed',
  };

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-mono text-muted-foreground uppercase">{label}</span>
      <span className={`font-mono font-semibold ${colorMap[value] || 'text-foreground'}`}>{friendlyValue[value] || value}</span>
    </div>
  );
}

export function HealthPanel({ stats, connectionState, iceConnectionState, signalingState, peerConnected, listenerCount }: HealthPanelProps) {
  return (
    <div className="panel space-y-4">
      <div className="panel-header flex items-center gap-1.5 !mb-0">
        <BarChart2 className="h-3.5 w-3.5" />
        Stats
      </div>

      {/* Stats grid */}
      <div className={`grid gap-3 ${listenerCount !== undefined ? 'grid-cols-5' : 'grid-cols-4'}`}>
        <StatItem label="Speed" value={stats ? stats.bitrate.toFixed(1) : '—'} unit="kbps" />
        <StatItem
          label="Dropped"
          value={stats ? stats.packetsLost : '—'}
          warn={!!stats && stats.packetsLost > 10}
        />
        <StatItem label="Jitter" value={stats ? stats.jitter.toFixed(1) : '—'} unit="ms" />
        <StatItem label="Delay" value={stats ? stats.rtt.toFixed(0) : '—'} unit="ms" />
        {listenerCount !== undefined && (
          <StatItem label="Listeners" value={listenerCount} />
        )}
      </div>

      {/* Connection states */}
      <div className="space-y-1.5 pt-2 border-t border-border/50">
        <StateIndicator label="Stream" value={connectionState} />
        <StateIndicator label="Network" value={iceConnectionState} />
        <StateIndicator label="Server" value={signalingState} />
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-muted-foreground uppercase">Peer</span>
          <span className={`font-mono font-semibold ${peerConnected ? 'text-primary' : 'text-muted-foreground'}`}>
            {peerConnected ? 'Connected' : 'Waiting'}
          </span>
        </div>
      </div>
    </div>
  );
}
