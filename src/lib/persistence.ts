import type { AppState } from './types';
import { ensureStaffCredentials } from './auth';
import { createSeedData } from './seed';
import { maxReservationSeq } from './utils';

export const STORAGE_KEY = 'uyu-room-pms-v3';
export const BACKUP_KEY = 'uyu-room-pms-backup';
export const SNAPSHOTS_KEY = 'uyu-room-pms-snapshots';
export const ARCHIVE_KEY = 'uyu-room-pms-archive';
export const META_KEY = 'uyu-room-pms-meta';
const IDB_NAME = 'uyu-room-pms';
const IDB_STORE = 'state';
const LEGACY_KEYS = ['grand-horizon-pms-v2', 'grand-horizon-pms-v1'];

export interface Snapshot {
  id: string;
  ts: string;
  label: string;
  data: AppState;
}

export interface MetaInfo {
  lastSaved: string;
  saveCount: number;
  version: number;
}

function isValidState(data: unknown): data is AppState {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<AppState>;
  return (
    Array.isArray(d.rooms) &&
    Array.isArray(d.guests) &&
    Array.isArray(d.reservations) &&
    Array.isArray(d.payments) &&
    Array.isArray(d.staff) &&
    Array.isArray(d.tasks) &&
    Array.isArray(d.activity) &&
    !!d.settings &&
    typeof d.currentUserId === 'string'
  );
}

/** Normalize legacy / partial payloads so the app never crashes on load. */
export function normalizeState(raw: AppState): AppState {
  const seed = createSeedData();
  const reservations = (Array.isArray(raw.reservations) ? raw.reservations : seed.reservations).map(
    (r) => ({
      ...r,
      extras: Array.isArray(r.extras) ? r.extras : [],
      companions: Array.isArray((r as any).companions) ? (r as any).companions : [],
      adults: r.adults ?? 1,
      children: r.children ?? 0,
      discount: r.discount ?? 0,
      taxRate: r.taxRate ?? seed.settings.taxRate,
      deposit: r.deposit ?? 0,
      notes: r.notes ?? '',
      source: r.source ?? 'Doğrudan',
      specialRequests: r.specialRequests ?? '',
    })
  );

  const fromCodes = maxReservationSeq(reservations.map((r) => r.code));
  const seq = Math.max(
    typeof raw.reservationSeq === 'number' ? raw.reservationSeq : 0,
    fromCodes,
    0
  );

  const settings = { ...seed.settings, ...(raw.settings || {}) };
  // Rebrand legacy installs
  if (!settings.name || /grand horizon/i.test(settings.name)) {
    settings.name = seed.settings.name;
    settings.logo = seed.settings.logo;
    settings.email = seed.settings.email;
  }

  const staff = ensureStaffCredentials(
    Array.isArray(raw.staff) ? raw.staff : seed.staff
  );

  // Merge staff salaries from seed if missing
  const seedStaffById = Object.fromEntries(seed.staff.map((s) => [s.id, s]));
  const staffWithSalary = staff.map((s) => ({
    ...s,
    salary: s.salary ?? seedStaffById[s.id]?.salary,
  }));

  // Oda durumu ile rezervasyon durumu arasinda olusabilecek sapmalari
  // (orn. rezervasyon "checked_in" oldugu halde oda "musait" kalmasi)
  // her yuklemede otomatik onar — boylece manuel durum degisikligi gibi
  // eski/farkli kod yollarindan kalan tutarsiz veriler de kendini duzeltir.
  const checkedInRoomIds = new Set(
    reservations.filter((r) => !r.deletedAt && r.status === 'checked_in').map((r) => r.roomId)
  );
  const rawRooms = Array.isArray(raw.rooms) ? raw.rooms : seed.rooms;
  const rooms = rawRooms.map((room) => {
    if (
      checkedInRoomIds.has(room.id) &&
      room.status !== 'occupied' &&
      room.status !== 'out_of_order' &&
      room.status !== 'maintenance'
    ) {
      return { ...room, status: 'occupied' as const };
    }
    return room;
  });

  return {
    rooms,
    guests: Array.isArray(raw.guests) ? raw.guests : seed.guests,
    reservations,
    payments: Array.isArray(raw.payments) ? raw.payments : seed.payments,
    staff: staffWithSalary,
    tasks: Array.isArray(raw.tasks) ? raw.tasks : seed.tasks,
    activity: Array.isArray(raw.activity) ? raw.activity : [],
    settings,
    currentUserId: raw.currentUserId || seed.currentUserId,
    reservationSeq: seq,
    ledger: Array.isArray((raw as AppState).ledger) ? (raw as AppState).ledger! : seed.ledger,
    recurringExpenses: Array.isArray((raw as AppState).recurringExpenses)
      ? (raw as AppState).recurringExpenses!
      : seed.recurringExpenses,
    staffDebts: Array.isArray((raw as AppState).staffDebts) ? (raw as AppState).staffDebts! : (seed.staffDebts || []),
    staffDebtPayments: Array.isArray((raw as AppState).staffDebtPayments)
      ? (raw as AppState).staffDebtPayments!
      : (seed.staffDebtPayments || []),
    invoices: Array.isArray((raw as AppState).invoices) ? (raw as AppState).invoices! : (seed.invoices || []),
    archive: Array.isArray(raw.archive) ? raw.archive : [],
    maintenanceIssues: Array.isArray((raw as AppState).maintenanceIssues)
      ? (raw as AppState).maintenanceIssues!
      : [],
    menuItems: Array.isArray((raw as AppState).menuItems) ? (raw as AppState).menuItems! : [],
    cafeOrders: Array.isArray((raw as AppState).cafeOrders) ? (raw as AppState).cafeOrders! : [],
  };
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('localStorage write failed', key, err);
    return false;
  }
}

function openIDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet(data: AppState): Promise<boolean> {
  const db = await openIDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, 'main');
      tx.objectStore(IDB_STORE).put({ ts: new Date().toISOString(), data }, `snap_${Date.now()}`);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

export async function idbGet(): Promise<AppState | null> {
  const db = await openIDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('main');
      req.onsuccess = () => {
        db.close();
        const val = req.result;
        resolve(isValidState(val) ? normalizeState(val) : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/** Try every storage layer — never return empty if any copy exists. */
export function loadStateSync(): AppState {
  const primary = readJSON<AppState>(STORAGE_KEY);
  if (isValidState(primary)) return normalizeState(primary);

  for (const key of LEGACY_KEYS) {
    const legacy = readJSON<AppState>(key);
    if (isValidState(legacy)) return normalizeState(legacy);
  }

  const backup = readJSON<AppState>(BACKUP_KEY);
  if (isValidState(backup)) return normalizeState(backup);
  const legacyBackup = readJSON<AppState>('grand-horizon-pms-backup');
  if (isValidState(legacyBackup)) return normalizeState(legacyBackup);

  const snaps = readJSON<Snapshot[]>(SNAPSHOTS_KEY);
  if (Array.isArray(snaps) && snaps.length) {
    const last = snaps[snaps.length - 1];
    if (last && isValidState(last.data)) return normalizeState(last.data);
  }

  return createSeedData();
}

export async function loadStateAsync(): Promise<AppState> {
  const sync = loadStateSync();
  // Prefer the newest valid copy between localStorage and IndexedDB
  const idb = await idbGet();
  if (!idb) return sync;

  const syncMeta = readJSON<MetaInfo>(META_KEY);
  // If sync is still seed-like empty and idb has more data, use idb
  const score = (s: AppState) =>
    s.reservations.length * 10 + s.guests.length * 5 + s.payments.length * 3 + s.rooms.length + s.activity.length;
  if (score(idb) > score(sync)) return idb;
  // If timestamps suggest idb is newer via activity
  const idbLast = idb.activity[0]?.timestamp ?? '';
  const syncLast = sync.activity[0]?.timestamp ?? syncMeta?.lastSaved ?? '';
  if (idbLast && idbLast > syncLast && score(idb) >= score(sync)) return idb;
  return sync;
}

export function getMeta(): MetaInfo {
  return (
    readJSON<MetaInfo>(META_KEY) ?? {
      lastSaved: '',
      saveCount: 0,
      version: 2,
    }
  );
}

export function saveState(data: AppState): { ok: boolean; error?: string } {
  const normalized = normalizeState(data);
  const payload = JSON.stringify(normalized);

  // 1) Rotate previous primary into backup before overwrite — BACKUP_KEY
  // boylece gercekten "bir onceki kayit" olur, kopyasi degil. Bu ayni
  // zamanda her kayitta gereken depolama alanini yariya indirir
  // (eskiden ayni veri hem STORAGE_KEY hem BACKUP_KEY'e yazilip
  // depolama kotasini gereksiz yere iki katina cikariyordu).
  try {
    const prev = localStorage.getItem(STORAGE_KEY);
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
  } catch {
    /* continue */
  }

  try {
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (err) {
    // Quota asildi. Once eski (Supabase Storage'a tasinmadan onceki) base64
    // gomulu gorselleri temizleyip dene — asil sisme sebebi genelde bu
    // birkac yuz KB'lik data:image metinleridir, aktivite kaydi degil.
    try {
      const stripHeavyImages = <T extends { imageUrl?: string }>(arr: T[] = []): T[] =>
        arr.map((x) =>
          x.imageUrl && x.imageUrl.startsWith('data:image') ? { ...x, imageUrl: undefined } : x
        );
      const lean = normalizeState({
        ...normalized,
        activity: normalized.activity.slice(0, 50),
        menuItems: stripHeavyImages(normalized.menuItems),
        settings: {
          ...normalized.settings,
          orderPageBanners: (normalized.settings.orderPageBanners || []).filter(
            (b) => !b.startsWith('data:image')
          ),
        },
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lean));
    } catch (err2) {
      return { ok: false, error: String(err2) };
    }
  }

  const meta = getMeta();
  const nextMeta: MetaInfo = {
    lastSaved: new Date().toISOString(),
    saveCount: (meta.saveCount || 0) + 1,
    version: 2,
  };
  writeJSON(META_KEY, nextMeta);

  // Snapshot every 10 saves or first save
  if (nextMeta.saveCount === 1 || nextMeta.saveCount % 10 === 0) {
    pushSnapshot(normalized, `Otomatik #${nextMeta.saveCount}`);
  }

  // Fire-and-forget IndexedDB
  void idbSet(normalized);

  return { ok: true };
}

export function pushSnapshot(data: AppState, label: string): void {
  const snaps = readJSON<Snapshot[]>(SNAPSHOTS_KEY) ?? [];
  const snap: Snapshot = {
    id: `snap_${Date.now()}`,
    ts: new Date().toISOString(),
    label,
    data: normalizeState(data),
  };
  const next = [...snaps, snap].slice(-15); // keep last 15
  writeJSON(SNAPSHOTS_KEY, next);
}

export function listSnapshots(): Snapshot[] {
  const snaps = readJSON<Snapshot[]>(SNAPSHOTS_KEY) ?? [];
  return [...snaps].reverse();
}

export function restoreSnapshot(id: string): AppState | null {
  const snaps = readJSON<Snapshot[]>(SNAPSHOTS_KEY) ?? [];
  const found = snaps.find((s) => s.id === id);
  if (!found || !isValidState(found.data)) return null;
  const data = normalizeState(found.data);
  // Keep current as snapshot before restore
  const current = loadStateSync();
  pushSnapshot(current, 'Geri yükleme öncesi');
  saveState(data);
  return data;
}

export function restoreFromBackup(): AppState | null {
  const backup = readJSON<AppState>(BACKUP_KEY);
  if (!isValidState(backup)) return null;
  const current = loadStateSync();
  pushSnapshot(current, 'Yedekten dönmeden önce');
  const data = normalizeState(backup);
  saveState(data);
  return data;
}

/** Safe reset: always snapshot first, never leave storage empty. */
export function safeResetToSeed(): AppState {
  const current = loadStateSync();
  pushSnapshot(current, 'Sıfırlama öncesi tam yedek');
  // also dump archive
  try {
    const archive = readJSON<unknown[]>(ARCHIVE_KEY) ?? [];
    archive.push({ ts: new Date().toISOString(), type: 'full-reset', data: current });
    writeJSON(ARCHIVE_KEY, archive.slice(-20));
  } catch {
    /* ignore */
  }
  const fresh = createSeedData();
  saveState(fresh);
  return fresh;
}

export function appendArchive(entry: { type: string; item: unknown; at: string }): void {
  try {
    const archive = readJSON<unknown[]>(ARCHIVE_KEY) ?? [];
    archive.push(entry);
    writeJSON(ARCHIVE_KEY, archive.slice(-500));
  } catch {
    /* ignore */
  }
}

export function downloadFullBackup(data: AppState): void {
  const bundle = {
    exportedAt: new Date().toISOString(),
    version: 2,
    data: normalizeState(data),
    snapshots: listSnapshots().map((s) => ({ id: s.id, ts: s.ts, label: s.label })),
    meta: getMeta(),
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pms-guvenli-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
