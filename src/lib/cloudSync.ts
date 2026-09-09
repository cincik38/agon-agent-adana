/** UYU ROOM — Google Sheets senkron (JSONP = CORS yok) */

import type { AppState, Payment, Reservation } from './types';
import { normalizeState } from './persistence';

export const CLOUD_URL_KEY = 'uyu-room-cloud-url';
export const CLOUD_ENABLED_KEY = 'uyu-room-cloud-enabled';
export const CLOUD_DEVICE_KEY = 'uyu-room-device-id';
export const CLOUD_META_KEY = 'uyu-room-cloud-meta';

export const BUILTIN_SHEETS_URL =
  'https://script.google.com/macros/s/AKfycbx2m5fILoloVCMD0ZA_WCuHl6Dyg4J-Pm9ImCie_Twen6HfwQNCyClRNTZc5lg_Ctw/exec';

export interface CloudEnvelope {
  version: number;
  updatedAt: string;
  updatedBy: string;
  deviceId: string;
  hotel?: string;
  data: AppState;
}

export interface CloudMeta {
  lastPullAt?: string;
  lastPushAt?: string;
  lastVersion?: number;
  lastError?: string;
  status: 'off' | 'idle' | 'syncing' | 'error' | 'ok';
}

export function normalizeExecUrl(url: string): string {
  return (url || '').trim().replace(/\/dev(\?|$)/, '/exec$1');
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(CLOUD_DEVICE_KEY);
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(CLOUD_DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'dev_unknown';
  }
}

export function getCloudUrl(): string {
  try {
    const u = normalizeExecUrl(localStorage.getItem(CLOUD_URL_KEY) || '');
    return u || BUILTIN_SHEETS_URL;
  } catch {
    return BUILTIN_SHEETS_URL;
  }
}

export function setCloudUrl(url: string) {
  localStorage.setItem(CLOUD_URL_KEY, normalizeExecUrl(url));
}

export function isCloudEnabled(): boolean {
  try {
    if (localStorage.getItem(CLOUD_ENABLED_KEY) === '0') return false;
    return !!getCloudUrl();
  } catch {
    return true;
  }
}

export function setCloudEnabled(on: boolean) {
  localStorage.setItem(CLOUD_ENABLED_KEY, on ? '1' : '0');
}

export function getCloudMeta(): CloudMeta {
  try {
    const raw = localStorage.getItem(CLOUD_META_KEY);
    if (raw) return JSON.parse(raw) as CloudMeta;
  } catch {
    /* ignore */
  }
  return { status: 'idle' };
}

export function setCloudMeta(patch: Partial<CloudMeta>) {
  const next = { ...getCloudMeta(), ...patch };
  localStorage.setItem(CLOUD_META_KEY, JSON.stringify(next));
  return next;
}

export function applyUrlFromQuery(): string {
  try {
    const sp = new URLSearchParams(window.location.search);
    const q = (sp.get('sheets') || sp.get('cloud') || sp.get('gas') || '').trim();
    if (q && (q.includes('script.google.com') || q.includes('macros'))) {
      setCloudUrl(q);
      setCloudEnabled(true);
      setCloudMeta({ status: 'idle' });
      const url = new URL(window.location.href);
      ['sheets', 'cloud', 'gas'].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      return normalizeExecUrl(q);
    }
  } catch {
    /* ignore */
  }
  return '';
}

export function buildStaffShareLink(
  webAppUrl?: string,
  appOrigin = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const u = normalizeExecUrl(webAppUrl || getCloudUrl() || BUILTIN_SHEETS_URL);
  return `${appOrigin}/?sheets=${encodeURIComponent(u)}`;
}

