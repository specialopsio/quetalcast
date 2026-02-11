// Simple client-side auth for MVP. In production, auth is handled by the signaling server
// with httpOnly session cookies. This module provides the client-side session management.

const AUTH_KEY = 'webrtc-bridge-auth';

export interface AuthSession {
  username: string;
  token: string;
  timestamp: number;
}

export function login(username: string, password: string): boolean {
  // MVP hardcoded credentials - replace with server-side auth in production
  if (username === 'admin' && password === 'admin') {
    const session: AuthSession = {
      username,
      token: generateToken(),
      timestamp: Date.now(),
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    return true;
  }
  return false;
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}
