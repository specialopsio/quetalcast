export interface WebRTCStats {
  bitrate: number;
  packetsLost: number;
  jitter: number;
  rtt: number;
  audioLevel: number;
  timestamp: number;
}

interface PrevStats {
  bytesReceived?: number;
  bytesSent?: number;
  timestamp?: number;
}

let prevStats: PrevStats = {};

export async function parseStats(
  pc: RTCPeerConnection,
  role: 'broadcaster' | 'receiver'
): Promise<WebRTCStats> {
  const stats = await pc.getStats();
  const result: WebRTCStats = {
    bitrate: 0,
    packetsLost: 0,
    jitter: 0,
    rtt: 0,
    audioLevel: 0,
    timestamp: Date.now(),
  };

  stats.forEach((report) => {
    if (role === 'receiver' && report.type === 'inbound-rtp' && report.kind === 'audio') {
      result.packetsLost = report.packetsLost ?? 0;
      result.jitter = (report.jitter ?? 0) * 1000; // convert to ms

      const bytes = report.bytesReceived ?? 0;
      const now = report.timestamp;
      if (prevStats.bytesReceived !== undefined && prevStats.timestamp !== undefined) {
        const dt = (now - prevStats.timestamp) / 1000;
        if (dt > 0) {
          result.bitrate = ((bytes - prevStats.bytesReceived) * 8) / dt / 1000; // kbps
        }
      }
      prevStats.bytesReceived = bytes;
      prevStats.timestamp = now;
    }

    if (role === 'broadcaster' && report.type === 'outbound-rtp' && report.kind === 'audio') {
      const bytes = report.bytesSent ?? 0;
      const now = report.timestamp;
      if (prevStats.bytesSent !== undefined && prevStats.timestamp !== undefined) {
        const dt = (now - prevStats.timestamp) / 1000;
        if (dt > 0) {
          result.bitrate = ((bytes - prevStats.bytesSent) * 8) / dt / 1000;
        }
      }
      prevStats.bytesSent = bytes;
      prevStats.timestamp = now;
    }

    if (report.type === 'remote-inbound-rtp' && report.kind === 'audio') {
      result.rtt = (report.roundTripTime ?? 0) * 1000;
      result.packetsLost = report.packetsLost ?? result.packetsLost;
    }

    if (report.type === 'media-source' && report.kind === 'audio') {
      result.audioLevel = report.audioLevel ?? 0;
    }
  });

  return result;
}

export function resetStats(): void {
  prevStats = {};
}