export async function bootstrapCloudConnection(): Promise<{
  url: string;
  enabled: boolean;
  source: string;
}> {
  const fromQuery = applyUrlFromQuery();
  if (fromQuery) return { url: fromQuery, enabled: true, source: 'link' };

  let source = 'builtin';
  try {
    const res = await fetch(`/cloud-config.json?_=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const cfg = (await res.json()) as { sheetsWebAppUrl?: string; enabled?: boolean };
      if (cfg.sheetsWebAppUrl) {
        setCloudUrl(cfg.sheetsWebAppUrl);
        source = 'config';
        if (cfg.enabled !== false) setCloudEnabled(true);
      }
    }
  } catch {
    /* ignore */
  }

  if (!localStorage.getItem(CLOUD_URL_KEY)) {
    setCloudUrl(BUILTIN_SHEETS_URL);
    source = 'builtin';
  }
  if (localStorage.getItem(CLOUD_ENABLED_KEY) !== '0') {
    setCloudEnabled(true);
  }
  return { url: getCloudUrl(), enabled: isCloudEnabled(), source };
}

/**
 * JSONP — <script> ile cagirir, CORS tamamen devre disi.
 * Apps Script out_() callback desteklemeli (v5).
 */
function jsonpRequest(url: string, params: Record<string, string> = {}, timeoutMs = 90000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const cb = 'uyuCB' + Date.now() + Math.random().toString(36).slice(2, 8);
    const base = normalizeExecUrl(url).split('#')[0];
    const q = new URLSearchParams({ ...params, callback: cb, _ts: String(Date.now()) });
    const src = `${base}?${q.toString()}`;

    const script = document.createElement('script');
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        delete (window as unknown as Record<string, unknown>)[cb];
      } catch {
        (window as unknown as Record<string, unknown>)[cb] = undefined;
      }
      script.remove();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Sheet zaman asimi. Apps Script v5 deploy + New version yapildi mi?'));
    }, timeoutMs);

    (window as unknown as Record<string, unknown>)[cb] = (data: unknown) => {
      cleanup();
      if (data && typeof data === 'object') {
        resolve(data as Record<string, unknown>);
      } else {
        reject(new Error('Gecersiz JSONP yaniti'));
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Sheet script yuklenemedi. URL /exec ve Anyone mi?'));
    };
    script.src = src;
    document.head.appendChild(script);
  });
}

export async function cloudPing(url = getCloudUrl()) {
  if (!url) return { ok: false as const, message: 'Web App URL yok' };
  try {
    const data = await jsonpRequest(url, { action: 'ping' }, 20000);
    if (data.ok) {
      return {
        ok: true as const,
        message: `Baglanti OK · ${String(data.hotel || 'UYU')} · v${Number(data.version || 0)}${data.jsonp ? ' · JSONP' : ''}`,
      };
    }
    return { ok: false as const, message: String(data.error || 'ok degil') };
  } catch (e) {
    return { ok: false as const, message: String(e instanceof Error ? e.message : e) };
  }
}

export async function cloudPull(url = getCloudUrl()): Promise<CloudEnvelope | null> {
  if (!url) throw new Error('URL yok');
  const data = await jsonpRequest(url, { action: 'pull' }, 90000);
  if (!data.ok) throw new Error(String(data.error || 'Pull basarisiz'));
  if (data.empty || !data.envelope) return null;
  const env = data.envelope as CloudEnvelope;
  return { ...env, data: normalizeState(env.data) };
}

export function mergeAppStates(remote: AppState, local: AppState): AppState {
  const base = normalizeState(remote);
  const loc = normalizeState(local);

  const mergeById = <T extends { id: string; deletedAt?: string }>(a: T[], b: T[]): T[] => {
    const map = new Map<string, T>();
    a.forEach((x) => map.set(x.id, x));
    b.forEach((x) => {
      const prev = map.get(x.id);
      if (!prev) {
        map.set(x.id, x);
        return;
      }
      if (prev.deletedAt && !x.deletedAt) map.set(x.id, x);
      else if (!x.deletedAt && !prev.deletedAt) map.set(x.id, { ...prev, ...x });
    });
    return Array.from(map.values());
  };

  const reservations = mergeById(base.reservations || [], loc.reservations || []) as Reservation[];
  const payments = mergeById(base.payments || [], loc.payments || []) as Payment[];

  return normalizeState({
    ...base,
    rooms: mergeById(base.rooms || [], loc.rooms || []),
    guests: mergeById(base.guests || [], loc.guests || []),
    reservations,
    payments,
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
    currentUserId: loc.currentUserId || base.currentUserId,
  });
}

/** GET chunk + JSONP — CORS yok, push guvenilir */
async function pushViaChunks(url: string, state: AppState, userName: string): Promise<CloudEnvelope> {
  const json = JSON.stringify(state);
  const CHUNK = 1000; // encode ile URL limiti icin guvenli
  const parts: string[] = [];
  for (let i = 0; i < json.length; i += CHUNK) {
    parts.push(json.slice(i, i + CHUNK));
  }
  const sid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const st = await jsonpRequest(url, {
    action: 'chunkStart',
    sid,
    total: String(parts.length),
    by: userName || 'Personel',
  });
  if (!st.ok) throw new Error(String(st.error || 'chunkStart hata — v5 script deploy edin'));

  for (let i = 0; i < parts.length; i++) {
    const r = await jsonpRequest(url, {
      action: 'chunk',
      sid,
      i: String(i),
      d: parts[i],
    });
    if (!r.ok) throw new Error(String(r.error || `chunk ${i} hata`));
  }

  const done = await jsonpRequest(url, { action: 'chunkCommit', sid, force: '1' }, 120000);
  if (done.conflict && done.envelope) {
    const err = new Error('CONFLICT') as Error & { envelope: CloudEnvelope };
    const env = done.envelope as CloudEnvelope;
    err.envelope = { ...env, data: normalizeState(env.data) };
    throw err;
  }
  if (!done.ok || !done.envelope) {
    throw new Error(
      String(done.error || 'chunkCommit hata') +
        ' — Apps Script v5 kodunu yapistirip New version Deploy edin.'
    );
  }
  const env = done.envelope as CloudEnvelope;
  return { ...env, data: normalizeState(env.data) };
}

export async function cloudPush(
  state: AppState,
  opts: { userName: string; expectedVersion?: number; force?: boolean },
  url = getCloudUrl()
): Promise<CloudEnvelope> {
  if (!url) throw new Error('URL yok');
  return pushViaChunks(url, state, opts.userName || 'Personel');
}

export async function cloudSyncRoundTrip(
  local: AppState,
  userName: string
): Promise<{ state: AppState; version: number }> {
  const url = getCloudUrl();
  if (!url) throw new Error('URL yok');

  let remote: CloudEnvelope | null = null;
  try {
    remote = await cloudPull(url);
  } catch {
    remote = null;
  }

  const merged = remote?.data ? mergeAppStates(remote.data, local) : local;
  const pushed = await cloudPush(merged, { userName, force: true }, url);
  return { state: pushed.data, version: pushed.version };
}

export async function cloudRewriteSheets(url = getCloudUrl()): Promise<string> {
  if (!url) throw new Error('URL yok');
  // rewrite via pull+push current is safer; or get rewriteSheets with jsonp
  const data = await jsonpRequest(url, { action: 'rewriteSheets' });
  if (!data.ok) throw new Error(String(data.error || 'yenileme basarisiz'));
  return String(data.message || 'Sheet yenilendi');
}

export const SHEETS_BRIDGE_SCRIPT: string = "/**\n * UYU ROOM HOTEL - Sheets Kopru v5\n * JSONP (callback) destekli - tarayici CORS engeli YOK\n *\n * KURULUM: Bu kodu yapistir > Kaydet >\n * Deploy > Manage deployments > kalem > New version > Deploy\n */\nvar PROP = PropertiesService.getScriptProperties();\n\nfunction doGet(e) {\n  e = e || { parameter: {} };\n  var p = e.parameter || {};\n  var action = p.action || 'ping';\n\n  try {\n    if (action === 'ping') {\n      return out_({\n        ok: true,\n        hotel: 'UYU ROOM HOTEL',\n        sheets: true,\n        jsonp: true,\n        version: ver_(),\n        updatedAt: PROP.getProperty('updatedAt'),\n        updatedBy: PROP.getProperty('updatedBy'),\n        ts: now_()\n      }, e);\n    }\n    if (action === 'pull') {\n      return out_(pull_(), e);\n    }\n    if (action === 'chunkStart') {\n      var sid = String(p.sid || '');\n      var total = Number(p.total || 0);\n      var by = String(p.by || 'Personel');\n      if (!sid || total < 1) {\n        return out_({ ok: false, error: 'sid/total gerekli' }, e);\n      }\n      PROP.setProperty('chunk_' + sid + '_total', String(total));\n      PROP.setProperty('chunk_' + sid + '_by', by);\n      PROP.setProperty('chunk_' + sid + '_count', '0');\n      return out_({ ok: true, sid: sid, total: total }, e);\n    }\n    if (action === 'chunk') {\n      var sid2 = String(p.sid || '');\n      var ix = String(p.i || '0');\n      var part = String(p.d || '');\n      if (!sid2) {\n        return out_({ ok: false, error: 'sid yok' }, e);\n      }\n      PROP.setProperty('chunk_' + sid2 + '_' + ix, part);\n      var c = Number(PROP.getProperty('chunk_' + sid2 + '_count') || 0) + 1;\n      PROP.setProperty('chunk_' + sid2 + '_count', String(c));\n      return out_({ ok: true, i: Number(ix), count: c }, e);\n    }\n    if (action === 'chunkCommit') {\n      return out_(chunkCommit_(String(p.sid || '')), e);\n    }\n    if (action === 'rewriteSheets') {\n      return out_(rewriteOnly_(), e);\n    }\n    return out_({ ok: false, error: 'Bilinmeyen action: ' + action }, e);\n  } catch (err) {\n    return out_({ ok: false, error: String(err) }, e);\n  }\n}\n\nfunction doPost(e) {\n  try {\n    var body = parseBody_(e);\n    var action = body.action || 'push';\n    if (action === 'import' || action === 'sync') {\n      action = 'push';\n    }\n    if (action === 'push') {\n      return out_(push_(body), e);\n    }\n    if (action === 'pull') {\n      return out_(pull_(), e);\n    }\n    if (action === 'ping') {\n      return out_({ ok: true, hotel: 'UYU ROOM HOTEL', version: ver_() }, e);\n    }\n    if (action === 'rewriteSheets') {\n      return out_(rewriteOnly_(), e);\n    }\n    return out_({ ok: false, error: 'Bilinmeyen action: ' + action }, e);\n  } catch (err) {\n    return out_({ ok: false, error: String(err) }, e);\n  }\n}\n\nfunction chunkCommit_(sid) {\n  if (!sid) {\n    return { ok: false, error: 'sid yok' };\n  }\n  var total = Number(PROP.getProperty('chunk_' + sid + '_total') || 0);\n  if (total < 1) {\n    return { ok: false, error: 'chunk oturumu yok' };\n  }\n  var parts = [];\n  var i;\n  for (i = 0; i < total; i++) {\n    var part = PROP.getProperty('chunk_' + sid + '_' + i);\n    if (part === null || part === undefined) {\n      return { ok: false, error: 'eksik parca: ' + i };\n    }\n    parts.push(part);\n    PROP.deleteProperty('chunk_' + sid + '_' + i);\n  }\n  PROP.deleteProperty('chunk_' + sid + '_total');\n  PROP.deleteProperty('chunk_' + sid + '_count');\n  var by = PROP.getProperty('chunk_' + sid + '_by') || 'Personel';\n  PROP.deleteProperty('chunk_' + sid + '_by');\n\n  var jsonStr = parts.join('');\n  var data;\n  try {\n    data = JSON.parse(jsonStr);\n  } catch (e) {\n    return { ok: false, error: 'JSON birlestirme hatasi' };\n  }\n\n  return push_({\n    action: 'push',\n    force: true,\n    expectedVersion: 0,\n    envelope: {\n      updatedBy: by,\n      deviceId: 'chunk',\n      hotel: (data.settings && data.settings.name) || 'UYU ROOM HOTEL',\n      data: data\n    }\n  });\n}\n\nfunction parseBody_(e) {\n  if (e && e.parameter && e.parameter.payload) {\n    return JSON.parse(e.parameter.payload);\n  }\n  if (e && e.postData && e.postData.contents) {\n    var contents = e.postData.contents;\n    if (contents.indexOf('payload=') === 0) {\n      var decoded = decodeURIComponent(contents.substring(8).replace(/\\+/g, ' '));\n      return JSON.parse(decoded);\n    }\n    return JSON.parse(contents);\n  }\n  return {};\n}\n\nfunction pull_() {\n  var data = readData_();\n  if (!data) {\n    return { ok: true, empty: true };\n  }\n  return {\n    ok: true,\n    empty: false,\n    envelope: {\n      version: ver_(),\n      updatedAt: PROP.getProperty('updatedAt'),\n      updatedBy: PROP.getProperty('updatedBy'),\n      deviceId: PROP.getProperty('deviceId'),\n      hotel: PROP.getProperty('hotel') || 'UYU ROOM HOTEL',\n      data: data\n    }\n  };\n}\n\nfunction push_(body) {\n  var lock = LockService.getScriptLock();\n  lock.waitLock(30000);\n  try {\n    var current = ver_();\n    var expected = Number(body.expectedVersion || 0);\n    var force = !!body.force;\n    if (!force && expected < current && readData_()) {\n      return {\n        ok: false,\n        conflict: true,\n        envelope: pull_().envelope,\n        error: 'Version conflict'\n      };\n    }\n    var env = body.envelope || {};\n    var data = env.data || body.data;\n    if (!data) {\n      return { ok: false, error: 'data yok' };\n    }\n\n    var next = current + 1;\n    var ts = now_();\n    var by = env.updatedBy || body.updatedBy || 'Personel';\n\n    writeData_(data);\n    PROP.setProperty('version', String(next));\n    PROP.setProperty('updatedAt', ts);\n    PROP.setProperty('updatedBy', by);\n    PROP.setProperty('deviceId', env.deviceId || '');\n    PROP.setProperty('hotel', env.hotel || 'UYU ROOM HOTEL');\n    writeSheets_(data, next, ts, by);\n\n    return {\n      ok: true,\n      sheetsWritten: true,\n      envelope: {\n        version: next,\n        updatedAt: ts,\n        updatedBy: by,\n        deviceId: env.deviceId || '',\n        hotel: env.hotel || 'UYU ROOM HOTEL',\n        data: data\n      }\n    };\n  } finally {\n    lock.releaseLock();\n  }\n}\n\nfunction rewriteOnly_() {\n  var data = readData_();\n  if (!data) {\n    return { ok: false, error: 'Henuz veri yok' };\n  }\n  var ts = now_();\n  var v = ver_();\n  writeSheets_(data, v, ts, PROP.getProperty('updatedBy') || '');\n  return { ok: true, message: 'Sheet yazildi v' + v };\n}\n\nfunction readData_() {\n  var ss = SpreadsheetApp.getActive();\n  var sh = ss.getSheetByName('_DB');\n  if (sh) {\n    var v = String(sh.getRange('A1').getValue() || '');\n    if (v && v.charAt(0) === '{') {\n      try {\n        return JSON.parse(v);\n      } catch (e1) {}\n    }\n  }\n  var raw = PROP.getProperty('stateJson');\n  if (!raw) {\n    return null;\n  }\n  try {\n    return JSON.parse(raw);\n  } catch (e2) {\n    return null;\n  }\n}\n\nfunction writeData_(data) {\n  var json = JSON.stringify(data);\n  var ss = SpreadsheetApp.getActive();\n  var sh = ss.getSheetByName('_DB');\n  if (!sh) {\n    sh = ss.insertSheet('_DB');\n  }\n  sh.clear();\n  sh.getRange('A1').setValue(json);\n  sh.getRange('A2').setValue('Guncelleme: ' + now_());\n  try {\n    if (json.length < 400000) {\n      PROP.setProperty('stateJson', json);\n    }\n  } catch (e3) {}\n}\n\nfunction writeSheets_(data, version, ts, by) {\n  var ss = SpreadsheetApp.getActive();\n  var rooms = active_(data.rooms);\n  var guests = active_(data.guests);\n  var reservations = active_(data.reservations);\n  var payments = active_(data.payments);\n  var staff = active_(data.staff);\n  var ledger = active_(data.ledger);\n  var invoices = active_(data.invoices);\n  var tasks = active_(data.tasks);\n  var recurring = active_(data.recurringExpenses);\n  var inHouse = 0;\n  var pendingInv = 0;\n  var i;\n  for (i = 0; i < reservations.length; i++) {\n    if (reservations[i].status === 'checked_in') {\n      inHouse++;\n    }\n  }\n  for (i = 0; i < invoices.length; i++) {\n    if (invoices[i].status === 'pending') {\n      pendingInv++;\n    }\n  }\n\n  put_(ss, 'Ozet', [\n    ['Alan', 'Deger'],\n    ['Otel', (data.settings && data.settings.name) || 'UYU ROOM HOTEL'],\n    ['Version', version],\n    ['Son guncelleme', ts],\n    ['Guncelleyen', by],\n    ['Oda', rooms.length],\n    ['Misafir', guests.length],\n    ['Rezervasyon', reservations.length],\n    ['In-house', inHouse],\n    ['Odeme', payments.length],\n    ['Personel', staff.length],\n    ['Muhasebe', ledger.length],\n    ['Bekleyen fatura', pendingInv],\n    ['HK', tasks.length]\n  ]);\n\n  put_(ss, 'Odalar', headRows_(\n    ['id', 'no', 'kat', 'tip', 'durum', 'hk', 'kapasite', 'yatak', 'fiyat', 'olanaklar', 'aciklama', 'sonTemizlik'],\n    rooms,\n    function (r) {\n      return [\n        r.id, r.number, r.floor, r.type, r.status, r.housekeeping,\n        r.capacity, r.beds, r.pricePerNight, join_(r.amenities),\n        r.description || '', r.lastCleaned || ''\n      ];\n    }\n  ));\n\n  put_(ss, 'Misafirler', headRows_(\n    ['id', 'ad', 'soyad', 'email', 'telefon', 'kimlik', 'uyruk', 'adres', 'vip', 'konaklama', 'harcama', 'not', 'kayit'],\n    guests,\n    function (g) {\n      return [\n        g.id, g.firstName, g.lastName, g.email, g.phone, g.idNumber,\n        g.nationality, g.address, g.vip ? 'EVET' : 'HAYIR',\n        g.totalStays, g.totalSpent, g.notes || '', g.createdAt || ''\n      ];\n    }\n  ));\n\n  put_(ss, 'Rezervasyonlar', headRows_(\n    [\n      'id', 'kod', 'misafirId', 'misafir', 'odaId', 'odaNo', 'giris', 'cikis',\n      'yetiskin', 'cocuk', 'yanMisafirSayisi', 'yanMisafirler', 'durum', 'odemeDurumu',\n      'gecelik', 'indirim', 'kdv', 'depozito', 'kaynak', 'not', 'ozelIstek',\n      'olusturma', 'checkInAt', 'checkOutAt'\n    ],\n    reservations,\n    function (r) {\n      var g = byId_(data.guests, r.guestId);\n      var room = byId_(data.rooms, r.roomId);\n      var comps = r.companions || [];\n      var cnames = [];\n      var ci;\n      for (ci = 0; ci < comps.length; ci++) {\n        var c = comps[ci];\n        var cg = byId_(data.guests, c.guestId);\n        var n = cg ? (cg.firstName + ' ' + cg.lastName) : c.guestId;\n        if (c.isChild) {\n          n += '(cocuk)';\n        }\n        if (c.isExtra) {\n          n += '(ekstra)';\n        }\n        cnames.push(n);\n      }\n      return [\n        r.id, r.code, r.guestId, g ? (g.firstName + ' ' + g.lastName) : '',\n        r.roomId, room ? room.number : '',\n        r.checkIn, r.checkOut, r.adults, r.children,\n        comps.length, cnames.join(' | '),\n        r.status, r.paymentStatus, r.nightlyRate, r.discount, r.taxRate, r.deposit,\n        r.source || '', r.notes || '', r.specialRequests || '',\n        r.createdAt || '', r.checkedInAt || '', r.checkedOutAt || ''\n      ];\n    }\n  ));\n\n  put_(ss, 'Odemeler', headRows_(\n    ['id', 'rezervasyonId', 'rezervasyonKod', 'tutar', 'yontem', 'tarih', 'not', 'alan'],\n    payments,\n    function (p) {\n      var r = byId_(data.reservations, p.reservationId);\n      return [\n        p.id, p.reservationId, r ? r.code : '', p.amount, p.method,\n        p.date, p.note || '', p.receivedBy || ''\n      ];\n    }\n  ));\n\n  put_(ss, 'Personel', headRows_(\n    ['id', 'ad', 'rol', 'departman', 'vardiya', 'telefon', 'email', 'maas', 'kullaniciAdi', 'aktif', 'iseGiris'],\n    staff,\n    function (s) {\n      return [\n        s.id, s.name, s.role, s.department, s.shift, s.phone, s.email,\n        s.salary || 0, s.username || '', s.active ? 'EVET' : 'HAYIR', s.hiredAt || ''\n      ];\n    }\n  ));\n\n  put_(ss, 'Muhasebe', headRows_(\n    [\n      'id', 'tarih', 'saat', 'tip', 'kategori', 'aciklama', 'tutar', 'yontem',\n      'hesap', 'karsiTaraf', 'referans', 'personelId', 'rezervasyonId', 'odemeId',\n      'kdv', 'not', 'kaydeden', 'olusturma'\n    ],\n    ledger,\n    function (e) {\n      return [\n        e.id, e.date, e.time || '', e.type, e.category, e.description, e.amount, e.method,\n        e.account || '', e.counterparty || '', e.reference || '', e.staffId || '',\n        e.reservationId || '', e.paymentId || '', e.vatRate || '', e.notes || '',\n        e.createdBy || '', e.createdAt || ''\n      ];\n    }\n  ));\n\n  put_(ss, 'Faturalar', headRows_(\n    [\n      'id', 'rezervasyonId', 'rezervasyonKod', 'tetik', 'tutar', 'durum', 'sorumlu',\n      'sorumluId', 'faturaNo', 'dosya', 'drive', 'olusturma', 'sonTarih', 'kesim', 'not'\n    ],\n    invoices,\n    function (inv) {\n      var r = byId_(data.reservations, inv.reservationId);\n      return [\n        inv.id, inv.reservationId, r ? r.code : '', inv.trigger, inv.amount, inv.status,\n        inv.responsibleName, inv.responsibleStaffId, inv.invoiceNumber || '',\n        inv.fileName || '', inv.driveUrl || '', inv.createdAt || '', inv.dueAt || '',\n        inv.issuedAt || '', inv.notes || ''\n      ];\n    }\n  ));\n\n  put_(ss, 'Gorevler', headRows_(\n    ['id', 'odaId', 'odaNo', 'tip', 'durum', 'oncelik', 'atanan', 'not', 'olusturma', 'bitis'],\n    tasks,\n    function (tk) {\n      var room = byId_(data.rooms, tk.roomId);\n      var st = byId_(data.staff, tk.assignedTo);\n      return [\n        tk.id, tk.roomId, room ? room.number : '', tk.type, tk.status, tk.priority,\n        st ? st.name : (tk.assignedTo || ''), tk.notes || '',\n        tk.createdAt || '', tk.completedAt || ''\n      ];\n    }\n  ));\n\n  put_(ss, 'ZorunluGiderler', headRows_(\n    ['id', 'ad', 'kategori', 'tutar', 'gun', 'aktif', 'sonUretim', 'not'],\n    recurring,\n    function (r) {\n      return [\n        r.id, r.name, r.category, r.amount, r.dayOfMonth,\n        r.active ? 'EVET' : 'HAYIR', r.lastGenerated || '', r.notes || ''\n      ];\n    }\n  ));\n}\n\nfunction active_(arr) {\n  var o = [];\n  var L = arr || [];\n  var i;\n  for (i = 0; i < L.length; i++) {\n    if (L[i] && !L[i].deletedAt) {\n      o.push(L[i]);\n    }\n  }\n  return o;\n}\n\nfunction byId_(arr, id) {\n  if (!id || !arr) {\n    return null;\n  }\n  var i;\n  for (i = 0; i < arr.length; i++) {\n    if (arr[i] && arr[i].id === id) {\n      return arr[i];\n    }\n  }\n  return null;\n}\n\nfunction join_(a) {\n  if (!a || !a.length) {\n    return '';\n  }\n  return a.join('; ');\n}\n\nfunction headRows_(h, list, fn) {\n  var rows = [h];\n  var i;\n  var c;\n  for (i = 0; i < list.length; i++) {\n    var row = fn(list[i]);\n    for (c = 0; c < row.length; c++) {\n      if (row[c] === undefined || row[c] === null) {\n        row[c] = '';\n      }\n    }\n    rows.push(row);\n  }\n  return rows;\n}\n\nfunction put_(ss, name, rows) {\n  var sh = ss.getSheetByName(name);\n  if (!sh) {\n    sh = ss.insertSheet(name);\n  }\n  sh.clearContents();\n  if (!rows || !rows.length) {\n    return;\n  }\n  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);\n  sh.setFrozenRows(1);\n}\n\nfunction ver_() {\n  return Number(PROP.getProperty('version') || 0);\n}\n\nfunction now_() {\n  return new Date().toISOString();\n}\n\n/** JSON veya JSONP (callback varsa CORS yok) */\nfunction out_(obj, e) {\n  var json = JSON.stringify(obj);\n  var cb = '';\n  if (e && e.parameter && e.parameter.callback) {\n    cb = String(e.parameter.callback);\n  }\n  // callback adini guvenli tut\n  if (cb && /^[A-Za-z0-9_]+$/.test(cb)) {\n    return ContentService\n      .createTextOutput(cb + '(' + json + ')')\n      .setMimeType(ContentService.MimeType.JAVASCRIPT);\n  }\n  return ContentService\n    .createTextOutput(json)\n    .setMimeType(ContentService.MimeType.JSON);\n}\n\nfunction onOpen() {\n  SpreadsheetApp.getUi()\n    .createMenu('UYU ROOM')\n    .addItem('Sheet tablolarini yaz', 'menuRewrite')\n    .addItem('Surum', 'menuInfo')\n    .addToUi();\n}\n\nfunction menuRewrite() {\n  var r = rewriteOnly_();\n  SpreadsheetApp.getUi().alert(r.ok ? r.message : ('Hata: ' + r.error));\n}\n\nfunction menuInfo() {\n  SpreadsheetApp.getUi().alert(\n    'v' + ver_() + '\\n' +\n    (PROP.getProperty('updatedAt') || '-') + '\\n' +\n    (PROP.getProperty('updatedBy') || '-')\n  );\n}\n";

export const MULTIUSER_APPS_SCRIPT = SHEETS_BRIDGE_SCRIPT;
