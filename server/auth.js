import crypto from 'crypto';

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Stateless session manager using HMAC-signed tokens.
 *
 * Tokens are self-contained: `base64(payload).base64(signature)`.
 * Validation only checks the signature and expiry — no in-memory state
 * is needed, so sessions survive server restarts.
 */
export class SessionManager {
  constructor(secret) {
    this.secret = secret;
  }

  /** Create a signed session token for the given username */
  create(username) {
    const payload = JSON.stringify({ username, iat: Date.now() });
    const payloadB64 = Buffer.from(payload).toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.secret)
      .update(payloadB64)
      .digest('base64url');
    return `${payloadB64}.${sig}`;
  }

  /** Validate a token. Returns { username, iat } or null. */
  validate(token) {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, sig] = parts;

    // Verify signature
    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(payloadB64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }

    // Decode payload
    try {
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      // Check expiry
      if (Date.now() - payload.iat > SESSION_TTL) return null;
      return { username: payload.username, createdAt: payload.iat };
    } catch {
      return null;
    }
  }

  /** No-op for stateless tokens (kept for API compatibility) */
  destroy(_token) {
    // Stateless — cookie clearing on the client is sufficient
  }
}
