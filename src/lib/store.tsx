import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { derivePaymentStatus, grandTotal } from './calculations';
import {
  clearSession,
  loadSession,
  saveSession,
  type AuthSession,
} from './auth';
import {
  downloadFullBackup,
  getMeta,
  listSnapshots,
  loadStateAsync,
  loadStateSync,
  pushSnapshot,
  restoreFromBackup,
  restoreSnapshot,
  safeResetToSeed,
  saveState,
  type Snapshot,
} from './persistence';
import type {
  ActivityLog,
  AppState,
  ArchiveEntry,
  ExtraCharge,
  Guest,
  HousekeepingTask,
  LedgerEntry,
  Payment,
  RecurringExpense,
  Reservation,
  Room,
  Staff,
  StaffDebt,
  StaffDebtPayment,
  StayCompanion,
  Invoice,
  HotelSettings,
  LedgerCategory,
  LedgerType,
  PaymentMethod,
  MaintenanceIssue,
  MenuItem,
  CafeOrder,
  CafeOrderLine,
} from './types';
import { formatReservationCode, reservationsOverlap, todayISO, uid } from './utils';
import { sendTelegramNotify } from './notify';
import {
  applyTeamFromQuery,
  bootstrapTeamConnection,
  getTeamMeta,
  getTeamUrl,
  getTeamKey,
  isTeamEnabled,
  mergeAppStates,
  setTeamEnabled,
  setTeamMeta,
  subscribeTeamRealtime,
  teamPing,
  teamPull,
  teamPush,
  teamSyncRoundTrip,
  type TeamMeta,
  joinPresence,
  setPresencePage,
  type PresenceState,
} from './teamSync';

export type Toast = { id: string; type: 'ok' | 'err' | 'info'; text: string };

interface StoreAPI {
  state: AppState;
  ready: boolean;
  session: AuthSession | null;
  isAuthenticated: boolean;
  login: (session: AuthSession) => void;
  logout: () => void;
  currentUser: Staff | undefined;
  /** Yonetici (admin) veya Mudur (manager) rolu — kritik islemlere erisim */
  isManager: boolean;
  /** Sadece Yonetici (admin) rolu — Mudur dahil degil */
  isAdmin: boolean;
  /** Kim su an hangi sayfada — Supabase Presence ile aninda senkron */
  presence: PresenceState;
  reportPage: (page: string) => void;
  toasts: Toast[];
  dismissToast: (id: string) => void;
  pushToast: (type: Toast['type'], text: string) => void;
  lastSaved: string;
  // Rooms
  addRoom: (room: Omit<Room, 'id'>) => void;
  updateRoom: (id: string, patch: Partial<Room>) => void;
  deleteRoom: (id: string) => void;
  restoreRoom: (id: string) => void;
  // Guests
  addGuest: (guest: Omit<Guest, 'id' | 'createdAt' | 'totalStays' | 'totalSpent'>) => string;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  deleteGuest: (id: string) => void;
  restoreGuest: (id: string) => void;
  // Reservations
  addReservation: (
    res: Omit<Reservation, 'id' | 'code' | 'createdAt' | 'extras' | 'paymentStatus' | 'companions'> & {
      extras?: ExtraCharge[];
    }
  ) => string | { error: string };
  updateReservation: (id: string, patch: Partial<Reservation>) => { error: string } | void;
  cancelReservation: (id: string) => void;
  deleteReservation: (id: string) => void;
  checkIn: (id: string) => string | void;
  checkOut: (id: string) => string | void;
  undoCheckOut: (id: string) => string | void;
  restoreReservation: (id: string) => string | void;
  permanentlyDeleteReservation: (id: string) => string | void;
  addExtra: (reservationId: string, extra: Omit<ExtraCharge, 'id'>) => void;
  removeExtra: (reservationId: string, extraId: string) => void;
  // Payments
  addPayment: (payment: Omit<Payment, 'id'>) => void;
  updatePayment: (id: string, patch: Partial<Payment>) => void;
  deletePayment: (id: string) => void;
  // Staff
  addStaff: (s: Omit<Staff, 'id'>) => void;
  updateStaff: (id: string, patch: Partial<Staff>) => void;
  deleteStaff: (id: string) => void;
  restoreStaff: (id: string) => void;
  setCurrentUser: (id: string) => void;
  // Tasks
  addTask: (t: Omit<HousekeepingTask, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, patch: Partial<HousekeepingTask>) => void;
  deleteTask: (id: string) => void;
  // Settings
  updateSettings: (patch: Partial<HotelSettings>) => void;
  // Data protection
  resetData: () => void;
  importState: (data: AppState) => void;
  createManualSnapshot: (label?: string) => void;
  getSnapshots: () => Snapshot[];
  restoreSnapshotById: (id: string) => boolean;
  restoreLastBackup: () => boolean;
  exportFullBackup: () => void;
  restoreArchived: (archiveId: string) => boolean;
  // Accounting
  addLedgerEntry: (entry: Omit<LedgerEntry, 'id' | 'createdAt'>) => string;
  updateLedgerEntry: (id: string, patch: Partial<LedgerEntry>) => void;
  deleteLedgerEntry: (id: string) => void;
  addRecurringExpense: (e: Omit<RecurringExpense, 'id'>) => void;
  updateRecurringExpense: (id: string, patch: Partial<RecurringExpense>) => void;
  deleteRecurringExpense: (id: string) => void;
  // Bakim / ariza
  addMaintenanceIssue: (issue: Omit<MaintenanceIssue, 'id' | 'createdAt' | 'status'>) => void;
  updateMaintenanceIssue: (id: string, patch: Partial<MaintenanceIssue>) => void;
  completeMaintenanceIssue: (id: string, notes?: string) => void;
  deleteMaintenanceIssue: (id: string) => void;
  // Menu / kafe
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, patch: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;
  createCafeOrder: (order: {
    reservationId: string;
    guestId: string;
    roomId?: string;
    items: CafeOrderLine[];
    note?: string;
    placedBy?: string;
  }) => string | { error: string };
  deliverCafeOrder: (id: string) => void;
  cancelCafeOrder: (id: string) => void;
  generatePayroll: (yearMonth: string, staffIds?: string[]) => number;
  payStaffSalary: (staffId: string, yearMonth: string, amount?: number) => string | { error: string };
  postRecurringExpense: (recurringId: string, yearMonth: string) => string | { error: string };
  generateRecurringForMonth: (yearMonth: string) => number;
  addStaffDebt: (debt: Omit<StaffDebt, 'id' | 'createdAt' | 'remaining' | 'status'>) => string;
  payStaffDebt: (debtId: string, amount: number, opts?: { date?: string; method?: string; note?: string }) => string | { error: string };
  deleteStaffDebt: (debtId: string) => void;
  syncPaymentToLedger: (paymentId: string) => void;
  // Stay companions
  addCompanion: (
    reservationId: string,
    guest:
      | { guestId: string; isExtra?: boolean; isChild?: boolean; relation?: string }
      | {
          newGuest: Omit<Guest, 'id' | 'createdAt' | 'totalStays' | 'totalSpent'>;
          isExtra?: boolean;
          isChild?: boolean;
          relation?: string;
        }
  ) => string | { error: string };
  removeCompanion: (reservationId: string, companionId: string) => void;
  // Invoices
  issueInvoice: (
    invoiceId: string,
    payload: {
      invoiceNumber: string;
      fileName: string;
      fileMime: string;
      fileData: string;
      driveUrl?: string;
      notes?: string;
    }
  ) => string | void;
  cancelInvoice: (invoiceId: string) => void;
  createManualInvoice: (reservationId: string, amount?: number) => string | { error: string };
  // Cloud multi-user
  cloudStatus: TeamMeta['status'];
  setOnlineMode: (on: boolean) => void;
  pullFromCloud: (manual?: boolean) => Promise<string>;
  pushToCloud: (manual?: boolean) => Promise<string>;
  // helpers
  log: (type: string, message: string, relatedId?: string) => void;
  isRoomAvailable: (
    roomId: string,
    checkIn: string,
    checkOut: string,
    excludeResId?: string,
    checkInTime?: string,
    checkOutTime?: string
  ) => boolean;
  getAvailableRooms: (
    checkIn: string,
    checkOut: string,
    excludeResId?: string,
    checkInTime?: string,
    checkOutTime?: string
  ) => Room[];
  activeRooms: () => Room[];
  activeGuests: () => Guest[];
  activeStaff: () => Staff[];
  activeTasks: () => HousekeepingTask[];
  activeReservations: () => Reservation[];
  activePayments: () => Payment[];
}

const StoreContext = createContext<StoreAPI | null>(null);

function syncPaymentStatus(s: AppState, reservationId: string): AppState {
  const res = s.reservations.find((r) => r.id === reservationId);
  if (!res) return s;
  const ps = derivePaymentStatus(res, s.payments);
  return {
    ...s,
    reservations: s.reservations.map((r) =>
      r.id === reservationId ? { ...r, paymentStatus: ps } : r
    ),
  };
}

