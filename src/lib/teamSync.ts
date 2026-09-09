/**
 * Coklu personel senkronu — Supabase (ucretsiz, gercek online DB)
 * Google Sheets CORS sorunlarina alternatif.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppState, Payment, Reservation } from './types';
import { normalizeState } from './persistence';

export const TEAM_URL_KEY = 'uyu-team-supabase-url';
export const TEAM_KEY_KEY = 'uyu-team-supabase-anon';
export const TEAM_ON_KEY = 'uyu-team-enabled';
export const TEAM_META_KEY = 'uyu-team-meta';
export const TEAM_HOTEL_ID = 'uyu-room-main';

/** Ortak proje — tum personel ayni DB */
export const BUILTIN_SUPABASE_URL = 'https://yhlfesjjzwmydulixckf.supabase.co';
export const BUILTIN_SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlobGZlc2pqendteWR1bGl4Y2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDk0ODcsImV4cCI6MjEwMTQyNTQ4N30.jvHSq5S99y7U5U6L4bWM7q-VaYxATmHKmgBjlJTUsTs';

export interface TeamMeta {
  status: 'off' | 'idle' | 'syncing' | 'ok' | 'error';
  lastPullAt?: string;
  lastPushAt?: string;
  lastVersion?: number;
  lastError?: string;
  lastBy?: string;
}

export function getTeamUrl(): string {
  try {
    const u = (localStorage.getItem(TEAM_URL_KEY) || '').trim().replace(/\/$/, '');
    return u || BUILTIN_SUPABASE_URL;
  } catch {
    return BUILTIN_SUPABASE_URL;
  }
}

export function getTeamKey(): string {
  try {
    const k = (localStorage.getItem(TEAM_KEY_KEY) || '').trim();
    return k || BUILTIN_SUPABASE_ANON;
  } catch {
    return BUILTIN_SUPABASE_ANON;
  }
}

export function setTeamCreds(url: string, anonKey: string) {
  localStorage.setItem(TEAM_URL_KEY, url.trim().replace(/\/$/, ''));
  localStorage.setItem(TEAM_KEY_KEY, anonKey.trim());
}

export function isTeamEnabled(): boolean {
  try {
    // Builtin varsa her zaman online (personel ayar yapmasin)
    if (getTeamUrl() && getTeamKey()) {
      if (localStorage.getItem(TEAM_ON_KEY) !== '0') return true;
    }
    return localStorage.getItem(TEAM_ON_KEY) === '1' && !!(getTeamUrl() && getTeamKey());
  } catch {
    return true;
  }
}

export function setTeamEnabled(on: boolean) {
  localStorage.setItem(TEAM_ON_KEY, on ? '1' : '0');
}

export function getTeamMeta(): TeamMeta {
  try {
    const raw = localStorage.getItem(TEAM_META_KEY);
    if (raw) return JSON.parse(raw) as TeamMeta;
  } catch {
    /* ignore */
  }
  return { status: 'off' };
}

export function setTeamMeta(patch: Partial<TeamMeta>) {
  const next = { ...getTeamMeta(), ...patch };
  localStorage.setItem(TEAM_META_KEY, JSON.stringify(next));
  return next;
}

