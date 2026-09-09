import type { Staff } from './types';

export const AUTH_SESSION_KEY = 'uyu-room-auth-session-v1';

export interface AuthSession {
  staffId: string;
  username: string;
  name: string;
  role: string;
  loggedInAt: string;
}

/** Built-in credentials (always accepted; also synced onto staff records) */
export const BUILTIN_ACCOUNTS: {
  username: string;
  password: string;
  staffId: string;
  role: string;
  name: string;
}[] = [
  { username: 'UYUROOM', password: '180364', staffId: 's1', role: 'admin', name: 'Yönetici' },
  { username: 'UYUMUDUR', password: 'Mudur364', staffId: 's6', role: 'manager', name: 'Ayhan Çelik' },
  { username: 'UYURESEP', password: 'Resep364', staffId: 's2', role: 'receptionist', name: 'Elif Acar' },
];

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    if (!s?.staffId || !s?.username) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

export function authenticate(
  username: string,
  password: string,
  staff: Staff[]
): { ok: true; session: AuthSession } | { ok: false; error: string } {
  const u = username.trim();
  const p = password;
  if (!u || !p) return { ok: false, error: 'Kullanıcı adı ve şifre gerekli' };

  // 1) Built-in accounts
  const builtin = BUILTIN_ACCOUNTS.find(
    (a) => a.username.toLowerCase() === u.toLowerCase() && a.password === p
  );
  if (builtin) {
    const st = staff.find((s) => s.id === builtin.staffId && !s.deletedAt && s.active);
    return {
      ok: true,
      session: {
        staffId: builtin.staffId,
        username: builtin.username,
        name: st?.name ?? builtin.name,
        role: st?.role ?? builtin.role,
        loggedInAt: new Date().toISOString(),
      },
    };
  }

  // 2) Staff-defined credentials
  const match = staff.find(
    (s) =>
      !s.deletedAt &&
      s.active &&
      s.username &&
      s.password &&
      s.username.toLowerCase() === u.toLowerCase() &&
      s.password === p
  );
  if (match) {
    return {
      ok: true,
      session: {
        staffId: match.id,
        username: match.username!,
        name: match.name,
        role: match.role,
        loggedInAt: new Date().toISOString(),
      },
    };
  }

  return { ok: false, error: 'Kullanıcı adı veya şifre hatalı' };
}

/** Ensure demo staff always have login credentials after migrations */
export function ensureStaffCredentials(staff: Staff[]): Staff[] {
  return staff.map((s) => {
    const b = BUILTIN_ACCOUNTS.find((a) => a.staffId === s.id);
    if (!b) return s;
    return {
      ...s,
      username: s.username || b.username,
      password: s.password || b.password,
      active: true,
    };
  });
}
