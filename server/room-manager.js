import crypto from 'crypto';
import { createStatsLogger } from './logger.js';

const MAX_RECEIVERS = 4;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class RoomManager {
  constructor(logger) {
    this.rooms = new Map();
    this.logger = logger;
    this.statsLogger = createStatsLogger();
    this.cleanupInterval = setInterval(() => this.cleanupExpiredRooms(), 15 * 60 * 1000); // every 15 min
  }

  cleanupExpiredRooms() {
    const cutoff = new Date(Date.now() - ROOM_TTL_MS).toISOString();
    for (const [id, room] of this.rooms) {
      if (room.endedAt && room.endedAt < cutoff) {
        this.rooms.delete(id);
        this.logger.info({ roomId: id.slice(0, 8) }, 'Room expired (24h TTL)');
      }
    }
  }

  create() {
    const roomId = crypto.randomBytes(4).toString('hex').slice(0, 7);
    this.rooms.set(roomId, {
      roomId,
      broadcaster: null,
      receivers: new Map(), // receiverId → ws
      metadata: null, // now-playing text
      trackList: [],  // { title, time } — chronological track list
      chatHistory: [], // { name, text, time, system? } — persisted chat messages
      chatParticipants: new Map(), // participantId (receiverId or 'broadcaster') → { name }
      integrationInfo: null, // { type, credentials } — active integration connection
      createdAt: new Date().toISOString(),
      endedAt: null, // set when broadcaster leaves; room kept for 24h
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
      room.endedAt = new Date().toISOString();
      this.logger.info({ roomId: roomId.slice(0, 8) }, 'Broadcast ended — room kept for 24h');
    } else if (role === 'receiver' && receiverId) {
      room.receivers.delete(receiverId);
    }

    // Only delete room if it was never used (no track list, no chat) and empty
    // Rooms with endedAt are kept for 24h via cleanupExpiredRooms
    const hasContent = (room.trackList?.length || 0) > 0 || (room.chatHistory?.length || 0) > 0;
    if (!room.broadcaster && room.receivers.size === 0 && !room.endedAt && !hasContent) {
      this.rooms.delete(roomId);
      this.logger.info({ roomId: roomId.slice(0, 8) }, 'Room destroyed (empty, unused)');
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
    const entry = { title: meta.text, time: new Date().toISOString() };
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

  /**
   * Add a chat message to the room history.
   * @param {string} roomId
   * @param {object} msg — { name, text, system? }
   */
  addChat(roomId, msg) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.chatHistory.push({
      name: msg.name,
      text: msg.text,
      time: new Date().toISOString(),
      ...(msg.system ? { system: true } : {}),
    });
    // Cap at 200 messages
    if (room.chatHistory.length > 200) {
      room.chatHistory = room.chatHistory.slice(-200);
    }
  }

  getChatHistory(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.chatHistory : [];
  }

  /** Add a chat participant (when they send their first message). Returns true if newly added. */
  addChatParticipant(roomId, participantId, name) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const had = room.chatParticipants.has(participantId);
    room.chatParticipants.set(participantId, { name });
    return !had;
  }

  /** Get and remove a chat participant (when they leave). Returns their name or null. */
  removeChatParticipant(roomId, participantId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const p = room.chatParticipants.get(participantId);
    room.chatParticipants.delete(participantId);
    return p?.name ?? null;
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
