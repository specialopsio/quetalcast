import crypto from 'crypto';

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
    const session = this.sessions.get(token);
    if (!session) return null;
    // Expire sessions after TTL
    if (Date.now() - session.createdAt > SESSION_TTL) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  destroy(token) {
    this.sessions.delete(token);
  }
}