/** currentUserId gibi cihaza-ozel/gecici alanlar haric icerik parmak izi — gereksiz push/pull dongusunu onlemek icin */
function syncSignature(s: AppState): string {
  const { currentUserId: _cu, ...rest } = s;
  return JSON.stringify(rest);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadStateSync());
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [presence, setPresence] = useState<PresenceState>({});
  const [cloudStatus, setCloudStatus] = useState<TeamMeta['status']>(() => getTeamMeta().status || (isTeamEnabled() ? 'idle' : 'off'));
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);
  // Sync kaynakli (pull/merge sonucu) state guncellemeleri push dongusunu tekrar tetiklemesin
  const suppressPushRef = useRef(false);
  // Gercek icerik degismediyse push/pull dongusu tekrarlanmasin (sonsuz senkron dongusunu onler)
  const lastSyncSignatureRef = useRef<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastSaved, setLastSaved] = useState(() => getMeta().lastSaved);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageWarnedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Hydrate local + ortak Sheets baglantisi + ilk pull
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        applyTeamFromQuery();
        await bootstrapTeamConnection();
        if (cancelled) return;
        if (isTeamEnabled() && getTeamUrl() && getTeamKey()) {
          setCloudStatus('syncing');
        }
        let data = await loadStateAsync();
        if (cancelled) return;

        if (isTeamEnabled() && getTeamUrl() && getTeamKey()) {
          try {
            const remote = await teamPull();
            if (remote?.data) {
              // Ortak DB doluysa onu kullan (personel ayni veriyi gorsun)
              const hasRemoteRes = (remote.data.reservations || []).length > 0;
              const hasLocalRes = (data.reservations || []).length > 0;
              if (hasRemoteRes || !hasLocalRes) {
                data = remote.data;
              } else {
                // Remote bos/test, local dolu seed -> merge + push
                data = mergeAppStates(remote.data, data);
                try {
                  const pushed = await teamPush(data, 'Sistem', { force: true });
                  setTeamMeta({
                    status: 'ok',
                    lastPushAt: new Date().toISOString(),
                    lastVersion: pushed.version,
                  });
                } catch {
                  /* devam */
                }
              }
              setTeamMeta({
                status: 'ok',
                lastPullAt: new Date().toISOString(),
                lastVersion: remote.version,
                lastError: undefined,
                lastBy: remote.updatedBy,
              });
              setCloudStatus('ok');
            } else {
              // DB tamamen bos — local seed'i yukle
              try {
                const pushed = await teamPush(data, 'Sistem', { force: true });
                setTeamMeta({
                  status: 'ok',
                  lastPushAt: new Date().toISOString(),
                  lastVersion: pushed.version,
                  lastError: undefined,
                });
                setCloudStatus('ok');
              } catch (e) {
                setCloudStatus('error');
                setTeamMeta({
                  status: 'error',
                  lastError: String(e instanceof Error ? e.message : e),
                });
              }
            }
          } catch (e) {
            setTeamMeta({
              status: 'error',
              lastError: String(e instanceof Error ? e.message : e),
            });
            setCloudStatus('error');
          }
        }

        if (cancelled) return;
        lastSyncSignatureRef.current = syncSignature(data);
        setState(data);
        setReady(true);
      } catch {
        if (cancelled) return;
        setState(loadStateSync());
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  // Multi-device: pull every 8s when online mode on
  useEffect(() => {
    if (!ready) return;
    if (!isTeamEnabled() || !getTeamUrl() || !getTeamKey()) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || syncingRef.current) return;
      if (document.visibilityState === 'hidden') return;
      try {
        syncingRef.current = true;
        setCloudStatus('syncing');
        const env = await teamPull();
        if (!env) {
          setTeamMeta({ status: 'ok', lastPullAt: new Date().toISOString() });
          setCloudStatus('ok');
          return;
        }
        const localVer = getTeamMeta().lastVersion || 0;
        if ((env.version || 0) >= localVer) {
          // Bu cihazda henuz push edilmemis (bekleyen) bir yerel degisiklik varsa,
          // bu turda uzak veri onu ezmesin — push effect'i kendi pull+merge'ini yapip
          // yerel degisikligi koruyarak gonderecek. Sadece yerel zaten senkronsa
          // (bekleyen degisiklik yoksa) uzak veri guvenle uygulanir.
          const localPending = syncSignature(stateRef.current) !== lastSyncSignatureRef.current;
          if (localPending) {
            setTeamMeta({ status: 'ok', lastPullAt: new Date().toISOString() });
            setCloudStatus('ok');
            return;
          }
          const merged = mergeAppStates(stateRef.current, env.data);
          const sig = syncSignature(merged);
          if (sig !== lastSyncSignatureRef.current) {
            lastSyncSignatureRef.current = sig;
            suppressPushRef.current = true;
            setState((prev) => ({ ...merged, currentUserId: prev.currentUserId }));
          }
          setTeamMeta({
            status: 'ok',
            lastPullAt: new Date().toISOString(),
            lastVersion: env.version,
            lastError: undefined,
          });
          setCloudStatus('ok');
        } else {
          setTeamMeta({ status: 'ok', lastPullAt: new Date().toISOString() });
          setCloudStatus('ok');
        }
      } catch (e) {
        const msg = String(e instanceof Error ? e.message : e);
        setTeamMeta({ status: 'error', lastError: msg });
        setCloudStatus('error');
      } finally {
        syncingRef.current = false;
      }
    };
    const id = window.setInterval(tick, 8000);
    // initial pull shortly after login
    const t0 = window.setTimeout(tick, 600);
    const onVis = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);

    // Realtime: baska bir cihaz yazar yazmaz haberdar ol, hemen cek
    // (8sn'lik yoklama sadece yedek — asil senkron burada aninda tetiklenir)
    let realtimeDebounce: ReturnType<typeof setTimeout> | null = null;
    const unsubRealtime = subscribeTeamRealtime(() => {
      if (realtimeDebounce) clearTimeout(realtimeDebounce);
      realtimeDebounce = setTimeout(() => void tick(), 250);
    });

    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(t0);
      if (realtimeDebounce) clearTimeout(realtimeDebounce);
      unsubRealtime();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [ready, session]);

  // Degisiklik sonrasi: pull+merge+push (personel rezervasyonu kaybolmasin)
  useEffect(() => {
    if (!ready) return;
    if (!isTeamEnabled() || !getTeamUrl()) return;
    // Bu state degisikligi sync'ten geldiyse (tick/push sonucu) tekrar push tetikleme
    if (suppressPushRef.current) {
      suppressPushRef.current = false;
      return;
    }
    if (pushTimer.current) clearTimeout(pushTimer.current);
    const runPush = async (retriesLeft: number) => {
      if (syncingRef.current) {
        // Su an baska bir push devam ediyor — bu degisiklik kaybolmasin,
        // kisa sure sonra tekrar dene (birkac kez).
        if (retriesLeft > 0) {
          pushTimer.current = setTimeout(() => void runPush(retriesLeft - 1), 400);
        }
        return;
      }
      const sig = syncSignature(stateRef.current);
      if (sig === lastSyncSignatureRef.current) return; // icerik degismedi, bosuna push yok
      try {
        syncingRef.current = true;
        setCloudStatus('syncing');
        const result = await teamSyncRoundTrip(stateRef.current, session?.name || 'Misafir/Sistem');
        // Push suruyorken kullanici baska bir sey degistirmis olabilir (hizli art
        // arda silme/iptal vb.) — bu durumda en guncel yerel state'i kazanan taraf
        // yaparak push sonucuyla uzlastir, yoksa arada yapilan degisiklik kaybolur.
        const reconciled = mergeAppStates(result.state, stateRef.current);
        const pushedSig = syncSignature(result.state);
        const reconciledSig = syncSignature(reconciled);
        lastSyncSignatureRef.current = pushedSig;
        if (reconciledSig === pushedSig) {
          // Push suresince baska bir degisiklik olmadi — dongu tetiklenmesin
          suppressPushRef.current = true;
        }
        // reconciledSig farkliysa suppress uygulanmaz: state degisikligi effect'i
        // yeniden tetikler ve bu yeni/kacan degisiklik bir sonraki turda gonderilir.
        setState((prev) => ({
          ...reconciled,
          currentUserId: prev.currentUserId,
        }));
        setTeamMeta({
          status: 'ok',
          lastPushAt: new Date().toISOString(),
          lastPullAt: new Date().toISOString(),
          lastVersion: result.version,
          lastError: undefined,
        });
        setCloudStatus('ok');
      } catch (e) {
        const msg = String(e instanceof Error ? e.message : e);
        setTeamMeta({ status: 'error', lastError: msg });
        setCloudStatus('error');
      } finally {
        syncingRef.current = false;
      }
    };
    pushTimer.current = setTimeout(() => void runPush(5), 600);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state, ready, session]);

  // Canli personel varligi — oturum acan her cihaz kendi konumunu (hangi
  // sayfada oldugunu) paylasir, Yonetici/Mudur bunu aninda gorebilir.
  useEffect(() => {
    if (!ready || !session) return;
    const unsub = joinPresence(session.staffId, session.name || 'Personel', setPresence);
    return () => unsub();
  }, [ready, session]);

  // Debounced multi-layer persist
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const result = saveState(stateRef.current);
      if (result.ok) {
        setLastSaved(new Date().toISOString());
      } else if (!storageWarnedRef.current) {
        // Bulut senkronu (Supabase) zaten calisiyor — yerel yedekleme
        // basarisiz olsa da veri kaybolmaz. Bu yuzden her kayit
        // denemesinde degil, oturum basina sadece BIR KEZ uyar.
        storageWarnedRef.current = true;
        pushToast('err', 'Tarayıcı yerel depolaması dolu — veriniz bulutta güvende, sadece bu cihazdaki yerel yedek tutulamıyor. Sorun devam ederse tarayıcı önbelleğini temizleyin.');
      }
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, ready]);

  // Flush on page hide / unload
  useEffect(() => {
    const flush = () => {
      saveState(stateRef.current);
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
      flush();
    };
  }, []);

  // Auto backup download reminder every 50 saves is handled in persistence snapshots

  const pushToast = useCallback((type: Toast['type'], text: string) => {
    const id = uid('toast');
    setToasts((t) => [...t, { id, type, text }].slice(-5));
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const appendLog = (s: AppState, type: string, message: string, relatedId?: string): AppState => {
    // ONEMLI: s.currentUserId paylasimli/senkronize bir alan — baska bir
    // cihazin son aktif kullanicisini yansitabilir. Kim yaptigini DOGRU
    // kaydetmek icin bu CIHAZIN gercek oturumunu (session) esas al.
    const user = s.staff.find((x) => x.id === (session?.staffId || s.currentUserId))?.name ?? 'Sistem';
    const entry: ActivityLog = {
      id: uid('act'),
      type,
      message,
      user,
      timestamp: new Date().toISOString(),
      relatedId,
    };
    return { ...s, activity: [entry, ...s.activity].slice(0, 300) };
  };

  const archiveItem = (s: AppState, entity: string, data: unknown): AppState => {
    const user = s.staff.find((x) => x.id === (session?.staffId || s.currentUserId))?.name ?? 'Sistem';
    const entry: ArchiveEntry = {
      id: uid('arch'),
      entity,
      data,
      deletedAt: new Date().toISOString(),
      deletedBy: user,
    };
    return { ...s, archive: [entry, ...(s.archive ?? [])].slice(0, 500) };
  };

  const log = useCallback((type: string, message: string, relatedId?: string) => {
    setState((s) => appendLog(s, type, message, relatedId));
  }, []);

  // Kritik islemler (personel yonetimi, muhasebe kaydi silme) sadece
  // Yonetici (admin) ve Mudur (manager) rolundeki kullanicilara acik.
  const hasManagerAccess = useCallback((): boolean => {
    const me = state.staff.find((x) => x.id === (session?.staffId || state.currentUserId));
    if (!me) return false;
    const roles = me.roles && me.roles.length ? me.roles : [me.role];
    return roles.includes('admin') || roles.includes('manager');
  }, [state.staff, state.currentUserId, session]);

  const denyIfNotManager = useCallback((): boolean => {
    if (hasManagerAccess()) return false;
    pushToast('err', 'Bu işlem için Yönetici veya Müdür yetkisi gerekiyor.');
    return true;
  }, [hasManagerAccess]);

  // Bazi kritik islemler (odeme silme/duzenleme) sadece Yonetici (admin) rolune
  // acik — Mudur (manager) dahil degil.
  const hasAdminAccess = useCallback((): boolean => {
    const me = state.staff.find((x) => x.id === (session?.staffId || state.currentUserId));
    if (!me) return false;
    const roles = me.roles && me.roles.length ? me.roles : [me.role];
    return roles.includes('admin');
  }, [state.staff, state.currentUserId, session]);

  const denyIfNotAdmin = useCallback((): boolean => {
    if (hasAdminAccess()) return false;
    pushToast('err', 'Bu işlem için sadece Yönetici yetkisi yeterli — Müdür dahil değil.');
    return true;
  }, [hasAdminAccess]);

  const isRoomAvailable = useCallback(
    (
      roomId: string,
      checkIn: string,
      checkOut: string,
      excludeResId?: string,
      checkInTime?: string,
      checkOutTime?: string
    ) => {
      const room = state.rooms.find((r) => r.id === roomId && !r.deletedAt);
      if (!room) return false;
      if (room.status === 'out_of_order' || room.status === 'maintenance') return false;
      const defaultCI = state.settings.checkInTime || '14:00';
      const defaultCO = state.settings.checkOutTime || '12:00';
      const candidate = { checkIn, checkOut, checkInTime, checkOutTime };
      const blocking = state.reservations.filter(
        (r) =>
          !r.deletedAt &&
          r.roomId === roomId &&
          r.id !== excludeResId &&
          !['cancelled', 'no_show', 'checked_out'].includes(r.status) &&
          reservationsOverlap(r, candidate, defaultCI, defaultCO)
      );
      return blocking.length === 0;
    },
    [state.rooms, state.reservations, state.settings.checkInTime, state.settings.checkOutTime]
  );

  const getAvailableRooms = useCallback(
    (
      checkIn: string,
      checkOut: string,
      excludeResId?: string,
      checkInTime?: string,
      checkOutTime?: string
    ) => {
      return state.rooms.filter(
        (r) =>
          !r.deletedAt &&
          isRoomAvailable(r.id, checkIn, checkOut, excludeResId, checkInTime, checkOutTime)
      );
    },
    [state.rooms, isRoomAvailable]
  );

  const api: StoreAPI = useMemo(
    () => ({
      state,
      ready,
      session,
      isAuthenticated: !!session,
      cloudStatus,
      setOnlineMode: (on) => {
        setTeamEnabled(on);
        setCloudStatus(on && getTeamUrl() && getTeamKey() ? 'idle' : 'off');
        setTeamMeta({ status: on && getTeamUrl() && getTeamKey() ? 'idle' : 'off' });
      },
      pullFromCloud: async (manual) => {
        const env = await teamPull();
        if (!env) {
          setTeamMeta({ status: 'ok', lastPullAt: new Date().toISOString() });
          setCloudStatus('ok');
          return 'Bulut bos — once Push ile yukleyin';
        }
        setState(env.data);
        setTeamMeta({
          status: 'ok',
          lastPullAt: new Date().toISOString(),
          lastVersion: env.version,
          lastError: undefined,
        });
        setCloudStatus('ok');
        return `Cekildi v${env.version} · ${env.updatedBy || ''}`;
      },
      pushToCloud: async (manual) => {
        const result = await teamSyncRoundTrip(
          stateRef.current,
          session?.name || 'Personel'
        );
        setState((prev) => ({ ...result.state, currentUserId: prev.currentUserId }));
        setTeamMeta({
          status: 'ok',
          lastPushAt: new Date().toISOString(),
          lastPullAt: new Date().toISOString(),
          lastVersion: result.version,
          lastError: undefined,
        });
        setCloudStatus('ok');
        return `Ortak DB guncellendi v${result.version}`;
      },
      login: (s) => {
        saveSession(s);
        setSession(s);
        setState((prev) => ({ ...prev, currentUserId: s.staffId }));
        pushToast('ok', `Hoş geldiniz, ${s.name}`);
        // Giriste ortak veriyi hemen cek
        if (isTeamEnabled() && getTeamUrl() && getTeamKey()) {
          void (async () => {
            try {
              const remote = await teamPull();
              if (remote?.data) {
                setState({ ...remote.data, currentUserId: s.staffId });
                setTeamMeta({
                  status: 'ok',
                  lastPullAt: new Date().toISOString(),
                  lastVersion: remote.version,
                  lastBy: remote.updatedBy,
                });
                setCloudStatus('ok');
                pushToast('ok', `Ortak veri yuklendi (v${remote.version})`);
              }
            } catch {
              /* arka plan deneyecek */
            }
          })();
        }
      },
      logout: () => {
        clearSession();
        setSession(null);
        pushToast('info', 'Oturum kapatıldı');
      },
      currentUser: state.staff.find((s) => s.id === (session?.staffId || state.currentUserId) && !s.deletedAt),
      isManager: hasManagerAccess(),
      isAdmin: hasAdminAccess(),
      presence,
      reportPage: setPresencePage,
      toasts,
      dismissToast,
      pushToast,
      lastSaved,

      activeRooms: () => state.rooms.filter((r) => !r.deletedAt),
      activeGuests: () => state.guests.filter((g) => !g.deletedAt),
      activeStaff: () => state.staff.filter((s) => !s.deletedAt),
      activeTasks: () => state.tasks.filter((t) => !t.deletedAt),
      activeReservations: () => state.reservations.filter((r) => !r.deletedAt),
      activePayments: () => state.payments.filter((p) => !p.deletedAt),

      addRoom: (room) => {
        const id = uid('room');
        setState((s) =>
          appendLog({ ...s, rooms: [...s.rooms, { ...room, id }] }, 'room', `Yeni oda eklendi: ${room.number}`, id)
        );
        pushToast('ok', `Oda ${room.number} eklendi`);
      },

      updateRoom: (id, patch) => {
        setState((s) => ({
          ...s,
          rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }));
      },

      deleteRoom: (id) => {
        setState((s) => {
          const room = s.rooms.find((r) => r.id === id);
          if (!room) return s;
          let next = archiveItem(s, 'room', room);
          next = {
            ...next,
            rooms: next.rooms.map((r) =>
              r.id === id ? { ...r, deletedAt: new Date().toISOString() } : r
            ),
          };
          return appendLog(next, 'room', `Oda arşivlendi: ${room.number}`, id);
        });
        pushToast('info', 'Oda arşive alındı (kalıcı silinmedi)');
      },

      restoreRoom: (id) => {
        setState((s) => ({
          ...s,
          rooms: s.rooms.map((r) => (r.id === id ? { ...r, deletedAt: undefined } : r)),
        }));
        pushToast('ok', 'Oda geri yüklendi');
      },

      addGuest: (guest) => {
        const id = uid('guest');
        setState((s) =>
          appendLog(
            {
              ...s,
              guests: [
                ...s.guests,
                {
                  ...guest,
                  id,
                  createdAt: todayISO(),
                  totalStays: 0,
                  totalSpent: 0,
                },
              ],
            },
            'guest',
            `Yeni misafir: ${guest.firstName} ${guest.lastName}`,
            id
          )
        );
        pushToast('ok', 'Misafir kaydedildi');
        return id;
      },

      updateGuest: (id, patch) => {
        setState((s) => ({
          ...s,
          guests: s.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        }));
      },

      deleteGuest: (id) => {
        setState((s) => {
          const guest = s.guests.find((g) => g.id === id);
          if (!guest) return s;
          let next = archiveItem(s, 'guest', guest);
          next = {
            ...next,
            guests: next.guests.map((g) =>
              g.id === id ? { ...g, deletedAt: new Date().toISOString() } : g
            ),
          };
          return appendLog(next, 'guest', `Misafir arşivlendi: ${guest.firstName} ${guest.lastName}`, id);
        });
        pushToast('info', 'Misafir arşive alındı');
      },

      restoreGuest: (id) => {
        setState((s) => ({
          ...s,
          guests: s.guests.map((g) => (g.id === id ? { ...g, deletedAt: undefined } : g)),
        }));
        pushToast('ok', 'Misafir geri yüklendi');
      },

      addReservation: (input) => {
        if (input.checkOut < input.checkIn) {
          return { error: 'Çıkış tarihi giriş tarihinden önce olamaz.' };
        }
        if (!isRoomAvailable(input.roomId, input.checkIn, input.checkOut, undefined, input.checkInTime, input.checkOutTime)) {
          return { error: 'Seçilen oda bu tarihlerde müsait değil.' };
        }
        const id = uid('res');
        let assignedCode = '';
        setState((s) => {
          const nextSeq = (s.reservationSeq || 0) + 1;
          assignedCode = formatReservationCode(nextSeq);
          const res: Reservation = {
            ...input,
            id,
            code: assignedCode,
            extras: input.extras ?? [],
            companions: (input as { companions?: StayCompanion[] }).companions ?? [],
            paymentStatus: 'unpaid',
            createdAt: todayISO(),
            checkOutTime: input.checkOutTime || '11:00',
          };
          const guest = s.guests.find((g) => g.id === input.guestId);
          return appendLog(
            {
              ...s,
              reservationSeq: nextSeq,
              reservations: [res, ...s.reservations],
            },
            'reservation',
            'Yeni rezervasyon: ' + assignedCode + ' (' + (guest ? guest.firstName + ' ' + guest.lastName : 'Misafir') + ')',
            id
          );
        });
        pushToast('ok', 'Rezervasyon oluşturuldu: ' + (assignedCode || 'UYU'));
        {
          const guest = state.guests.find((g) => g.id === input.guestId);
          const room = state.rooms.find((r) => r.id === input.roomId);
          sendTelegramNotify(
            `🆕 <b>Yeni Rezervasyon</b>\n${assignedCode} — ${guest ? guest.firstName + ' ' + guest.lastName : 'Misafir'}\n` +
              `Oda ${room?.number ?? '-'} · ${input.checkIn}${input.checkInTime ? ' ' + input.checkInTime : ''} → ${input.checkOut} ${input.checkOutTime || '11:00'}`
          );
        }
        return id;
      },

      updateReservation: (id, patch) => {
        const existing = state.reservations.find((r) => r.id === id);
        if (!existing) return { error: 'Rezervasyon bulunamadı' };
        const checkIn = patch.checkIn ?? existing.checkIn;
        const checkOut = patch.checkOut ?? existing.checkOut;
        const roomId = patch.roomId ?? existing.roomId;
        const checkInTime = patch.checkInTime ?? existing.checkInTime;
        const checkOutTime = patch.checkOutTime ?? existing.checkOutTime;
        if (checkOut < checkIn) return { error: 'Çıkış tarihi giriş tarihinden önce olamaz.' };
        if (
          (patch.checkIn || patch.checkOut || patch.roomId || patch.checkInTime || patch.checkOutTime) &&
          !isRoomAvailable(roomId, checkIn, checkOut, id, checkInTime, checkOutTime)
        ) {
          return { error: 'Seçilen oda bu tarihlerde müsait değil.' };
        }
        setState((s) => {
          let next: AppState = {
            ...s,
            reservations: s.reservations.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          };
          // Rezervasyon durumu manuel olarak (orn. detay ekranindaki "Durum"
          // acilir menusunden) degistirilirse, oda durumu da buna gore
          // senkronize edilsin — sadece dedike Check-in/Check-out butonlari
          // degil, HER durum degisikligi odaya yansisin.
          if (patch.status && patch.status !== existing.status) {
            next = {
              ...next,
              rooms: next.rooms.map((room) => {
                if (room.id !== roomId) return room;
                if (patch.status === 'checked_in') {
                  return { ...room, status: 'occupied' as const };
                }
                if (patch.status === 'checked_out') {
                  return { ...room, status: 'cleaning' as const, housekeeping: 'dirty' as const };
                }
                if (
                  (patch.status === 'cancelled' || patch.status === 'no_show') &&
                  existing.status === 'checked_in'
                ) {
                  return { ...room, status: 'cleaning' as const, housekeeping: 'dirty' as const };
                }
                return room;
              }),
            };
          }
          next = syncPaymentStatus(next, id);
          return appendLog(next, 'reservation', 'Rezervasyon güncellendi', id);
        });
        return undefined;
      },

      cancelReservation: (id) => {
        setState((s) => {
          const res = s.reservations.find((r) => r.id === id);
          let next: AppState = {
            ...s,
            reservations: s.reservations.map((r) =>
              r.id === id ? { ...r, status: 'cancelled' as const } : r
            ),
            rooms: s.rooms.map((room) => {
              if (res && res.roomId === room.id && res.status === 'checked_in') {
                return { ...room, status: 'cleaning' as const, housekeeping: 'dirty' as const };
              }
              return room;
            }),
          };
          return appendLog(next, 'reservation', `Rezervasyon iptal: ${res?.code ?? id}`, id);
        });
        pushToast('info', 'Rezervasyon iptal edildi');
        {
          const res = state.reservations.find((r) => r.id === id);
          const guest = res ? state.guests.find((g) => g.id === res.guestId) : undefined;
          sendTelegramNotify(
            `⛔ <b>Rezervasyon İptal Edildi</b>\n${res?.code ?? id}${guest ? ' — ' + guest.firstName + ' ' + guest.lastName : ''}`
          );
        }
      },

      deleteReservation: (id) => {
        setState((s) => {
          const res = s.reservations.find((r) => r.id === id);
          if (!res) return s;
          let next = archiveItem(s, 'reservation', res);
          next = {
            ...next,
            reservations: next.reservations.map((r) =>
              r.id === id ? { ...r, status: 'cancelled' as const, deletedAt: new Date().toISOString() } : r
            ),
            rooms: next.rooms.map((room) => {
              if (res.roomId === room.id && ['checked_in', 'confirmed'].includes(res.status)) {
                return { ...room, status: 'cleaning' as const, housekeeping: 'dirty' as const };
              }
              return room;
            }),
          };
          return appendLog(next, 'reservation', `Rezervasyon silindi (arşivlendi): ${res.code}`, id);
        });
        pushToast('info', 'Rezervasyon arşive alındı');
        {
          const res = state.reservations.find((r) => r.id === id);
          const guest = res ? state.guests.find((g) => g.id === res.guestId) : undefined;
          sendTelegramNotify(
            `🗑 <b>Rezervasyon Silindi</b>\n${res?.code ?? id}${guest ? ' — ' + guest.firstName + ' ' + guest.lastName : ''}`
          );
        }
      },

      checkIn: (id) => {
        const res = state.reservations.find((r) => r.id === id && !r.deletedAt);
        if (!res) return 'Rezervasyon bulunamadı';
        if (!['confirmed', 'pending'].includes(res.status)) {
          return 'Sadece onaylı veya bekleyen rezervasyonlar check-in yapılabilir.';
        }
        const room = state.rooms.find((r) => r.id === res.roomId);
        if (room && (room.status === 'out_of_order' || room.status === 'maintenance')) {
          return 'Oda kullanım dışı / bakımda — check-in yapılamaz.';
        }
        setState((s) => {
          const guest = s.guests.find((g) => g.id === res.guestId);
          const rm = s.rooms.find((r) => r.id === res.roomId);
          const now = new Date();
          const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          return appendLog(
            {
              ...s,
              reservations: s.reservations.map((r) =>
                r.id === id
                  ? {
                      ...r,
                      status: 'checked_in' as const,
                      checkedInAt: now.toISOString(),
                      // Rezervasyon olusturulurken giris saati belirtilmemisse,
                      // fiili check-in an\u0131n\u0131 kaydet — yoksa Takvim'de
                      // "giris saati" hep bos gorunuyordu.
                      checkInTime: r.checkInTime || nowHHMM,
                    }
                  : r
              ),
              rooms: s.rooms.map((r) =>
                r.id === res.roomId ? { ...r, status: 'occupied' as const } : r
              ),
            },
            'checkin',
            `${guest?.firstName ?? ''} ${guest?.lastName ?? ''} oda ${rm?.number ?? ''} girişi`,
            id
          );
        });
        // fatura yükümlülüğü
        setState((s) => {
          const res2 = s.reservations.find((r) => r.id === id);
          if (!res2) return s;
          const staffId = s.currentUserId;
          const staff = s.staff.find((x) => x.id === staffId);
          const inv: Invoice = {
            id: uid('inv'),
            reservationId: id,
            trigger: 'checkin',
            amount: grandTotal(res2),
            status: 'pending',
            responsibleStaffId: staffId,
            responsibleName: staff?.name || 'Resepsiyon',
            createdAt: new Date().toISOString(),
            dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          };
          return appendLog(
            { ...s, invoices: [inv, ...(s.invoices || [])] },
            'invoice',
            `Fatura bekleniyor (check-in): ${res2.code} — sorumlu ${inv.responsibleName}`,
            inv.id
          );
        });
        pushToast('ok', 'Check-in tamamlandı — fatura kesimi bekleniyor');
        {
          const guest = state.guests.find((g) => g.id === res.guestId);
          const rm = state.rooms.find((r) => r.id === res.roomId);
          sendTelegramNotify(
            `✅ <b>Check-in</b>\n${res.code} — ${guest ? guest.firstName + ' ' + guest.lastName : 'Misafir'}\nOda ${rm?.number ?? '-'}`
          );
        }
      },

      checkOut: (id) => {
        const res = state.reservations.find((r) => r.id === id && !r.deletedAt);
        if (!res) return 'Rezervasyon bulunamadı';
        if (res.status !== 'checked_in') {
          return 'Sadece giriş yapılmış rezervasyonlar check-out yapılabilir.';
        }
        const bal =
          grandTotal(res) -
          state.payments
            .filter((p) => p.reservationId === id && !p.deletedAt)
            .reduce((a, p) => a + p.amount, 0);
        if (bal > 1) return `Ödeme tamamlanmadı. Kalan bakiye: ${bal.toFixed(2)} ₺`;

        setState((s) => {
          const total = grandTotal(res);
          const guest = s.guests.find((g) => g.id === res.guestId);
          const rm = s.rooms.find((r) => r.id === res.roomId);
          const now = new Date();
          const actualCheckOutDate = todayISO();
          const actualCheckOutTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          return appendLog(
            {
              ...s,
              reservations: s.reservations.map((r) =>
                r.id === id
                  ? {
                      ...r,
                      status: 'checked_out' as const,
                      checkedOutAt: now.toISOString(),
                      paymentStatus: 'paid' as const,
                      // Erken cikis yapildiysa takvimdeki bar da gercek cikis
                      // tarihini yansitsin — plandaki tarihe kadar dolu gozukmesin.
                      checkOut: actualCheckOutDate < r.checkOut ? actualCheckOutDate : r.checkOut,
                      checkOutTime: actualCheckOutDate < r.checkOut ? actualCheckOutTime : r.checkOutTime,
                    }
                  : r
              ),
              rooms: s.rooms.map((room) =>
                room.id === res.roomId
                  ? {
                      ...room,
                      status: 'cleaning' as const,
                      housekeeping: 'dirty' as const,
                    }
                  : room
              ),
              guests: s.guests.map((g) =>
                g.id === res.guestId
                  ? {
                      ...g,
                      totalStays: g.totalStays + 1,
                      totalSpent: g.totalSpent + total,
                    }
                  : g
              ),
              tasks: [
                {
                  id: uid('task'),
                  roomId: res.roomId,
                  status: 'open' as const,
                  priority: 'high' as const,
                  type: 'Çıkış Temizliği',
                  notes: 'Otomatik oluşturuldu',
                  createdAt: new Date().toISOString(),
                },
                ...s.tasks,
              ],
            },
            'checkout',
            `${guest?.firstName ?? ''} ${guest?.lastName ?? ''} oda ${rm?.number ?? ''} çıkışı`,
            id
          );
        });
        pushToast('ok', 'Check-out tamamlandı');
        {
          const guest = state.guests.find((g) => g.id === res.guestId);
          const rm = state.rooms.find((r) => r.id === res.roomId);
          sendTelegramNotify(
            `👋 <b>Check-out</b>\n${res.code} — ${guest ? guest.firstName + ' ' + guest.lastName : 'Misafir'}\nOda ${rm?.number ?? '-'}`
          );
        }
      },

      // Silinen (arsivlenen) bir rezervasyonu geri getirir — "hayalet
      // rezervasyon" kurtarma ozelligi. Sadece Yonetici/Mudur kullanabilir.
      restoreReservation: (id) => {
        if (denyIfNotManager()) return 'Bu işlem için Yönetici veya Müdür yetkisi gerekiyor.';
        const res = state.reservations.find((r) => r.id === id);
        if (!res || !res.deletedAt) return 'Rezervasyon zaten aktif.';
        setState((s) => {
          const guest = s.guests.find((g) => g.id === res.guestId);
          const next = {
            ...s,
            reservations: s.reservations.map((r) =>
              r.id === id ? { ...r, deletedAt: undefined, status: 'confirmed' as const } : r
            ),
          };
          return appendLog(
            next,
            'reservation',
            `Rezervasyon geri getirildi: ${res.code}${guest ? ' — ' + guest.firstName + ' ' + guest.lastName : ''}`,
            id
          );
        });
        pushToast('ok', 'Rezervasyon geri getirildi');
        return undefined;
      },

      // Kalici silme — geri alinamaz. Sadece Yonetici kullanabilir.
      // ONEMLI: kaydi diziden TAMAMEN CIKARMAK (array.filter) senkron/merge
      // mantigiyla uyumsuzdu — baska bir cihazdaki/henuz senkron olmamis
      // kopya onu "eksik" sanip geri getiriyordu (hayalet rezervasyon
      // sorunu, kalici silme tutmuyordu). Onun yerine, deletedAt'in zaten
      // guvenilir sekilde calistigi ayni deseni kullanip kaydi SILMEDEN
      // sadece 'purged' bayragini set ediyoruz — boylece her cihazda ve
      // her senkronda kalici ve tutarli sekilde gizleniyor.
      permanentlyDeleteReservation: (id) => {
        if (denyIfNotAdmin()) return 'Bu işlem için sadece Yönetici yetkisi yeterli.';
        const res = state.reservations.find((r) => r.id === id);
        if (!res) return 'Rezervasyon bulunamadı.';
        setState((s) => ({
          ...s,
          reservations: s.reservations.map((r) =>
            r.id === id ? { ...r, purged: true, deletedAt: r.deletedAt || new Date().toISOString() } : r
          ),
        }));
        pushToast('info', `${res.code} kalıcı olarak silindi`);
        return undefined;
      },

      undoCheckOut: (id) => {
        const res = state.reservations.find((r) => r.id === id && !r.deletedAt);
        if (!res) return 'Rezervasyon bulunamadı';
        if (res.status !== 'checked_out') {
          return 'Sadece check-out yapılmış rezervasyonlarda geri alınabilir.';
        }
        setState((s) => {
          const guest = s.guests.find((g) => g.id === res.guestId);
          const rm = s.rooms.find((r) => r.id === res.roomId);
          const total = grandTotal(res);
          // Check-out sirasinda otomatik olusturulan "Cikis Temizligi"
          // gorevi henuz baslanmadiysa kaldirilsin — misafir zaten
          // konaklamaya devam ediyor, oda temizlenmeyecek.
          const taskIdx = s.tasks.findIndex(
            (t) => t.roomId === res.roomId && t.type === 'Çıkış Temizliği' && t.status === 'open'
          );
          const tasks = taskIdx >= 0 ? s.tasks.filter((_, i) => i !== taskIdx) : s.tasks;
          return appendLog(
            {
              ...s,
              reservations: s.reservations.map((r) =>
                r.id === id
                  ? { ...r, status: 'checked_in' as const, checkedOutAt: undefined }
                  : r
              ),
              rooms: s.rooms.map((room) =>
                room.id === res.roomId ? { ...room, status: 'occupied' as const } : room
              ),
              guests: s.guests.map((g) =>
                g.id === res.guestId
                  ? {
                      ...g,
                      totalStays: Math.max(0, g.totalStays - 1),
                      totalSpent: Math.max(0, g.totalSpent - total),
                    }
                  : g
              ),
              tasks,
            },
            'checkout',
            `Çıkış iptal edildi (konaklama devam ediyor): ${guest?.firstName ?? ''} ${guest?.lastName ?? ''} oda ${rm?.number ?? ''}`,
            id
          );
        });
        pushToast('ok', 'Çıkış iptal edildi — misafir konaklamaya devam ediyor');
        {
          const guest = state.guests.find((g) => g.id === res.guestId);
          const rm = state.rooms.find((r) => r.id === res.roomId);
          sendTelegramNotify(
            `↩️ <b>Çıkış İptal Edildi</b>\n${res.code} — ${guest ? guest.firstName + ' ' + guest.lastName : 'Misafir'}\nOda ${rm?.number ?? '-'} — misafir konaklamaya devam ediyor`
          );
        }
      },

      addExtra: (reservationId, extra) => {
        setState((s) => {
          let next: AppState = {
            ...s,
            reservations: s.reservations.map((r) =>
              r.id === reservationId
                ? { ...r, extras: [...r.extras, { ...extra, id: uid('ex') }] }
                : r
            ),
          };
          next = syncPaymentStatus(next, reservationId);
          return appendLog(next, 'extra', `Ekstra eklendi: ${extra.name}`, reservationId);
        });
        pushToast('ok', 'Ekstra eklendi');
      },

      removeExtra: (reservationId, extraId) => {
        setState((s) => {
          const res = s.reservations.find((r) => r.id === reservationId);
          const extra = res?.extras.find((e) => e.id === extraId);
          let next = extra ? archiveItem(s, 'extra', { reservationId, extra }) : s;
          next = {
            ...next,
            reservations: next.reservations.map((r) =>
              r.id === reservationId
                ? { ...r, extras: r.extras.filter((e) => e.id !== extraId) }
                : r
            ),
          };
          next = syncPaymentStatus(next, reservationId);
          return next;
        });
      },

      addPayment: (payment) => {
        const id = uid('pay');
        setState((s) => {
          const res = s.reservations.find((r) => r.id === payment.reservationId);
          const guest = res ? s.guests.find((g) => g.id === res.guestId) : undefined;
          const room = res ? s.rooms.find((rm) => rm.id === res.roomId) : undefined;
          const guestName = guest ? `${guest.firstName} ${guest.lastName}`.trim() : undefined;
          const staffId = payment.receivedByStaffId || s.currentUserId;
          const isRefund = payment.amount < 0;
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          const roomTag = room ? `Oda ${room.number}` : '';
          const led: LedgerEntry = {
            id: uid('led'),
            date: (payment.date || todayISO()).slice(0, 10),
            time: `${hh}:${mm}`,
            type: isRefund ? 'expense' : 'income',
            category: isRefund ? 'diger_gider' : 'oda_geliri',
            description: isRefund
              ? `İade${roomTag ? ' · ' + roomTag : ''}`
              : `Oda tahsilatı${roomTag ? ' · ' + roomTag : ''}${payment.note ? ' — ' + payment.note : ''}`,
            amount: Math.abs(payment.amount),
            method: payment.method,
            reservationId: payment.reservationId,
            paymentId: id,
            reference: res?.code,
            staffId,
            counterparty: guestName,
            createdAt: new Date().toISOString(),
            createdBy: payment.receivedBy,
          };
          let next: AppState = {
            ...s,
            payments: [{ ...payment, id }, ...s.payments],
            ledger: [led, ...(s.ledger || [])],
          };
          next = syncPaymentStatus(next, payment.reservationId);
          return appendLog(
            next,
            'payment',
            `Ödeme: ${payment.amount} ₺`,
            payment.reservationId
          );
        });
        // Ödeme sonrası fatura uyarısı (pozitif tahsilat)
        if (payment.amount > 0) {
          setState((s) => {
            const res2 = s.reservations.find((r) => r.id === payment.reservationId);
            const staffId = payment.receivedByStaffId || s.currentUserId;
            const staff = s.staff.find((x) => x.id === staffId);
            const inv: Invoice = {
              id: uid('inv'),
              reservationId: payment.reservationId,
              paymentId: id,
              trigger: 'payment',
              amount: payment.amount,
              status: 'pending',
              responsibleStaffId: staffId,
              responsibleName: staff?.name || payment.receivedBy || 'Resepsiyon',
              createdAt: new Date().toISOString(),
              dueAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
            };
            return appendLog(
              { ...s, invoices: [inv, ...(s.invoices || [])] },
              'invoice',
              `Fatura bekleniyor (ödeme): ${res2?.code || ''} ${payment.amount} ₺ — ${inv.responsibleName}`,
              inv.id
            );
          });
        }
        pushToast('ok', `Ödeme kaydedildi: ${payment.amount} ₺` + (payment.amount > 0 ? ' — fatura kesin!' : ''));
      },

      updatePayment: (id, patch) => {
        if (denyIfNotAdmin()) return;
        setState((s) => {
          const payment = s.payments.find((p) => p.id === id);
          if (!payment) return s;
          const merged = { ...payment, ...patch };
          const isRefund = merged.amount < 0;
          let next: AppState = {
            ...s,
            payments: s.payments.map((p) => (p.id === id ? merged : p)),
            // ONEMLI: odemeye karsilik gelen muhasebe kaydi (ledger) da
            // guncellenmezse, Odemeler sayfasi ile Finansal Muhasebe
            // birbirinden FARKLI (eski/yeni kariskik) rakamlar gosterirdi.
            ledger: (s.ledger || []).map((l) =>
              l.paymentId === id
                ? {
                    ...l,
                    date: (merged.date || l.date).slice(0, 10),
                    amount: Math.abs(merged.amount),
                    method: merged.method,
                    type: isRefund ? ('expense' as const) : ('income' as const),
                    category: isRefund ? ('diger_gider' as const) : l.category,
                  }
                : l
            ),
          };
          next = syncPaymentStatus(next, payment.reservationId);
          return appendLog(next, 'payment', `Ödeme düzenlendi: ${merged.amount} ₺`, payment.reservationId);
        });
        pushToast('ok', 'Ödeme güncellendi');
      },

      deletePayment: (id) => {
        if (denyIfNotAdmin()) return;
        setState((s) => {
          const payment = s.payments.find((p) => p.id === id);
          if (!payment) return s;
          let next: AppState = {
            ...s,
            payments: s.payments.map((p) =>
              p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p
            ),
            // Iliskili muhasebe kaydini da arsivle — kasa raporunda cift gorunmesin
            ledger: (s.ledger || []).map((l) =>
              l.paymentId === id ? { ...l, deletedAt: new Date().toISOString() } : l
            ),
          };
          next = syncPaymentStatus(next, payment.reservationId);
          return appendLog(next, 'payment', `Ödeme silindi: ${payment.amount} ₺`, payment.reservationId);
        });
        pushToast('info', 'Ödeme silindi');
      },

      addStaff: (staff) => {
        if (denyIfNotManager()) return;
        const id = uid('staff');
        setState((s) =>
          appendLog({ ...s, staff: [...s.staff, { ...staff, id }] }, 'staff', `Personel eklendi: ${staff.name}`, id)
        );
        pushToast('ok', 'Personel eklendi');
      },

      updateStaff: (id, patch) => {
        if (denyIfNotManager()) return;
        setState((s) => ({
          ...s,
          staff: s.staff.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }));
      },

      deleteStaff: (id) => {
        if (denyIfNotManager()) return;
        if (id === state.currentUserId) {
          pushToast('err', 'Aktif kullanıcı arşivlenemez. Önce başka personele geçin.');
          return;
        }
        setState((s) => {
          const staff = s.staff.find((x) => x.id === id);
          if (!staff) return s;
          let next = archiveItem(s, 'staff', staff);
          next = {
            ...next,
            staff: next.staff.map((x) =>
              x.id === id ? { ...x, deletedAt: new Date().toISOString(), active: false } : x
            ),
          };
          return appendLog(next, 'staff', `Personel arşivlendi: ${staff.name}`, id);
        });
        pushToast('info', 'Personel arşive alındı');
      },

      restoreStaff: (id) => {
        setState((s) => ({
          ...s,
          staff: s.staff.map((x) =>
            x.id === id ? { ...x, deletedAt: undefined, active: true } : x
          ),
        }));
        pushToast('ok', 'Personel geri yüklendi');
      },

      setCurrentUser: (id) => {
        setState((s) => ({ ...s, currentUserId: id }));
      },

      addTask: (task) => {
        const id = uid('task');
        setState((s) => {
          let next: AppState = {
            ...s,
            tasks: [{ ...task, id, createdAt: new Date().toISOString() }, ...s.tasks],
          };
          if (task.roomId && task.type.includes('Temizlik')) {
            next = {
              ...next,
              rooms: next.rooms.map((r) =>
                r.id === task.roomId
                  ? {
                      ...r,
                      housekeeping: 'dirty' as const,
                      status: r.status === 'available' ? ('cleaning' as const) : r.status,
                    }
                  : r
              ),
            };
          }
          return appendLog(next, 'housekeeping', `Görev oluşturuldu: ${task.type}`, id);
        });
        pushToast('ok', 'Görev oluşturuldu');
      },

      updateTask: (id, patch) => {
        setState((s) => {
          const task = s.tasks.find((t) => t.id === id);
          let rooms = s.rooms;
          if (task && patch.status === 'done') {
            rooms = s.rooms.map((r) =>
              r.id === task.roomId
                ? {
                    ...r,
                    housekeeping: 'clean' as const,
                    lastCleaned: todayISO(),
                    status: r.status === 'cleaning' ? ('available' as const) : r.status,
                  }
                : r
            );
          }
          if (task && patch.status === 'in_progress') {
            rooms = s.rooms.map((r) =>
              r.id === task.roomId ? { ...r, housekeeping: 'in_progress' as const } : r
            );
          }
          return {
            ...s,
            rooms,
            tasks: s.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    ...patch,
                    completedAt:
                      patch.status === 'done' ? new Date().toISOString() : t.completedAt,
                  }
                : t
            ),
          };
        });
      },

      deleteTask: (id) => {
        setState((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;
          let next = archiveItem(s, 'task', task);
          next = {
            ...next,
            tasks: next.tasks.map((t) =>
              t.id === id ? { ...t, deletedAt: new Date().toISOString(), status: 'cancelled' as const } : t
            ),
          };
          return next;
        });
      },

      updateSettings: (patch) => {
        setState((s) =>
          appendLog(
            { ...s, settings: { ...s.settings, ...patch } },
            'settings',
            'Otel ayarları güncellendi'
          )
        );
        pushToast('ok', 'Ayarlar kaydedildi');
      },

      resetData: () => {
        // Always snapshot first — data is never lost
        const fresh = safeResetToSeed();
        setState(fresh);
        pushToast('info', 'Demo veri yüklendi. Eski veriniz anlık görüntülerde duruyor.');
      },

      importState: (data) => {
        pushSnapshot(stateRef.current, 'İçe aktarma öncesi');
        setState((s) =>
          appendLog(
            {
              ...data,
              archive: [...(data.archive ?? []), ...(s.archive ?? [])].slice(0, 500),
            },
            'system',
            'Veri içe aktarıldı'
          )
        );
        pushToast('ok', 'Veri içe aktarıldı ve yedeklendi');
      },

      createManualSnapshot: (label) => {
        pushSnapshot(stateRef.current, label || `Manuel yedek ${new Date().toLocaleString('tr-TR')}`);
        saveState(stateRef.current);
        setLastSaved(new Date().toISOString());
        pushToast('ok', 'Anlık görüntü kaydedildi');
      },

      getSnapshots: () => listSnapshots(),

      restoreSnapshotById: (id) => {
        const data = restoreSnapshot(id);
        if (!data) {
          pushToast('err', 'Anlık görüntü bulunamadı');
          return false;
        }
        setState(data);
        pushToast('ok', 'Anlık görüntü geri yüklendi');
        return true;
      },

      restoreLastBackup: () => {
        const data = restoreFromBackup();
        if (!data) {
          pushToast('err', 'Yedek bulunamadı');
          return false;
        }
        setState(data);
        pushToast('ok', 'Son yedekten geri yüklendi');
        return true;
      },

      exportFullBackup: () => {
        downloadFullBackup(stateRef.current);
        pushToast('ok', 'Tam yedek indirildi');
      },

      restoreArchived: (archiveId) => {
        const entry = state.archive?.find((a) => a.id === archiveId);
        if (!entry) {
          pushToast('err', 'Arşiv kaydı yok');
          return false;
        }
        setState((s) => {
          const data = entry.data as Record<string, unknown>;
          let next = { ...s };
          if (entry.entity === 'room' && data.id) {
            next.rooms = next.rooms.map((r) =>
              r.id === data.id ? { ...r, deletedAt: undefined } : r
            );
          } else if (entry.entity === 'guest' && data.id) {
            next.guests = next.guests.map((g) =>
              g.id === data.id ? { ...g, deletedAt: undefined } : g
            );
          } else if (entry.entity === 'staff' && data.id) {
            next.staff = next.staff.map((x) =>
              x.id === data.id ? { ...x, deletedAt: undefined, active: true } : x
            );
          } else if (entry.entity === 'task' && data.id) {
            next.tasks = next.tasks.map((t) =>
              t.id === data.id ? { ...t, deletedAt: undefined } : t
            );
          }
          next.archive = (next.archive ?? []).filter((a) => a.id !== archiveId);
          return appendLog(next, 'system', `Arşivden geri yüklendi: ${entry.entity}`);
        });
        pushToast('ok', 'Arşivden geri yüklendi');
        return true;
      },

      addLedgerEntry: (entry) => {
        const id = uid('led');
        setState((s) =>
          appendLog(
            {
              ...s,
              ledger: [
                {
                  ...entry,
                  id,
                  time: entry.time || (() => { const n = new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; })(),
                  date: (entry.date || todayISO()).slice(0, 10),
                  createdAt: new Date().toISOString(),
                  createdBy: entry.createdBy || s.staff.find((x) => x.id === s.currentUserId)?.name,
                },
                ...(s.ledger || []),
              ],
            },
            'finance',
            `Muhasebe: ${entry.type === 'income' ? 'Gelir' : 'Gider'} ${entry.amount} ₺ — ${entry.description}`,
            id
          )
        );
        pushToast('ok', 'Muhasebe kaydı eklendi');
        return id;
      },

      updateLedgerEntry: (id, patch) => {
        setState((s) => {
          const entry = (s.ledger || []).find((e) => e.id === id);
          if (!entry) return s;
          const merged = { ...entry, ...patch };
          let next: AppState = {
            ...s,
            ledger: (s.ledger || []).map((e) => (e.id === id ? merged : e)),
          };
          // ONEMLI: bu muhasebe kaydi bir Odeme'ye (Payment) bagliysa,
          // Finansal Muhasebe'den yapilan degisiklik SADECE ledger'da kalıyordu
          // — ilgili Payment kaydi guncellenmedigi icin Takvim/Rezervasyon
          // ekranlarındaki bakiye hesabı (state.payments'tan canli hesaplanır)
          // eski rakamı göstermeye devam ediyordu. Payments sayfasından yapılan
          // düzenleme zaten ledger'a yansıyordu (updatePayment) — bu, onun ters
          // yön karsiligi.
          if (entry.paymentId) {
            const validMethods = ['cash', 'card', 'transfer', 'online', 'other'];
            const isRefund = merged.type === 'expense';
            next = {
              ...next,
              payments: s.payments.map((p) =>
                p.id === entry.paymentId
                  ? {
                      ...p,
                      amount: isRefund ? -Math.abs(merged.amount) : Math.abs(merged.amount),
                      method: validMethods.includes(merged.method as string)
                        ? (merged.method as Payment['method'])
                        : p.method,
                      date: (merged.date || p.date).slice(0, 10),
                    }
                  : p
              ),
            };
            const linkedPayment = next.payments.find((p) => p.id === entry.paymentId);
            if (linkedPayment) next = syncPaymentStatus(next, linkedPayment.reservationId);
          }
          return appendLog(next, 'finance', `Muhasebe kaydı düzenlendi: ${merged.description}`, id);
        });
        pushToast('ok', 'Muhasebe kaydı güncellendi');
      },

      deleteLedgerEntry: (id) => {
        if (denyIfNotManager()) return;
        setState((s) => {
          const entry = (s.ledger || []).find((e) => e.id === id);
          if (!entry) return s;
          let next = archiveItem(s, 'ledger', entry);
          next = {
            ...next,
            ledger: (next.ledger || []).map((e) =>
              e.id === id ? { ...e, deletedAt: new Date().toISOString() } : e
            ),
          };
          return appendLog(next, 'finance', `Muhasebe kaydı arşivlendi: ${entry.description}`, id);
        });
        pushToast('info', 'Kayıt arşive alındı');
      },

      addRecurringExpense: (e) => {
        const id = uid('rec');
        setState((s) => ({
          ...s,
          recurringExpenses: [...(s.recurringExpenses || []), { ...e, id }],
        }));
        pushToast('ok', 'Tekrarlayan gider eklendi');
      },

      updateRecurringExpense: (id, patch) => {
        setState((s) => ({
          ...s,
          recurringExpenses: (s.recurringExpenses || []).map((e) =>
            e.id === id ? { ...e, ...patch } : e
          ),
        }));
      },

      deleteRecurringExpense: (id) => {
        if (denyIfNotManager()) return;
        setState((s) => ({
          ...s,
          recurringExpenses: (s.recurringExpenses || []).map((e) =>
            e.id === id ? { ...e, deletedAt: new Date().toISOString(), active: false } : e
          ),
        }));
      },

      // ---- Bakim / Ariza ----
      addMaintenanceIssue: (issue) => {
        const id = uid('maint');
        const creatorName = state.staff.find((x) => x.id === state.currentUserId)?.name;
        setState((s) => {
          const room = issue.roomId ? s.rooms.find((r) => r.id === issue.roomId) : undefined;
          const next: MaintenanceIssue = {
            ...issue,
            id,
            status: 'open',
            createdAt: new Date().toISOString(),
            createdBy: creatorName,
          };
          return appendLog(
            { ...s, maintenanceIssues: [next, ...(s.maintenanceIssues || [])] },
            'maintenance',
            `Arıza/bakım kaydı: ${issue.title}${room ? ' · Oda ' + room.number : ''}`,
            id
          );
        });
        pushToast('ok', 'Kayıt oluşturuldu');
        sendTelegramNotify(`🔧 <b>Yeni Arıza/Bakım Kaydı</b>\n${issue.title}`);
      },

      updateMaintenanceIssue: (id, patch) => {
        setState((s) => ({
          ...s,
          maintenanceIssues: (s.maintenanceIssues || []).map((m) =>
            m.id === id ? { ...m, ...patch } : m
          ),
        }));
      },

      completeMaintenanceIssue: (id, notes) => {
        setState((s) => {
          const issue = (s.maintenanceIssues || []).find((m) => m.id === id);
          const next = {
            ...s,
            maintenanceIssues: (s.maintenanceIssues || []).map((m) =>
              m.id === id
                ? { ...m, status: 'done' as const, completedAt: new Date().toISOString(), notes: notes ?? m.notes }
                : m
            ),
          };
          return appendLog(next, 'maintenance', `Tamamlandı: ${issue?.title || id}`, id);
        });
        pushToast('ok', 'İş tamamlandı olarak işaretlendi');
      },

      deleteMaintenanceIssue: (id) => {
        if (denyIfNotManager()) return;
        setState((s) => ({
          ...s,
          maintenanceIssues: (s.maintenanceIssues || []).map((m) =>
            m.id === id ? { ...m, deletedAt: new Date().toISOString() } : m
          ),
        }));
        pushToast('info', 'Kayıt silindi');
      },

      // ---- Menu / Kafe ----
      addMenuItem: (item) => {
        const id = uid('menu');
        setState((s) => ({ ...s, menuItems: [...(s.menuItems || []), { ...item, id }] }));
        pushToast('ok', 'Ürün eklendi');
      },

      updateMenuItem: (id, patch) => {
        setState((s) => ({
          ...s,
          menuItems: (s.menuItems || []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }));
      },

      deleteMenuItem: (id) => {
        setState((s) => ({
          ...s,
          menuItems: (s.menuItems || []).map((m) =>
            m.id === id ? { ...m, deletedAt: new Date().toISOString() } : m
          ),
        }));
      },

      createCafeOrder: (order) => {
        const res = state.reservations.find((r) => r.id === order.reservationId && !r.deletedAt);
        if (!res) return { error: 'Rezervasyon bulunamadı' };
        if (!order.items.length) return { error: 'Sepet boş' };
        // Stok kontrolu (varsa) — 0 stoklu urun siparis edilemesin
        for (const line of order.items) {
          const mi = state.menuItems?.find((m) => m.id === line.menuItemId);
          if (mi && typeof mi.stock === 'number' && mi.stock < line.qty) {
            return { error: `${mi.name} için yeterli stok yok (kalan: ${mi.stock})` };
          }
        }
        const id = uid('order');
        const total = order.items.reduce((a, it) => a + it.price * it.qty, 0);
        setState((s) => {
          const guest = s.guests.find((g) => g.id === order.guestId);
          const room = s.rooms.find((r) => r.id === (order.roomId || res.roomId));
          const next: CafeOrder = {
            id,
            reservationId: order.reservationId,
            guestId: order.guestId,
            roomId: order.roomId || res.roomId,
            items: order.items,
            total,
            status: 'pending',
            note: order.note,
            placedBy: order.placedBy,
            createdAt: new Date().toISOString(),
          };
          const updated = appendLog(
            { ...s, cafeOrders: [next, ...(s.cafeOrders || [])] },
            'order',
            `Yeni sipariş${order.placedBy ? ' (telefon/personel)' : ''}: ${res.code} · Oda ${room?.number ?? '-'} · ${total.toFixed(2)} ₺`,
            id
          );
          const guestName = guest ? `${guest.firstName} ${guest.lastName}` : 'Misafir';
          const itemsList = order.items.map((it) => `${it.qty}x ${it.name}`).join(', ');
          sendTelegramNotify(
            `🛎️ <b>${order.placedBy ? 'Telefon Siparişi' : 'Yeni Oda Servisi Siparişi'}</b>\n${res.code} — ${guestName}\nOda ${room?.number ?? '-'}\n${itemsList}\nToplam: ${total.toFixed(2)} ₺${order.placedBy ? `\nAlan: ${order.placedBy}` : ''}`
          );
          return updated;
        });
        return id;
      },

      deliverCafeOrder: (id) => {
        setState((s) => {
          const order = (s.cafeOrders || []).find((o) => o.id === id);
          if (!order || order.status !== 'pending') return s;
          const res = s.reservations.find((r) => r.id === order.reservationId);
          let next: AppState = {
            ...s,
            cafeOrders: (s.cafeOrders || []).map((o) =>
              o.id === id ? { ...o, status: 'delivered' as const, deliveredAt: new Date().toISOString() } : o
            ),
            // Teslim edilen urunler stoktan dusulur (stok takibi acik olanlar icin)
            menuItems: (s.menuItems || []).map((m) => {
              const line = order.items.find((it) => it.menuItemId === m.id);
              if (!line || typeof m.stock !== 'number') return m;
              const remaining = Math.max(0, m.stock - line.qty);
              return { ...m, stock: remaining, available: remaining > 0 ? m.available : false };
            }),
          };
          // Siparis tutari misafirin oda hesabina (ekstra) eklensin.
          // Genel KDV artik rezervasyon toplamina eklenmiyor, dolayisiyla
          // menude gorunen fiyat ile misafirden istenen fiyat zaten birebir ayni.
          if (res) {
            const itemsDesc = order.items.map((it) => `${it.qty}x ${it.name}`).join(', ');
            const extra: ExtraCharge = {
              id: uid('extra'),
              name: `Oda Servisi Siparişi: ${itemsDesc}`,
              amount: order.total,
              quantity: 1,
              date: todayISO(),
              category: 'Oda Servisi',
            };
            next = {
              ...next,
              reservations: next.reservations.map((r) =>
                r.id === res.id ? { ...r, extras: [...(r.extras || []), extra] } : r
              ),
            };
          }
          return appendLog(
            next,
            'order',
            `Sipariş teslim edildi: ${res?.code || order.id} · ${order.items.map((it) => `${it.qty}x ${it.name}`).join(', ')}`,
            id
          );
        });
        pushToast('ok', 'Sipariş teslim edildi, oda hesabına eklendi');
      },

      cancelCafeOrder: (id) => {
        setState((s) => ({
          ...s,
          cafeOrders: (s.cafeOrders || []).map((o) => (o.id === id ? { ...o, status: 'cancelled' as const } : o)),
        }));
        pushToast('info', 'Sipariş iptal edildi');
      },

      generatePayroll: (yearMonth, staffIds) => {
        let count = 0;
        setState((s) => {
          const existing = (s.ledger || []).filter(
            (e) =>
              !e.deletedAt &&
              e.category === 'personel_maas' &&
              e.date.startsWith(yearMonth) &&
              e.method === 'salary'
          );
          const existingStaff = new Set(existing.map((e) => e.staffId).filter(Boolean));
          const day = `${yearMonth}-01`;
          const newEntries: LedgerEntry[] = [];
          const targetIds = staffIds && staffIds.length
            ? new Set(staffIds)
            : null;
          s.staff
            .filter((st) => st.active && !st.deletedAt && (st.salary || 0) > 0)
            .filter((st) => (targetIds ? targetIds.has(st.id) : true))
            .forEach((st) => {
              if (existingStaff.has(st.id)) return;
              newEntries.push({
                id: uid('led'),
                date: day,
                time: '10:00',
                type: 'expense',
                category: 'personel_maas',
                description: `Maaş: ${st.name} (${yearMonth})`,
                amount: st.salary || 0,
                method: 'salary',
                staffId: st.id,
                account: 'Banka TRY',
                counterparty: st.name,
                createdAt: new Date().toISOString(),
                createdBy: s.staff.find((x) => x.id === s.currentUserId)?.name || 'Sistem',
              });
            });
          count = newEntries.length;
          if (!newEntries.length) return s;
          return appendLog(
            { ...s, ledger: [...newEntries, ...(s.ledger || [])] },
            'finance',
            `${yearMonth} maaş: ${newEntries.length} personel`
          );
        });
        if (count) pushToast('ok', `${count} maaş kaydı oluşturuldu`);
        else pushToast('info', 'Seçilen personel için bu ay maaş zaten işlenmiş veya seçim yok');
        return count;
      },

      payStaffSalary: (staffId, yearMonth, amount) => {
        const st = stateRef.current.staff.find((x) => x.id === staffId && !x.deletedAt);
        if (!st) return { error: 'Personel bulunamadı' };
        const already = (stateRef.current.ledger || []).some(
          (e) =>
            !e.deletedAt &&
            e.staffId === staffId &&
            e.category === 'personel_maas' &&
            e.date.startsWith(yearMonth) &&
            e.method === 'salary'
        );
        if (already) return { error: `${st.name} için ${yearMonth} maaşı zaten ödenmiş` };
        const payAmount = amount ?? st.salary ?? 0;
        if (payAmount <= 0) return { error: 'Maaş tutarı tanımlı değil' };
        const id = uid('led');
        const day = `${yearMonth}-01`;
        setState((s) =>
          appendLog(
            {
              ...s,
              ledger: [
                {
                  id,
                  date: day,
                  time: new Date().toTimeString().slice(0, 5),
                  type: 'expense',
                  category: 'personel_maas',
                  description: `Maaş: ${st.name} (${yearMonth})`,
                  amount: payAmount,
                  method: 'salary',
                  staffId,
                  account: 'Banka TRY',
                  counterparty: st.name,
                  createdAt: new Date().toISOString(),
                  createdBy: s.staff.find((x) => x.id === s.currentUserId)?.name || 'Sistem',
                },
                ...(s.ledger || []),
              ],
            },
            'finance',
            `Maaş ödendi: ${st.name} ${payAmount} ₺`,
            id
          )
        );
        pushToast('ok', `${st.name} maaşı kaydedildi`);
        return id;
      },

      postRecurringExpense: (recurringId, yearMonth) => {
        const r = (stateRef.current.recurringExpenses || []).find(
          (x) => x.id === recurringId && !x.deletedAt
        );
        if (!r) return { error: 'Şablon bulunamadı' };
        const already = (stateRef.current.ledger || []).some(
          (e) =>
            !e.deletedAt &&
            e.type === 'expense' &&
            e.category === r.category &&
            e.reference === r.id &&
            e.date.startsWith(yearMonth)
        );
        if (already) return { error: 'Bu şablon bu ay zaten işlenmiş' };
        const day = String(Math.min(28, Math.max(1, r.dayOfMonth))).padStart(2, '0');
        const id = uid('led');
        setState((s) => ({
          ...s,
          ledger: [
            {
              id,
              date: `${yearMonth}-${day}`,
              time: '09:00',
              type: 'expense' as const,
              category: r.category,
              description: `${r.name} (${yearMonth})`,
              amount: r.amount,
              method: 'transfer' as const,
              reference: r.id,
              notes: r.notes,
              account: 'Banka TRY',
              createdAt: new Date().toISOString(),
              createdBy: 'Sistem',
            },
            ...(s.ledger || []),
          ],
          recurringExpenses: (s.recurringExpenses || []).map((x) =>
            x.id === r.id ? { ...x, lastGenerated: yearMonth } : x
          ),
        }));
        pushToast('ok', `${r.name} deftere eklendi`);
        return id;
      },

      addStaffDebt: (debt) => {
        const id = uid('debt');
        setState((s) =>
          appendLog(
            {
              ...s,
              staffDebts: [
                {
                  ...debt,
                  id,
                  remaining: debt.amount,
                  status: 'open',
                  createdAt: new Date().toISOString(),
                  createdBy:
                    debt.createdBy ||
                    s.staff.find((x) => x.id === s.currentUserId)?.name,
                },
                ...(s.staffDebts || []),
              ],
            },
            'finance',
            `Personel borcu: ${debt.amount} ₺`,
            id
          )
        );
        pushToast('ok', 'Personel borcu eklendi');
        return id;
      },

      payStaffDebt: (debtId, amount, opts) => {
        const debt = (stateRef.current.staffDebts || []).find((d) => d.id === debtId && !d.deletedAt);
        if (!debt) return { error: 'Borç bulunamadı' };
        if (debt.remaining <= 0) return { error: 'Borç zaten kapanmış' };
        const pay = Math.min(amount, debt.remaining);
        if (pay <= 0) return { error: 'Geçersiz tutar' };
        const staff = stateRef.current.staff.find((x) => x.id === debt.staffId);
        const payId = uid('dp');
        const ledId = uid('led');
        const date = (opts?.date || todayISO()).slice(0, 10);
        const method = opts?.method || 'cash';
        setState((s) => {
          const remaining = Math.round((debt.remaining - pay) * 100) / 100;
          const status = remaining <= 0.01 ? 'paid' : 'partial';
          const payment: StaffDebtPayment = {
            id: payId,
            debtId,
            amount: pay,
            date,
            time: new Date().toTimeString().slice(0, 5),
            method,
            note: opts?.note,
            ledgerId: ledId,
            createdAt: new Date().toISOString(),
            createdBy: s.staff.find((x) => x.id === s.currentUserId)?.name,
          };
          const led: LedgerEntry = {
            id: ledId,
            date,
            time: payment.time,
            type: 'expense',
            category: 'personel_maas',
            description: `Borç tahsilatı / avans mahsup: ${staff?.name || ''} — ${debt.description}`,
            amount: pay,
            method: method as LedgerEntry['method'],
            staffId: debt.staffId,
            counterparty: staff?.name,
            account: 'Ana Kasa',
            reference: debtId,
            notes: opts?.note,
            createdAt: new Date().toISOString(),
            createdBy: payment.createdBy,
          };
          return appendLog(
            {
              ...s,
              staffDebts: (s.staffDebts || []).map((d) =>
                d.id === debtId
                  ? {
                      ...d,
                      remaining: Math.max(0, remaining),
                      status: status as StaffDebt['status'],
                    }
                  : d
              ),
              staffDebtPayments: [payment, ...(s.staffDebtPayments || [])],
              ledger: [led, ...(s.ledger || [])],
            },
            'finance',
            `Borç ödemesi: ${pay} ₺ (${staff?.name || ''})`,
            debtId
          );
        });
        pushToast('ok', `Borç ödemesi kaydedildi: ${pay} ₺`);
        return payId;
      },

      deleteStaffDebt: (debtId) => {
        if (denyIfNotManager()) return;
        setState((s) => ({
          ...s,
          staffDebts: (s.staffDebts || []).map((d) =>
            d.id === debtId ? { ...d, deletedAt: new Date().toISOString() } : d
          ),
        }));
        pushToast('info', 'Borç arşivlendi');
      },

      generateRecurringForMonth: (yearMonth) => {
        let count = 0;
        setState((s) => {
          const newEntries: LedgerEntry[] = [];
          (s.recurringExpenses || [])
            .filter((r) => r.active && !r.deletedAt)
            .forEach((r) => {
              const day = String(Math.min(28, Math.max(1, r.dayOfMonth))).padStart(2, '0');
              const date = `${yearMonth}-${day}`;
              const already = (s.ledger || []).some(
                (e) =>
                  !e.deletedAt &&
                  e.type === 'expense' &&
                  e.category === r.category &&
                  e.description.includes(r.name) &&
                  e.date.startsWith(yearMonth)
              );
              if (already) return;
              newEntries.push({
                id: uid('led'),
                date,
                type: 'expense',
                category: r.category,
                description: `${r.name} (${yearMonth})`,
                amount: r.amount,
                method: 'transfer',
                reference: r.id,
                notes: r.notes,
                createdAt: new Date().toISOString(),
                createdBy: 'Sistem',
              });
            });
          count = newEntries.length;
          if (!newEntries.length) return s;
          const recIds = new Set(newEntries.map((e) => e.reference));
          return {
            ...s,
            ledger: [...newEntries, ...(s.ledger || [])],
            recurringExpenses: (s.recurringExpenses || []).map((r) =>
              recIds.has(r.id) ? { ...r, lastGenerated: yearMonth } : r
            ),
          };
        });
        if (count) pushToast('ok', `${count} zorunlu gider işlendi`);
        else pushToast('info', 'Bu ay için tekrarlayan giderler zaten işlenmiş');
        return count;
      },

      syncPaymentToLedger: (paymentId) => {
        setState((s) => {
          const p = s.payments.find((x) => x.id === paymentId);
          if (!p || p.deletedAt) return s;
          if ((s.ledger || []).some((e) => e.paymentId === paymentId && !e.deletedAt)) return s;
          const res = s.reservations.find((r) => r.id === p.reservationId);
          const guest = res ? s.guests.find((g) => g.id === res.guestId) : undefined;
          const room = res ? s.rooms.find((rm) => rm.id === res.roomId) : undefined;
          const guestName = guest ? `${guest.firstName} ${guest.lastName}`.trim() : undefined;
          const roomTag = room ? `Oda ${room.number}` : '';
          const isRefund = p.amount < 0;
          const entry: LedgerEntry = {
            id: uid('led'),
            date: p.date.slice(0, 10),
            type: isRefund ? 'expense' : 'income',
            category: isRefund ? 'diger_gider' : 'oda_geliri',
            description: isRefund
              ? `İade${roomTag ? ' · ' + roomTag : ''}`
              : `Oda tahsilatı${roomTag ? ' · ' + roomTag : ''}${p.note ? ' — ' + p.note : ''}`,
            amount: Math.abs(p.amount),
            method: p.method,
            reservationId: p.reservationId,
            paymentId: p.id,
            reference: res?.code,
            staffId: p.receivedByStaffId || s.currentUserId,
            counterparty: guestName,
            createdAt: new Date().toISOString(),
            createdBy: p.receivedBy,
          };
          return { ...s, ledger: [entry, ...(s.ledger || [])] };
        });
      },

      addCompanion: (reservationId, input) => {
        const res = stateRef.current.reservations.find((r) => r.id === reservationId && !r.deletedAt);
        if (!res) return { error: 'Rezervasyon bulunamadı' };
        let guestId = '';
        let isExtra = false;
        let isChild = false;
        let relation = '';
        if ('guestId' in input) {
          guestId = input.guestId;
          isExtra = !!input.isExtra;
          isChild = !!input.isChild;
          relation = input.relation || '';
        } else {
          guestId = '';
          // create guest inside setState
          isExtra = !!input.isExtra;
          isChild = !!input.isChild;
          relation = input.relation || '';
        }
        let companionId = '';
        setState((s) => {
          let gid = guestId;
          let next = s;
          if ('newGuest' in input) {
            gid = uid('guest');
            next = {
              ...s,
              guests: [
                ...s.guests,
                {
                  ...input.newGuest,
                  id: gid,
                  createdAt: todayISO(),
                  totalStays: 0,
                  totalSpent: 0,
                },
              ],
            };
          }
          if (!gid) return s;
          // prevent duplicate
          const existing = next.reservations.find((r) => r.id === reservationId);
          if (!existing) return s;
          if (existing.guestId === gid) return s;
          if ((existing.companions || []).some((c) => c.guestId === gid)) return s;
          companionId = uid('cmp');
          const comp: StayCompanion = {
            id: companionId,
            guestId: gid,
            isExtra,
            isChild,
            relation: relation || undefined,
            addedAt: new Date().toISOString(),
          };
          const g = next.guests.find((x) => x.id === gid);
          return appendLog(
            {
              ...next,
              reservations: next.reservations.map((r) =>
                r.id === reservationId
                  ? {
                      ...r,
                      companions: [...(r.companions || []), comp],
                      // ONEMLI: kisi sayisi sadece GERCEKTEN ekstra (plana dahil
                      // olmayan, sonradan eklenen) misafirlerde artar. Check-in
                      // sirasinda zaten rezervasyonun adults/children sayisina
                      // dahil olan ki\u015finin kimligini kaydederken (isExtra=false)
                      // toplam kisi sayisi TEKRAR artmamali — aksi halde 2 ki\u015filik
                      // rezervasyon, 1 ki\u015fi eklenince yanli\u015flikla 3 g\u00f6r\u00fcn\u00fcyordu.
                      adults: isExtra && !isChild ? r.adults + 1 : r.adults,
                      children: isExtra && isChild ? r.children + 1 : r.children,
                    }
                  : r
              ),
            },
            'guest',
            `Odaya misafir eklendi: ${g?.firstName || ''} ${g?.lastName || ''}${isExtra ? ' (ekstra)' : ''}`,
            reservationId
          );
        });
        if (!companionId && !('newGuest' in input) && !guestId) return { error: 'Misafir seçilmedi' };
        pushToast('ok', 'Misafir odaya eklendi');
        return companionId || 'ok';
      },

      removeCompanion: (reservationId, companionId) => {
        setState((s) => ({
          ...s,
          reservations: s.reservations.map((r) => {
            if (r.id !== reservationId) return r;
            const comp = (r.companions || []).find((c) => c.id === companionId);
            return {
              ...r,
              companions: (r.companions || []).filter((c) => c.id !== companionId),
              // Eklerken sadece gercek ekstra misafirlerde kisi sayisi artmisti,
              // simetrik olarak sadece o durumda geri dusurulur.
              adults: comp?.isExtra && !comp.isChild ? Math.max(0, r.adults - 1) : r.adults,
              children: comp?.isExtra && comp.isChild ? Math.max(0, r.children - 1) : r.children,
            };
          }),
        }));
        pushToast('info', 'Misafir odadan çıkarıldı');
      },

      issueInvoice: (invoiceId, payload) => {
        if (!payload.invoiceNumber?.trim()) return;
        if (!payload.fileData || !payload.fileName) {
          pushToast('err', 'Fatura dosyası yüklenmeden kesildi işaretlenemez');
          return;
        }
        // size guard ~4.5MB base64
        if (payload.fileData.length > 6_000_000) {
          pushToast('err', 'Dosya çok büyük (max ~4MB). Drive linki kullanın.');
          return;
        }
        setState((s) => {
          const inv = (s.invoices || []).find((i) => i.id === invoiceId);
          if (!inv) return s;
          return appendLog(
            {
              ...s,
              invoices: (s.invoices || []).map((i) =>
                i.id === invoiceId
                  ? {
                      ...i,
                      status: 'issued' as const,
                      issuedAt: new Date().toISOString(),
                      invoiceNumber: payload.invoiceNumber.trim(),
                      fileName: payload.fileName,
                      fileMime: payload.fileMime,
                      fileData: payload.fileData,
                      driveUrl: payload.driveUrl,
                      notes: payload.notes,
                    }
                  : i
              ),
            },
            'invoice',
            `Fatura kesildi: ${payload.invoiceNumber} (${inv.responsibleName})`,
            invoiceId
          );
        });
        pushToast('ok', 'Fatura arşive kaydedildi');
      },

      cancelInvoice: (invoiceId) => {
        setState((s) => ({
          ...s,
          invoices: (s.invoices || []).map((i) =>
            i.id === invoiceId ? { ...i, status: 'cancelled' as const } : i
          ),
        }));
      },

      createManualInvoice: (reservationId, amount) => {
        const res = stateRef.current.reservations.find((r) => r.id === reservationId);
        if (!res) return { error: 'Rezervasyon yok' };
        const id = uid('inv');
        setState((s) => {
          const staff = s.staff.find((x) => x.id === s.currentUserId);
          const inv: Invoice = {
            id,
            reservationId,
            trigger: 'manual',
            amount: amount ?? grandTotal(res),
            status: 'pending',
            responsibleStaffId: s.currentUserId,
            responsibleName: staff?.name || 'Personel',
            createdAt: new Date().toISOString(),
            dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          };
          return { ...s, invoices: [inv, ...(s.invoices || [])] };
        });
        pushToast('ok', 'Fatura görevi oluşturuldu');
        return id;
      },

      log: (type, message, relatedId) => log(type, message, relatedId),
      isRoomAvailable,
      getAvailableRooms,
    }),
    [
      state,
      ready,
      session,
      cloudStatus,
      toasts,
      lastSaved,
      dismissToast,
      pushToast,
      log,
      isRoomAvailable,
      getAvailableRooms,
      presence,
    ]
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreAPI {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
