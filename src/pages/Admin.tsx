import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '@/lib/auth';
import { Shield } from 'lucide-react';

interface RoomInfo {
  roomId: string;
  broadcaster: boolean;
  receiver: boolean;
  createdAt: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');

  useEffect(() => {
    if (!isAuthenticated()) navigate('/login');
  }, [navigate]);

  // Poll admin endpoint
  useEffect(() => {
    const poll = async () => {
      try {
        const host = window.location.hostname;
        const res = await fetch(`http://${host}:3001/admin/rooms`);
        if (res.ok) {
          const data = await res.json();
          setRooms(data.rooms || []);
          setServerStatus('online');
        } else {
          setServerStatus('offline');
        }
      } catch {
        setServerStatus('offline');
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2 text-sm font-mono font-semibold text-foreground">
          <Shield className="h-4 w-4 text-primary" />
          ADMIN
        </div>
        <div className={`status-badge ${serverStatus === 'online' ? 'status-on-air' : 'status-offline'}`}>
          Server: {serverStatus}
        </div>
      </div>

      <div className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Active Rooms</h1>

        {rooms.length === 0 && (
          <div className="panel text-center text-sm text-muted-foreground py-8">
            {serverStatus === 'offline'
              ? 'Cannot reach signaling server'
              : 'No active rooms'}
          </div>
        )}

        <div className="space-y-2">
          {rooms.map((room) => (
            <div key={room.roomId} className="panel flex items-center justify-between">
              <div>
                <div className="text-sm font-mono text-foreground">{room.roomId.slice(0, 16)}…</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Created: {new Date(room.createdAt).toLocaleTimeString()}
                </div>
              </div>
              <div className="flex gap-3">
                <div className={`status-badge text-[10px] ${room.broadcaster ? 'status-on-air' : 'status-offline'}`}>
                  Broadcaster
                </div>
                <div className={`status-badge text-[10px] ${room.receiver ? 'status-receiving' : 'status-offline'}`}>
                  Receiver
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-header">Navigation</div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/broadcast')}
              className="bg-secondary text-secondary-foreground rounded-md px-4 py-2 text-sm font-mono hover:opacity-80 transition-opacity"
            >
              Broadcaster
            </button>
            <button
              onClick={() => navigate('/receive')}
              className="bg-secondary text-secondary-foreground rounded-md px-4 py-2 text-sm font-mono hover:opacity-80 transition-opacity"
            >
              Receiver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