export function applyTeamFromQuery(): boolean {
  try {
    const sp = new URLSearchParams(window.location.search);
    const url = (sp.get('sburl') || sp.get('supabase') || '').trim();
    const key = (sp.get('sbkey') || sp.get('anon') || '').trim();
    if (url && key && url.includes('supabase')) {
      setTeamCreds(url, key);
      setTeamEnabled(true);
      setTeamMeta({ status: 'idle' });
      const u = new URL(window.location.href);
      ['sburl', 'supabase', 'sbkey', 'anon'].forEach((k) => u.searchParams.delete(k));
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}


export async function bootstrapTeamConnection(): Promise<{ ok: boolean; source: string }> {
  applyTeamFromQuery();
  try {
    const res = await fetch(`/team-config.json?_=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const cfg = (await res.json()) as {
        supabaseUrl?: string;
        supabaseAnonKey?: string;
        enabled?: boolean;
      };
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        setTeamCreds(cfg.supabaseUrl, cfg.supabaseAnonKey);
        resetSupabaseClient();
        if (cfg.enabled !== false) setTeamEnabled(true);
        return { ok: true, source: 'config' };
      }
    }
  } catch {
    /* ignore */
  }
  // builtin
  // Her zaman builtin yaz — tum cihazlar ayni DB
  setTeamCreds(BUILTIN_SUPABASE_URL, BUILTIN_SUPABASE_ANON);
  resetSupabaseClient();
  setTeamEnabled(true);
  return { ok: true, source: 'builtin' };
}

export function buildTeamInviteLink(
  appOrigin = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const url = getTeamUrl();
  const key = getTeamKey();
  if (!url || !key) return appOrigin;
  return `${appOrigin}/?sburl=${encodeURIComponent(url)}&sbkey=${encodeURIComponent(key)}`;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = getTeamUrl();
  const key = getTeamKey();
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function resetSupabaseClient() {
  client = null;
}

/** SQL — Supabase SQL Editor'e bir kez yapistirin */
export const TEAM_SQL = `-- UYU ROOM - TEK SEFERLIK KURULUM
-- Supabase > SQL Editor > New query
-- Hepsini secip RUN basin

create table if not exists public.uyu_hotel_live (
  id text primary key,
  payload jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text
);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table public.uyu_hotel_live to anon, authenticated, service_role;

-- Gunluk otomatik yedekleme tablosu (her gun icin bir kayit, YYYY-MM-DD id)
create table if not exists public.uyu_hotel_backups (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on table public.uyu_hotel_backups to anon, authenticated, service_role;
alter table public.uyu_hotel_backups disable row level security;
`;

export async function teamPing(): Promise<{ ok: boolean; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Supabase URL ve anon key girin' };
  try {
    const { data, error } = await sb.from('uyu_hotel_live').select('id,version,updated_at,updated_by').eq('id', TEAM_HOTEL_ID).maybeSingle();
    if (error) {
      return {
        ok: false,
        message: `Baglanti hatasi: ${error.message}. SQL tablosunu olusturdunuz mu?`,
      };
    }
    if (!data) {
      return { ok: true, message: 'Baglanti OK · tablo bos (Ilk yukleme yapin)' };
    }
    return {
      ok: true,
      message: `Baglanti OK · v${data.version} · ${data.updated_by || '-'} · ${data.updated_at || ''}`,
    };
  } catch (e) {
    return { ok: false, message: String(e instanceof Error ? e.message : e) };
  }
}

export async function teamPull(): Promise<{ data: AppState; version: number; updatedBy?: string } | null> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase ayarli degil');
  const { data, error } = await sb
    .from('uyu_hotel_live')
    .select('payload,version,updated_by')
    .eq('id', TEAM_HOTEL_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.payload) return null;
  return {
    data: normalizeState(data.payload as AppState),
    version: Number(data.version || 0),
    updatedBy: data.updated_by || undefined,
  };
}

export async function teamPush(
  state: AppState,
  userName: string,
  opts?: { force?: boolean; expectedVersion?: number }
): Promise<{ version: number }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase ayarli degil');

  // Mevcut version
  const { data: cur } = await sb
    .from('uyu_hotel_live')
    .select('version')
    .eq('id', TEAM_HOTEL_ID)
    .maybeSingle();

  const currentVer = Number(cur?.version || 0);
  const nextVer = currentVer + 1;
  const row = {
    id: TEAM_HOTEL_ID,
    payload: state,
    version: nextVer,
    updated_at: new Date().toISOString(),
    updated_by: userName || 'Personel',
  };

  if (!cur) {
    const { error } = await sb.from('uyu_hotel_live').insert(row);
    if (error) throw new Error(error.message);
    return { version: nextVer };
  }

  // Upsert — force ile her zaman yaz
  const { error } = await sb.from('uyu_hotel_live').upsert(row, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return { version: nextVer };
}

export function mergeAppStates(remote: AppState, local: AppState): AppState {
  const base = normalizeState(remote);
  const loc = normalizeState(local);

  const mergeById = <T extends { id: string; deletedAt?: string }>(a: T[], b: T[]): T[] => {
    const map = new Map<string, T>();
    a.forEach((x) => map.set(x.id, x));
    // b (override) her zaman tam olarak kazanir — silme/iptal dahil hicbir
    // alan sessizce kaybolmasin (eski kosullu mantik silme bilgisini bazen dusuruyordu)
    b.forEach((x) => map.set(x.id, x));
    return Array.from(map.values());
  };

  return normalizeState({
    ...base,
    rooms: mergeById(base.rooms || [], loc.rooms || []),
    guests: mergeById(base.guests || [], loc.guests || []),
    reservations: mergeById(base.reservations || [], loc.reservations || []) as Reservation[],
    payments: mergeById(base.payments || [], loc.payments || []) as Payment[],
    staff: mergeById(base.staff || [], loc.staff || []),
    ledger: mergeById(base.ledger || [], loc.ledger || []),
    invoices: mergeById(base.invoices || [], loc.invoices || []),
    tasks: mergeById(base.tasks || [], loc.tasks || []),
    activity: [...(loc.activity || []), ...(base.activity || [])]
      .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
      .slice(0, 300),
    reservationSeq: Math.max(base.reservationSeq || 0, loc.reservationSeq || 0, 0),
    staffDebts: mergeById(base.staffDebts || [], loc.staffDebts || []),
    staffDebtPayments: mergeById(base.staffDebtPayments || [], loc.staffDebtPayments || []),
    recurringExpenses: mergeById(base.recurringExpenses || [], loc.recurringExpenses || []),
    maintenanceIssues: mergeById(base.maintenanceIssues || [], loc.maintenanceIssues || []),
    menuItems: mergeById(base.menuItems || [], loc.menuItems || []),
    cafeOrders: mergeById(base.cafeOrders || [], loc.cafeOrders || []),
    // ONEMLI: settings daha once merge listesine dahil degildi, bu yuzden
    // her senkron turunda "base" (uzak) tarafin ESKI ayarlari sessizce
    // kazaniyordu — yeni eklenen banner gorseli vb. bir an gorunup hemen
    // ardindan siliniyormus gibi oluyordu. Simdi diger her sey gibi
    // override (loc) taraf kazaniyor.
    settings: { ...base.settings, ...loc.settings },
    currentUserId: loc.currentUserId || base.currentUserId,
  });
}

/** Pull + merge + push — kayip olmasin */
export async function teamSyncRoundTrip(
  local: AppState,
  userName: string
): Promise<{ state: AppState; version: number }> {
  let remote: Awaited<ReturnType<typeof teamPull>> = null;
  try {
    remote = await teamPull();
  } catch {
    remote = null;
  }
  const merged = remote?.data ? mergeAppStates(remote.data, local) : local;
  const { version } = await teamPush(merged, userName, { force: true });
  return { state: merged, version };
}

export interface BackupInfo {
  id: string; // YYYY-MM-DD
  createdAt: string;
}

/** Son N gunlik yedek listesini getirir (en yeni once) */
export async function listBackups(limit = 30): Promise<BackupInfo[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('uyu_hotel_backups')
    .select('id,created_at')
    .order('id', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id as string, createdAt: r.created_at as string }));
}

/** Secilen gunun yedegini getirir (henuz uygulamaz) */
export async function fetchBackup(id: string): Promise<AppState | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('uyu_hotel_backups')
    .select('payload')
    .eq('id', id)
    .maybeSingle();
  if (error || !data?.payload) return null;
  return normalizeState(data.payload as AppState);
}

/** Secilen yedegi CANLI veri olarak zorla yazar (geri yukleme) */
export async function restoreBackup(id: string, userName: string): Promise<AppState | null> {
  const backup = await fetchBackup(id);
  if (!backup) return null;
  await teamPush(backup, userName, { force: true });
  return backup;
}

const IMAGE_BUCKET = 'uyu-images';

/** Bir gorseli Supabase Storage'a yukler, herkese acik URL dondurur.
 * Boylece buyuk base64 resimler localStorage/senkron payload'ina hic girmez. */
export async function uploadPublicImage(blob: Blob, pathHint: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const path = `${pathHint}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await sb.storage
      .from(IMAGE_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) return null;
    const { data } = sb.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}

export type TeamRealtimeUnsub = () => void;

// ---- Uygulama ici sohbet (personel arasi) ----
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

function mapChatRow(row: any): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    message: row.message,
    createdAt: row.created_at,
  };
}

export async function fetchRecentChatMessages(limit = 50): Promise<ChatMessage[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('uyu_chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(mapChatRow).reverse();
}

export async function sendChatMessage(
  senderId: string,
  senderName: string,
  message: string
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from('uyu_chat_messages')
    .insert({ sender_id: senderId, sender_name: senderName, message });
  return !error;
}

export function subscribeChatMessages(onMessage: (msg: ChatMessage) => void): TeamRealtimeUnsub {
  const sb = getSupabase();
  if (!sb) return () => undefined;
  const ch = sb
    .channel('uyu-chat-messages')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'uyu_chat_messages' },
      (payload: { new: any }) => onMessage(mapChatRow(payload.new))
    )
    .subscribe();
  return () => void sb.removeChannel(ch);
}

// ---- Sohbet "okundu" bilgisi ----
export interface ChatRead {
  staffId: string;
  staffName: string;
  lastReadAt: string;
}

function mapReadRow(row: any): ChatRead {
  return { staffId: row.staff_id, staffName: row.staff_name, lastReadAt: row.last_read_at };
}

export async function fetchChatReads(): Promise<ChatRead[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('uyu_chat_reads').select('*');
  if (error || !data) return [];
  return data.map(mapReadRow);
}

/** Bu personelin sohbeti su ana kadar okudugunu bildirir (upsert). */
export async function markChatRead(staffId: string, staffName: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from('uyu_chat_reads')
    .upsert({ staff_id: staffId, staff_name: staffName, last_read_at: new Date().toISOString() });
}

export function subscribeChatReads(onChange: (read: ChatRead) => void): TeamRealtimeUnsub {
  const sb = getSupabase();
  if (!sb) return () => undefined;
  const ch = sb
    .channel('uyu-chat-reads')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'uyu_chat_reads' },
      (payload: { new: any }) => onChange(mapReadRow(payload.new))
    )
    .subscribe();
  return () => void sb.removeChannel(ch);
}


