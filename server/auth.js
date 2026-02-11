import crypto from 'crypto';

export class SessionManager {
  constructor(secret) {
    this.secret = secret;
    this.sessions = new Map(); // token -> { username, createdAt }
  }

  create(username) {
    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, { username, createdAt: Date.now() });
    return token;
  }

  validate(token) {
    return this.sessions.get(token) || null;
  }

  destroy(token) {
    this.sessions.delete(token);
  }
}
