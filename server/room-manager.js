import crypto from 'crypto';
import { createStatsLogger } from './logger.js';

export class RoomManager {
  constructor(logger) {
    this.rooms = new Map();
    this.logger = logger;
    this.statsLogger = createStatsLogger();
  }

  create() {
    const roomId = crypto.randomBytes(4).toString('hex').slice(0, 7);
    this.rooms.set(roomId, {
      roomId,
      broadcaster: null,
      receiver: null,
      createdAt: new Date().toISOString(),
    });
    return roomId;
  }

  join(roomId, role, ws) {
    let room = this.rooms.get(roomId);

    // Auto-create room if joining as receiver and room doesn't exist
    if (!room && role === 'receiver') {
      return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    }
    if (!room) {
      return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    }

    if (role !== 'broadcaster' && role !== 'receiver') {
      return { ok: false, error: 'Invalid role', code: 'INVALID_ROLE' };
    }

    // Disconnect prior client if same role
    if (room[role]) {
      try {
        room[role].send(JSON.stringify({ type: 'error', message: 'Replaced by new connection', code: 'REPLACED' }));
        room[role].close();
      } catch {}
      this.logger.info({ roomId: roomId.slice(0, 8), role }, 'Prior client disconnected');
    }

    room[role] = ws;
    return { ok: true };
  }

  leave(roomId, role) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room[role] = null;

    // Clean up empty rooms
    if (!room.broadcaster && !room.receiver) {
      this.rooms.delete(roomId);
      this.logger.info({ roomId: roomId.slice(0, 8) }, 'Room destroyed (empty)');
    }
  }

  getPeer(roomId, role) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const ws = room[role];
    if (ws && ws.readyState === 1) return ws; // WebSocket.OPEN = 1
    return null;
  }

  listRooms() {
    const result = [];
    for (const [, room] of this.rooms) {
      result.push({
        roomId: room.roomId,
        broadcaster: !!room.broadcaster,
        receiver: !!room.receiver,
        createdAt: room.createdAt,
      });
    }
    return result;
  }

  logStats(roomId, role, data) {
    this.statsLogger.info({
      roomId: roomId.slice(0, 8),
      role,
      ...data,
    });
  }
}