// ---- Canli personel varligi (kim su an hangi sayfada) ----
// Supabase Realtime Presence — veritabanina hic yazmadan, tarayicilar
// arasinda aninda senkronize olan hafif bir "kim nerede" mekanizmasi.
let presenceChannel: ReturnType<SupabaseClient['channel']> | null = null;
let presencePayload: { staffName: string; page: string } = { staffName: '', page: '' };

export type PresenceState = Record<string, { staffName: string; page: string; at: number }[]>;

export function joinPresence(
  staffId: string,
  staffName: string,
  onSync: (state: PresenceState) => void
): TeamRealtimeUnsub {
  const sb = getSupabase();
  if (!sb) return () => undefined;
  presencePayload = { staffName, page: presencePayload.page || '' };
  const ch = sb.channel('uyu-presence', { config: { presence: { key: staffId } } });
  ch.on('presence', { event: 'sync' }, () => {
    onSync(ch.presenceState() as PresenceState);
  });
  ch.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      void ch.track({ ...presencePayload, at: Date.now() });
    }
  });
  presenceChannel = ch;
  // Sayfa degismese bile personel hala orada demektir — 40sn'de bir
  // "hala aktifim" sinyali gonder, yoksa uzun sure ayni sayfada kalan
  // personel yanlislikla "cevrimdisi/gitti" gibi gorunurdu.
  const heartbeat = setInterval(() => {
    if (presenceChannel) void presenceChannel.track({ ...presencePayload, at: Date.now() });
  }, 40000);
  return () => {
    clearInterval(heartbeat);
    void sb.removeChannel(ch);
    presenceChannel = null;
  };
}

/** Aktif sayfa degistiginde cagrilir — diger cihazlar aninda gorur */
export function setPresencePage(page: string) {
  presencePayload = { ...presencePayload, page };
  if (presenceChannel) void presenceChannel.track({ ...presencePayload, at: Date.now() });
}


export function subscribeTeamRealtime(onChange: () => void): TeamRealtimeUnsub {
  const sb = getSupabase();
  if (!sb) return () => undefined;
  const ch = sb
    .channel('uyu_hotel_live_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'uyu_hotel_live', filter: `id=eq.${TEAM_HOTEL_ID}` },
      () => onChange()
    )
    .subscribe();
  return () => {
    void sb.removeChannel(ch);
  };
}
