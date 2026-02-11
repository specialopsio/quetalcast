import { type ConnectionStatus } from '@/hooks/useWebRTC';
import { Radio, Wifi, WifiOff, AlertCircle, Headphones } from 'lucide-react';

interface StatusBarProps {
  status: ConnectionStatus;
  roomId?: string | null;
}

const statusConfig: Record<ConnectionStatus, { label: string; className: string; icon: typeof Radio }> = {
  idle: { label: 'OFFLINE', className: 'status-offline', icon: WifiOff },
  connecting: { label: 'CONNECTING', className: 'status-connecting', icon: Wifi },
  'on-air': { label: 'ON AIR', className: 'status-on-air', icon: Radio },
  receiving: { label: 'RECEIVING', className: 'status-receiving', icon: Headphones },
  disconnected: { label: 'DISCONNECTED', className: 'status-error', icon: WifiOff },
  error: { label: 'ERROR', className: 'status-error', icon: AlertCircle },
};

export function StatusBar({ status, roomId }: StatusBarProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-mono font-semibold text-foreground tracking-tight">
          <Radio className="h-4 w-4 text-primary" />
          <span>AUDIO BRIDGE</span>
        </div>
        {roomId && (
          <span className="text-xs font-mono text-muted-foreground">
            ROOM: {roomId.slice(0, 8)}…
          </span>
        )}
      </div>
      <div className={`status-badge flex items-center gap-1.5 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </div>
    </div>
  );
}
