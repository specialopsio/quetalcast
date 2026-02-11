const AUTH_KEY = 'webrtc-bridge-auth';

export interface AuthSession {
  username: string;
  timestamp: number;
}

export async function login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      const data = await res.json();
      const session: AuthSession = {
        username: data.username,
        timestamp: Date.now(),
      };
      localStorage.setItem(AUTH_KEY, JSON.stringify(session));
      return { ok: true };
    }

    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    return { ok: false, error: err.error || 'Invalid credentials' };
  } catch {
    return { ok: false, error: 'Could not reach server' };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore network errors during logout
  }
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
