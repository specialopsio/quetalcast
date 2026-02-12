import crypto from 'crypto';
import { createStatsLogger } from './logger.js';

const MAX_RECEIVERS = 4;

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
      receivers: new Map(), // receiverId → ws
      metadata: null, // now-playing text
      trackList: [],  // { title, time } — chronological track list
      integrationInfo: null, // { type, credentials } — active integration connection
      createdAt: new Date().toISOString(),
    });
    return roomId;
  }

  join(roomId, role, ws) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    }

    if (role !== 'broadcaster' && role !== 'receiver') {
      return { ok: false, error: 'Invalid role', code: 'INVALID_ROLE' };
    }

    if (role === 'broadcaster') {
      // Lock broadcaster slot — reject if another broadcaster is already live
      if (room.broadcaster && room.broadcaster.readyState === 1) {
        this.logger.warn({ roomId: roomId.slice(0, 8) }, 'Broadcaster join rejected — slot occupied');
        return { ok: false, error: 'Broadcast already in progress', code: 'BROADCASTER_OCCUPIED' };
      }
      room.broadcaster = ws;
      return { ok: true };
    }

    // Receiver — enforce max
    if (room.receivers.size >= MAX_RECEIVERS) {
      this.logger.warn({ roomId: roomId.slice(0, 8) }, 'Receiver join rejected — room full');
      return { ok: false, error: 'Room is full', code: 'ROOM_FULL' };
    }

    const receiverId = crypto.randomBytes(4).toString('hex');
    room.receivers.set(receiverId, ws);
    return { ok: true, receiverId };
  }

  leave(roomId, role, receiverId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (role === 'broadcaster') {
      room.broadcaster = null;
    } else if (role === 'receiver' && receiverId) {
      room.receivers.delete(receiverId);
    }

    // Clean up empty rooms
    if (!room.broadcaster && room.receivers.size === 0) {
      this.rooms.delete(roomId);
      this.logger.info({ roomId: roomId.slice(0, 8) }, 'Room destroyed (empty)');
    }
  }

  getBroadcaster(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.broadcaster || room.broadcaster.readyState !== 1) return null;
    return room.broadcaster;
  }

  getReceiver(roomId, receiverId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const ws = room.receivers.get(receiverId);
    if (ws && ws.readyState === 1) return ws;
    return null;
  }

  /** Returns all live receiverIds */
  getReceiverIds(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    const ids = [];
    for (const [id, ws] of room.receivers) {
      if (ws.readyState === 1) ids.push(id);
    }
    return ids;
  }

  /** Find the receiverId associated with a WebSocket */
  findReceiverIdByWs(roomId, ws) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    for (const [id, rws] of room.receivers) {
      if (rws === ws) return id;
    }
    return null;
  }

  setMetadata(roomId, text, cover) {
    const room = this.rooms.get(roomId);
    if (room) room.metadata = text ? { text, cover: cover || null } : null;
  }

  getMetadata(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.metadata : null;
  }

  /**
   * Add a track entry with rich metadata.
   * @param {string} roomId
   * @param {object} meta — { text, cover, coverMedium, artist, title, album, duration,
   *   releaseDate, isrc, bpm, trackPosition, diskNumber, explicitLyrics,
   *   contributors, label, genres }
   */
  addTrack(roomId, meta) {
    const room = this.rooms.get(roomId);
    if (!room || !meta?.text) return;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { title: meta.text, time };
    // Attach optional rich fields if present
    if (meta.cover) entry.cover = meta.cover;
    if (meta.coverMedium) entry.coverMedium = meta.coverMedium;
    if (meta.artist) entry.artist = meta.artist;
    if (meta.title) entry.trackTitle = meta.title; // "title" is the display string; trackTitle is the song name
    if (meta.album) entry.album = meta.album;
    if (meta.duration) entry.duration = meta.duration;
    if (meta.releaseDate) entry.releaseDate = meta.releaseDate;
    if (meta.isrc) entry.isrc = meta.isrc;
    if (meta.bpm) entry.bpm = meta.bpm;
    if (meta.trackPosition) entry.trackPosition = meta.trackPosition;
    if (meta.diskNumber) entry.diskNumber = meta.diskNumber;
    if (meta.explicitLyrics) entry.explicitLyrics = meta.explicitLyrics;
    if (meta.contributors?.length) entry.contributors = meta.contributors;
    if (meta.label) entry.label = meta.label;
    if (meta.genres?.length) entry.genres = meta.genres;

    room.trackList.unshift(entry); // newest first
    // Cap at 100 tracks
    if (room.trackList.length > 100) room.trackList.length = 100;
  }

  getTrackList(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.trackList : [];
  }

  setIntegrationInfo(roomId, info) {
    const room = this.rooms.get(roomId);
    if (room) room.integrationInfo = info || null;
  }

  getIntegrationInfo(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.integrationInfo : null;
  }

  listRooms() {
    const result = [];
    for (const [, room] of this.rooms) {
      result.push({
        roomId: room.roomId,
        broadcaster: !!room.broadcaster,
        receivers: room.receivers.size,
        createdAt: room.createdAt,
      });
    }
    return result;
  }

  logStats(roomId, role, data) {
    // Sanitize: only allow primitive values, block prototype pollution
    const safe = {};
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, val] of Object.entries(data)) {
        if (key === '__proto__' || key === 'constructor' || key === 'roomId' || key === 'role') continue;
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          safe[key] = val;
        }
      }
    }
    this.statsLogger.info({
      roomId: roomId.slice(0, 8),
      role,
      ...safe,
    });
  }
}
