import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  BedDouble,
  CalendarRange,
} from 'lucide-react';
import { useStore } from '../lib/store';
import type {
  AppState,
  HousekeepingStatus,
  PaymentMethod,
  Reservation,
  Room,
  RoomStatus,
} from '../lib/types';
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  Select,
  statusColor,
} from '../components/ui';
import { balanceDue, grandTotal, nightsOf, paidTotal, paymentMethodSummary } from '../lib/calculations';
import {
  addDays,
  cn,
  formatCurrency,
  formatDate,
  HK_STATUS_LABELS,
  PAY_STATUS_LABELS,
  RES_STATUS_LABELS,
  ROOM_STATUS_LABELS,
  ROOM_TYPE_LABELS,
  todayISO,
  PAY_METHOD_LABELS,
  formatDateTime,
} from '../lib/utils';

type KpiPanel = 'occupancy' | 'available' | 'arrivals' | 'departures' | null;

type ViewMode = 'day' | 'week' | '14' | 'month';

const DAY_PX: Record<ViewMode, number> = {
  day: 56,
  week: 118,
  '14': 86,
  month: 42,
};

const STATUS_BAR: Record<string, string> = {
  pending: 'from-amber-400 to-amber-500 text-amber-950',
  confirmed: 'from-teal-400 to-teal-600 text-white',
  checked_in: 'from-blue-500 to-indigo-600 text-white',
  checked_out: 'from-slate-300 to-slate-400 text-slate-700',
};

function parseTimeHour(t: string, fallback: number) {
  const m = /^(\d{1,2})/.exec(t || '');
  if (!m) return fallback;
  const h = Number(m[1]);
  return Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : fallback;
}

function formatClock(d: Date) {
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatClockShort(d: Date) {
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarPage() {
  const {
    state,
    getAvailableRooms,
    isRoomAvailable,
    addReservation,
    updateReservation,
    addGuest,
    checkIn,
    checkOut,
    cancelReservation,
    currentUser,
    isManager,
    isAdmin,
    restoreReservation,
    permanentlyDeleteReservation,
    addPayment,
    updateRoom,
    pushToast,
  } = useStore();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggedResId, setDraggedResId] = useState<string | null>(null);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);
  const [ghostOpen, setGhostOpen] = useState(false);

  const [view, setView] = useState<ViewMode>('14');
  const [anchor, setAnchor] = useState(todayISO());
  const [now, setNow] = useState(() => new Date());
  const [floorFilter, setFloorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [compact, setCompact] = useState(false);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [kpiPanel, setKpiPanel] = useState<KpiPanel>(null);
  const [quickPayMethod, setQuickPayMethod] = useState<Record<string, PaymentMethod>>({});
  const [roomQuick, setRoomQuick] = useState<Room | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState({
    roomId: '',
    checkIn: todayISO(),
    checkOut: addDays(todayISO(), 1),
    checkInTime: '',
    checkOutTime: '11:00',
  });
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    idNumber: '',
    adults: 2,
    children: 0,
    status: 'confirmed' as const,
    source: 'Doğrudan',
    nightlyRate: 0,
    notes: '',
  });
  const [matchedGuestId, setMatchedGuestId] = useState('');
  const [blacklistAck, setBlacklistAck] = useState(false);
  const [createError, setCreateError] = useState('');
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; res: Reservation } | null>(null);

  const guestSuggestions = useMemo(() => {
    if (matchedGuestId) return [];
    const fn = createForm.firstName.trim().toLowerCase();
    const ln = createForm.lastName.trim().toLowerCase();
    const id = createForm.idNumber.trim();
    const ph = createForm.phone.trim();
    if (!fn && !ln && id.length < 3 && ph.length < 3) return [];
    return state.guests
      .filter((g) => !g.deletedAt)
      .filter((g) => {
        const nameHit = fn.length >= 2 && (g.firstName.toLowerCase().includes(fn) || g.lastName.toLowerCase().includes(fn));
        const lastHit = ln.length >= 2 && g.lastName.toLowerCase().includes(ln);
        const idHit = id.length >= 3 && g.idNumber.includes(id);
        const phoneHit = ph.length >= 3 && g.phone.includes(ph);
        return nameHit || lastHit || idHit || phoneHit;
      })
      .slice(0, 6);
  }, [state.guests, createForm.firstName, createForm.lastName, createForm.idNumber, createForm.phone, matchedGuestId]);

  const matchedGuest = matchedGuestId ? state.guests.find((g) => g.id === matchedGuestId) : undefined;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dates = useMemo(() => {
    if (view === 'month') {
      const d = new Date(anchor + 'T12:00:00');
      const y = d.getFullYear();
      const m = d.getMonth();
      const first = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, i) => addDays(first, i));
    }
    const count = view === 'day' ? 1 : view === 'week' ? 7 : 14;
    return Array.from({ length: count }, (_, i) => addDays(anchor, i));
  }, [anchor, view]);

  const rangeStart = dates[0];
  const rangeEndExcl = addDays(dates[dates.length - 1], 1);

  const rooms = useMemo(() => {
    return state.rooms
      .filter((r) => !r.deletedAt)
      .filter((r) => (floorFilter === 'all' ? true : r.floor === Number(floorFilter)))
      .filter((r) => (typeFilter === 'all' ? true : r.type === typeFilter))
      .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
      .sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.number.localeCompare(b.number, undefined, { numeric: true });
      });
  }, [state.rooms, floorFilter, typeFilter, statusFilter]);

  const floors = useMemo(
    () =>
      [...new Set(state.rooms.filter((r) => !r.deletedAt).map((r) => r.floor))].sort(
        (a, b) => a - b
      ),
    [state.rooms]
  );

  const activeRes = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return state.reservations.filter((r) => {
      if (r.deletedAt) return false;
      if (['cancelled', 'no_show'].includes(r.status)) return false;
      if (!(r.checkIn < rangeEndExcl && r.checkOut >= rangeStart)) return false;
      if (!qq) return true;
      const g = state.guests.find((x) => x.id === r.guestId);
      const room = state.rooms.find((x) => x.id === r.roomId);
      return (
        r.code.toLowerCase().includes(qq) ||
        (g?.firstName.toLowerCase().includes(qq) ?? false) ||
        (g?.lastName.toLowerCase().includes(qq) ?? false) ||
        (room?.number.includes(qq) ?? false)
      );
    });
  }, [state, rangeStart, rangeEndExcl, q]);

  const unitPx = compact ? Math.round(DAY_PX[view] * 0.62) : DAY_PX[view];
  const isHourly = view === 'day';
  const colCount = isHourly ? 24 : dates.length;
  const gridWidth = colCount * unitPx;
  const rowH = compact ? 28 : 58;
  const labelW = compact ? 84 : 136;
  const headerH = compact ? (isHourly ? 40 : 50) : isHourly ? 58 : 76;
  const checkInH = parseTimeHour(state.settings.checkInTime, 14);
  const checkOutH = parseTimeHour(state.settings.checkOutTime, 12);

  /** Absolute X from range start in px */
  const toX = useCallback(
    (dateStr: string, hour = 0) => {
      if (isHourly) return hour * unitPx;
      const startMs = new Date(dates[0] + 'T00:00:00').getTime();
      const dMs = new Date(dateStr + 'T00:00:00').getTime();
      const dayFrac = (dMs - startMs) / 86400000 + hour / 24;
      return dayFrac * unitPx;
    },
    [dates, isHourly, unitPx]
  );

  const barLayout = useCallback(
    (res: Reservation): { left: number; width: number } | null => {
      // Rezervasyona ozel saat varsa onu kullan, yoksa otel varsayilanina don
      const resCheckInH = parseTimeHour(res.checkInTime || '', checkInH);
      const resCheckOutH = parseTimeHour(res.checkOutTime || '', checkOutH);
      if (isHourly) {
        const day = dates[0];
        // Stay covers this calendar day if checkIn <= day < checkOut OR checkout morning
        const onDay = res.checkIn <= day && res.checkOut > day;
        const checkoutMorning = res.checkOut === day;
        if (!onDay && !checkoutMorning) return null;

        let startH = 0;
        let endH = 24;
        if (res.checkIn === day && res.checkOut === day) {
          startH = resCheckInH;
          endH = Math.max(resCheckInH + 1, resCheckOutH);
        } else if (res.checkIn === day) {
          startH = resCheckInH;
          endH = 24;
        } else if (res.checkOut === day) {
          startH = 0;
          endH = resCheckOutH;
        } else {
          startH = 0;
          endH = 24;
        }
        const left = startH * unitPx;
        const width = Math.max((endH - startH) * unitPx, 10);
        return { left, width };
      }

      // Multi-day continuous bar with check-in/out hour offsets
      let left = toX(res.checkIn, resCheckInH);
      let right = toX(res.checkOut, resCheckOutH);

      // Clamp to visible window
      const maxX = dates.length * unitPx;
      if (right <= 0 || left >= maxX) return null;
      left = Math.max(0, left);
      right = Math.min(maxX, right);
      return { left, width: Math.max(right - left, 12) };
    },
    [checkInH, checkOutH, dates, isHourly, toX, unitPx]
  );

  const nowLine = useMemo(() => {
    const t = todayISO();
    const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    if (isHourly) {
      if (dates[0] !== t) return null;
      return { x: h * unitPx, label: formatClockShort(now) };
    }
    if (t < dates[0] || t > dates[dates.length - 1]) return null;
    return { x: toX(t, h), label: formatClockShort(now) };
  }, [now, isHourly, dates, unitPx, toX]);

  // Scroll to "now" when view/anchor changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !nowLine) return;
    const id = window.setTimeout(() => {
      el.scrollTo({ left: Math.max(0, nowLine.x - el.clientWidth * 0.3 + labelW), behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(id);
  }, [view, anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  const occupancyByCol = useMemo(() => {
    const sellable =
      rooms.filter((r) => r.status !== 'out_of_order' && r.status !== 'maintenance').length || 1;

    const roomOccupiedOnDay = (room: Room, d: string) =>
      activeRes.some((r) => r.roomId === room.id && r.checkIn <= d && r.checkOut > d);

    if (isHourly) {
      const day = dates[0];
      return Array.from({ length: 24 }, (_, hour) => {
        const occ = rooms.filter((room) => {
          if (room.status === 'out_of_order') return false;
          return activeRes.some((r) => {
            if (r.roomId !== room.id) return false;
            if (r.checkIn < day && r.checkOut > day) return true;
            if (r.checkIn === day && r.checkOut > day && hour >= checkInH) return true;
            if (r.checkOut === day && hour < checkOutH) return true;
            if (r.checkIn === day && r.checkOut === day && hour >= checkInH && hour < checkOutH)
              return true;
            return false;
          });
        }).length;
        return Math.round((occ / sellable) * 100);
      });
    }

    return dates.map((d) => {
      const occ = rooms.filter(
        (room) => room.status !== 'out_of_order' && roomOccupiedOnDay(room, d)
      ).length;
      return Math.round((occ / sellable) * 100);
    });
  }, [rooms, activeRes, dates, isHourly, checkInH, checkOutH]);

  const today = todayISO();

  // Ust istatistikler (Anlik Doluluk, Bugun Giris/Cikis) HER ZAMAN gercek
  // "su an" durumunu yansitmali — Takvim gorunumunde hangi tarih araligina
  // bakildigina (Gun/Hafta/14 Gun) GORE DEGISMEMELI. activeRes ise sadece
  // Gantt cizimi icin o an ekrandaki tarih penceresine gore filtrelenmis
  // bir liste — bunu istatistiklerde kullanmak, gorunum degistirince
  // rakamlarin da degismesine (ve bazen misafirlerin "kaybolmasina")
  // sebep oluyordu.
  const allActiveReservations = useMemo(
    () => state.reservations.filter((r) => !r.deletedAt && !['cancelled', 'no_show'].includes(r.status)),
    [state.reservations]
  );

  const occupiedRoomList = useMemo(() => {
    const checkedInRoomIds = new Set(
      allActiveReservations.filter((r) => r.status === 'checked_in').map((r) => r.roomId)
    );
    return rooms.filter((room) => checkedInRoomIds.has(room.id));
  }, [rooms, allActiveReservations]);

  const availableRoomList = useMemo(() => {
    const occupiedIds = new Set(occupiedRoomList.map((r) => r.id));
    return rooms.filter(
      (room) =>
        room.status !== 'out_of_order' &&
        room.status !== 'maintenance' &&
        !occupiedIds.has(room.id)
    );
  }, [rooms, occupiedRoomList]);

  const arrivalList = useMemo(() => {
    const roomIds = new Set(rooms.map((r) => r.id));
    return allActiveReservations.filter(
      (r) => roomIds.has(r.roomId) && r.checkIn <= today && ['pending', 'confirmed'].includes(r.status)
    );
  }, [allActiveReservations, rooms, today]);

  const departureList = useMemo(() => {
    const roomIds = new Set(rooms.map((r) => r.id));
    return allActiveReservations.filter(
      (r) => roomIds.has(r.roomId) && r.status === 'checked_in' && r.checkOut <= today
    );
  }, [allActiveReservations, rooms, today]);

  const summary = useMemo(() => {
    const sellable = rooms.filter((r) => r.status !== 'out_of_order').length;
    return {
      occ: sellable ? Math.round((occupiedRoomList.length / sellable) * 100) : 0,
      occupiedToday: occupiedRoomList.length,
      arrivals: arrivalList.length,
      departures: departureList.length,
      available: availableRoomList.length,
      sellable,
    };
  }, [rooms, occupiedRoomList, arrivalList, departureList, availableRoomList]);

  const liveRoomQuick = roomQuick
    ? state.rooms.find((r) => r.id === roomQuick.id && !r.deletedAt) ?? null
    : null;

  const setRoomStatusQuick = (roomId: string, status: RoomStatus) => {
    const patch: Partial<Room> = { status };
    if (status === 'cleaning') patch.housekeeping = 'dirty';
    if (status === 'available') {
      patch.housekeeping = 'clean';
      patch.lastCleaned = todayISO();
    }
    if (status === 'occupied') {
      /* keep hk */
    }
    updateRoom(roomId, patch);
    pushToast('ok', `Oda durumu: ${ROOM_STATUS_LABELS[status]}`);
  };

  const setRoomHkQuick = (roomId: string, hk: HousekeepingStatus) => {
    const patch: Partial<Room> = { housekeeping: hk };
    if (hk === 'clean' || hk === 'inspected') {
      patch.lastCleaned = todayISO();
      const room = state.rooms.find((r) => r.id === roomId);
      if (room && room.status === 'cleaning') patch.status = 'available';
    }
    if (hk === 'dirty' || hk === 'in_progress') {
      const room = state.rooms.find((r) => r.id === roomId);
      if (room && room.status === 'available') patch.status = 'cleaning';
    }
    updateRoom(roomId, patch);
    pushToast('ok', `HK: ${HK_STATUS_LABELS[hk]}`);
  };

  const shiftRange = (dir: number) => {
    if (view === 'day') setAnchor(addDays(anchor, dir));
    else if (view === 'week') setAnchor(addDays(anchor, dir * 7));
    else if (view === '14') setAnchor(addDays(anchor, dir * 7));
    else {
      const d = new Date(anchor + 'T12:00:00');
      d.setMonth(d.getMonth() + dir);
      setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    }
  };

  // "Hayalet" rezervasyonlar — silinmis (arsivlenmis) ama veritabaninda
  // hala duran kayitlar. Sadece Yonetici/Mudur gorebilir, kurtarma/kesin
  // silme ve "kim/ne zaman sildi" bilgisi burada. Kalici silinmis
  // (purged) kayitlar burada ARTIK GÖSTERİLMEZ — zaten kalici silme
  // sonrasi bir daha geri getirilemez, listede durmasi kafa karistirirdi.
  const ghostReservations = useMemo(() => {
    if (!isManager) return [];
    return state.reservations
      .filter((r) => r.deletedAt && !r.purged)
      .map((r) => {
        const delLog = state.activity.find(
          (a) => a.relatedId === r.id && a.message.toLowerCase().includes('silindi')
        );
        return { res: r, deletedBy: delLog?.user, deletedAt: delLog?.timestamp || r.deletedAt };
      })
      .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  }, [state.reservations, state.activity, isManager]);

  // Takvimden surukle-birak ile oda degistirme — tarih/saat aynen kalir,
  // sadece oda degisir. Eski oda kirliye alinsin mi diye sorulur.
  const handleRoomDrop = (targetRoom: Room) => {
    setDragOverRoomId(null);
    const resId = draggedResId;
    setDraggedResId(null);
    if (!resId) return;
    const res = state.reservations.find((r) => r.id === resId && !r.deletedAt);
    if (!res) return;
    if (res.roomId === targetRoom.id) return; // ayni odaya birakildi, islem yok
    if (targetRoom.status === 'out_of_order' || targetRoom.status === 'maintenance') {
      pushToast('err', `${targetRoom.number} kullanım dışı / bakımda — taşınamaz.`);
      return;
    }
    if (!isRoomAvailable(targetRoom.id, res.checkIn, res.checkOut, res.id, res.checkInTime, res.checkOutTime)) {
      pushToast('err', `${targetRoom.number} bu tarih/saat aralığında müsait değil.`);
      return;
    }
    const guest = state.guests.find((g) => g.id === res.guestId);
    const oldRoom = state.rooms.find((r) => r.id === res.roomId);
    const guestLabel = guest ? `${guest.firstName} ${guest.lastName}` : res.code;
    if (!confirm(`${guestLabel} — Oda ${oldRoom?.number} yerine Oda ${targetRoom.number}'e taşınsın mı? (Tarih/saat aynı kalır)`)) {
      return;
    }
    // ONEMLI: oda taşınırken fiyat ART IK OTOMATIK DEGISTIRILMIYOR —
    // misafirle anlaşılan fiyat sessizce yeni odanın standart fiyatına
    // dönüşemez. Personel gerekirse rezervasyon detayından elle günceller.
    const err = updateReservation(res.id, { roomId: targetRoom.id });
    if (err && 'error' in err) {
      pushToast('err', err.error);
      return;
    }
    if (oldRoom && confirm(`Eski oda (${oldRoom.number}) temizlik için "Kirli" olarak işaretlensin mi?`)) {
      updateRoom(oldRoom.id, { housekeeping: 'dirty', status: 'cleaning' });
    }
    pushToast('ok', `${guestLabel} artık Oda ${targetRoom.number}'de`);
  };

  const openCreateAt = (room: Room, dateStr: string) => {
    if (room.status === 'out_of_order' || room.status === 'maintenance') {
      pushToast('err', 'Bu oda rezervasyona kapalı');
      return;
    }
    const checkInDate = dateStr;
    const checkOutDate = addDays(checkInDate, 1);
    const free = getAvailableRooms(checkInDate, checkOutDate).some((r) => r.id === room.id);
    if (!free) {
      pushToast('err', 'Bu oda seçilen tarihte müsait değil');
      return;
    }
    setCreatePrefill({ roomId: room.id, checkIn: checkInDate, checkOut: checkOutDate, checkInTime: '', checkOutTime: '11:00' });
    // ONEMLI: fiyat artık otomatik doldurulmuyor — personel gecelik
    // fiyatı kendisi girmeli (yanlış/eski fiyatı fark etmeden onaylama
    // hatasını onlemek icin). Onceki denemeden kalan eski fiyat da
    // yanlışlıkla kullanılmasın diye sıfırlanır.
    setCreateForm((f) => ({ ...f, nightlyRate: 0 }));
    setMatchedGuestId('');
    setBlacklistAck(false);
    setCreateError('');
    setCreateOpen(true);
  };

  const submitCreate = () => {
    setCreateError('');
    if (!createForm.firstName.trim() || !createForm.lastName.trim()) {
      setCreateError('Misafir adı soyadı gerekli');
      return;
    }
    const matched = matchedGuestId ? state.guests.find((g) => g.id === matchedGuestId) : undefined;
    if (matched?.blacklisted && !blacklistAck) {
      setCreateError('Bu misafir KARA LİSTEDE. Devam etmek için uyarıyı onaylayın.');
      return;
    }
    let guestId = matchedGuestId;
    if (!guestId) {
      guestId = addGuest({
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: '',
        phone: createForm.phone,
        idNumber: createForm.idNumber,
        nationality: 'TR',
        address: '',
        notes: '',
        vip: false,
      });
    }
    if (!guestId || !createPrefill.roomId) {
      setCreateError('Misafir ve oda zorunlu');
      return;
    }
    const result = addReservation({
      guestId,
      roomId: createPrefill.roomId,
      checkIn: createPrefill.checkIn,
      checkOut: createPrefill.checkOut,
      checkInTime: createPrefill.checkInTime || undefined,
      checkOutTime: createPrefill.checkOutTime || '11:00',
      adults: createForm.adults,
      children: createForm.children,
      status: createForm.status,
      nightlyRate: createForm.nightlyRate,
      discount: 0,
      taxRate: state.settings.taxRate,
      deposit: 0,
      notes: createForm.notes,
      source: createForm.source,
      specialRequests: '',
    });
    if (typeof result === 'object' && 'error' in result) {
      setCreateError(result.error);
      return;
    }
    setCreateOpen(false);
  };

  const liveSelected = selected
    ? state.reservations.find((r) => r.id === selected.id) ?? null
    : null;

  const availableForCreate = getAvailableRooms(createPrefill.checkIn, createPrefill.checkOut, undefined, createPrefill.checkInTime, createPrefill.checkOutTime);
  const bodyHeight = Math.max(rooms.length * rowH, 80);

  const scrollToNow = () => {
    const el = scrollRef.current;
    if (!el || !nowLine) {
      pushToast('info', 'Şu an çizgisi bu görünümde değil — Bugün’e geçin');
      setAnchor(view === 'month' ? todayISO().slice(0, 8) + '01' : todayISO());
      return;
    }
    el.scrollTo({
      left: Math.max(0, nowLine.x - el.clientWidth * 0.3 + labelW),
      behavior: 'smooth',
    });
  };

  return (
    <div>
      <PageHeader
        title="Takvim & Doluluk"
        subtitle={`Canlı Gantt panosu · CI ${state.settings.checkInTime} · CO ${state.settings.checkOutTime} · ${formatClock(now)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isManager && ghostReservations.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setGhostOpen(true)} className="border-rose-300 text-rose-700 hover:bg-rose-50">
                👻 Hayalet Rezervasyonlar ({ghostReservations.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => shiftRange(-1)}>
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setAnchor(view === 'month' ? todayISO().slice(0, 8) + '01' : todayISO())
              }
            >
              Bugün
            </Button>
            <Button variant="outline" size="sm" onClick={() => shiftRange(1)}>
              <ChevronRight size={16} />
            </Button>
            <input
              type="date"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value || todayISO())}
              className="h-8 rounded-lg border border-slate-200 px-2 text-sm"
            />
            <Button
              size="sm"
              onClick={() => {
                const room = rooms.find((r) => r.status === 'available');
                setCreatePrefill({
                  roomId: room?.id ?? '',
                  checkIn: todayISO(),
                  checkOut: addDays(todayISO(), 1),
                  checkInTime: '',
                  checkOutTime: '11:00',
                });
                // Fiyat artık otomatik doldurulmuyor — personel girsin.
                setCreateForm((f) => ({ ...f, nightlyRate: 0 }));
                setMatchedGuestId('');
                setBlacklistAck(false);
                setCreateError('');
                setCreateOpen(true);
              }}
            >
              <Plus size={14} /> Rezervasyon
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi
          label="Anlık doluluk"
          value={`${summary.occ}%`}
          sub={`${summary.occupiedToday}/${summary.sellable} oda · tıkla`}
          accent="teal"
          active={kpiPanel === 'occupancy'}
          onClick={() => setKpiPanel((p) => (p === 'occupancy' ? null : 'occupancy'))}
        />
        <Kpi
          label="Müsait"
          value={String(summary.available)}
          sub="şu an · tıkla listele"
          accent="emerald"
          active={kpiPanel === 'available'}
          onClick={() => setKpiPanel((p) => (p === 'available' ? null : 'available'))}
        />
        <Kpi
          label="Bugün geliş"
          value={String(summary.arrivals)}
          sub="check-in bekleyen · tıkla"
          accent="blue"
          active={kpiPanel === 'arrivals'}
          onClick={() => setKpiPanel((p) => (p === 'arrivals' ? null : 'arrivals'))}
        />
        <Kpi
          label="Bugün ayrılış"
          value={String(summary.departures)}
          sub="check-out · tıkla"
          accent="rose"
          active={kpiPanel === 'departures'}
          onClick={() => setKpiPanel((p) => (p === 'departures' ? null : 'departures'))}
        />
        <Kpi
          label="Canlı saat"
          value={formatClockShort(now)}
          sub={formatDate(todayISO(), { weekday: 'long', day: 'numeric', month: 'long' })}
          accent="violet"
          onClick={scrollToNow}
        />
      </div>

      {/* KPI action panels */}
      {kpiPanel && (
        <Card className="mb-3 overflow-hidden border-teal-100">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {kpiPanel === 'occupancy' && 'Dolu odalar (in-house)'}
                {kpiPanel === 'available' && 'Müsait odalar'}
                {kpiPanel === 'arrivals' && 'Gelişler / check-in bekleyen'}
                {kpiPanel === 'departures' && 'Ayrılışlar / check-out'}
              </p>
              <p className="text-[11px] text-slate-500">Satıra tıklayın veya hızlı işlem kullanın</p>
            </div>
            <div className="flex gap-2">
              {(kpiPanel === 'arrivals' || kpiPanel === 'departures') && (
                <Button size="sm" variant="outline" onClick={() => navigate('/front-desk')}>
                  Resepsiyon
                </Button>
              )}
              {kpiPanel === 'available' && (
                <Button size="sm" variant="outline" onClick={() => navigate('/rooms')}>
                  Odalar
                </Button>
              )}
              {kpiPanel === 'occupancy' && (
                <Button size="sm" variant="outline" onClick={() => navigate('/housekeeping')}>
                  Kat Hizmetleri
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setKpiPanel(null)}>
                Kapat
              </Button>
            </div>
          </div>
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {kpiPanel === 'occupancy' &&
              (occupiedRoomList.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">Dolu oda yok</p>
              ) : (
                occupiedRoomList.map((room) => {
                  const res = activeRes.find(
                    (r) => r.roomId === room.id && r.status === 'checked_in'
                  );
                  const g = res ? state.guests.find((x) => x.id === res.guestId) : undefined;
                  return (
                    <div
                      key={room.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-teal-50/40"
                    >
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        onClick={() => {
                          setRoomQuick(room);
                          setKpiPanel(null);
                        }}
                      >
                        <p className="text-sm font-semibold">
                          Oda {room.number}{' '}
                          <span className="font-normal text-slate-500">
                            · {ROOM_TYPE_LABELS[room.type]}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {g ? `${g.firstName} ${g.lastName}` : '—'} · çıkış {res?.checkOut ?? '—'} ·{' '}
                          {HK_STATUS_LABELS[room.housekeeping]}
                        </p>
                      </button>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setRoomQuick(room)}>
                          Oda ayarı
                        </Button>
                        {res && (
                          <Button size="sm" variant="ghost" onClick={() => setSelected(res)}>
                            Rezervasyon
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              ))}

            {kpiPanel === 'available' &&
              (availableRoomList.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">Müsait oda yok</p>
              ) : (
                availableRoomList.map((room) => (
                  <div
                    key={room.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-emerald-50/50"
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => setRoomQuick(room)}
                    >
                      <p className="text-sm font-semibold">
                        Oda {room.number}{' '}
                        <span className="font-normal text-slate-500">
                          · {ROOM_TYPE_LABELS[room.type]} · {formatCurrency(room.pricePerNight)}/gece
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {ROOM_STATUS_LABELS[room.status]} · {HK_STATUS_LABELS[room.housekeeping]}
                      </p>
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setRoomQuick(room)}>
                        Oda ayarı
                      </Button>
                      <Button size="sm" onClick={() => openCreateAt(room, today)}>
                        <Plus size={14} /> Rezervasyon
                      </Button>
                    </div>
                  </div>
                ))
              ))}

            {kpiPanel === 'arrivals' &&
              (arrivalList.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">Bekleyen geliş yok</p>
              ) : (
                arrivalList.map((r) => {
                  const g = state.guests.find((x) => x.id === r.guestId);
                  const room = state.rooms.find((x) => x.id === r.roomId);
                  const overdue = r.checkIn < today;
                  return (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-blue-50/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {g?.firstName} {g?.lastName}{' '}
                          {overdue && <Badge color="rose">Gecikmiş</Badge>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {r.code} · Oda {room?.number} · {r.checkIn}{r.checkInTime ? ` ${r.checkInTime}` : ''} → {r.checkOut}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                          Detay
                        </Button>
                        {room && (
                          <Button size="sm" variant="outline" onClick={() => setRoomQuick(room)}>
                            Oda
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            const err = checkIn(r.id);
                            if (err) pushToast('err', String(err));
                          }}
                        >
                          <LogIn size={14} /> Check-in
                        </Button>
                      </div>
                    </div>
                  );
                })
              ))}

            {kpiPanel === 'departures' &&
              (departureList.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">Bugün ayrılış yok</p>
              ) : (
                departureList.map((r) => {
                  const g = state.guests.find((x) => x.id === r.guestId);
                  const room = state.rooms.find((x) => x.id === r.roomId);
                  const bal = balanceDue(r, state.payments);
                  return (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-rose-50/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {g?.firstName} {g?.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          Oda {room?.number} · çıkış {r.checkOut} {r.checkOutTime || '11:00'} · bakiye {formatCurrency(bal)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {bal > 0 && (
                          <>
                            <select
                              value={quickPayMethod[r.id] || 'cash'}
                              onChange={(e) =>
                                setQuickPayMethod((m) => ({ ...m, [r.id]: e.target.value as PaymentMethod }))
                              }
                              className="h-8 rounded-lg border border-slate-200 px-1.5 text-xs"
                            >
                              {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                addPayment({
                                  reservationId: r.id,
                                  amount: bal,
                                  method: quickPayMethod[r.id] || 'cash',
                                  date: todayISO(),
                                  note: 'Takvim KPI tahsilat',
                                  receivedBy: currentUser?.name ?? 'Sistem',
                                });
                              }}
                            >
                              Tahsil et
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant={bal > 0 ? 'secondary' : 'success'}
                          onClick={() => {
                            const err = checkOut(r.id);
                            if (err) pushToast('err', String(err));
                          }}
                        >
                          <LogOut size={14} /> Check-out
                        </Button>
                      </div>
                    </div>
                  );
                })
              ))}
          </div>
        </Card>
      )}

      <Card className="mb-3 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['day', 'Gün (saatlik)'],
                ['week', 'Hafta'],
                ['14', '14 Gün'],
                ['month', 'Ay'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setView(k);
                  if (k === 'month') setAnchor(todayISO().slice(0, 8) + '01');
                }}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                  view === k
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {label}
              </button>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
            <button
              type="button"
              onClick={() => setCompact((c) => !c)}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              {compact ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              {compact ? 'Geniş' : 'Kompakt'}
            </button>
            <button
              type="button"
              onClick={scrollToNow}
              className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <Clock size={13} /> Şimdiye git
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Misafir, kod, oda..."
                className="h-9 w-44 rounded-xl border border-slate-200 bg-white pl-8 pr-2 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <Select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="h-9 w-28 text-xs"
            >
              <option value="all">Tüm katlar</option>
              {floors.map((f) => (
                <option key={f} value={f}>
                  Kat {f}
                </option>
              ))}
            </Select>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 w-32 text-xs"
            >
              <option value="all">Tüm tipler</option>
              {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-32 text-xs"
            >
              <option value="all">Tüm durumlar</option>
              {Object.entries(ROOM_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div
          ref={scrollRef}
          className={cn('relative overflow-auto', compact ? 'max-h-[min(88vh,1400px)]' : 'max-h-[min(74vh,860px)]')}
        >
          <div className="relative" style={{ width: labelW + gridWidth, minWidth: '100%' }}>
            {/* Sticky header */}
            <div
              className="sticky top-0 z-30 flex border-b border-slate-200 bg-white/95 backdrop-blur"
              style={{ height: headerH }}
            >
              <div
                className="sticky left-0 z-40 flex shrink-0 items-end border-r border-slate-200 bg-white px-3 pb-2"
                style={{ width: labelW }}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <BedDouble size={13} />
                  Oda
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                    {rooms.length}
                  </span>
                </div>
              </div>
              <div className="relative" style={{ width: gridWidth, height: headerH }}>
                {isHourly
                  ? Array.from({ length: 24 }, (_, h) => (
                      <div
                        key={h}
                        className={cn(
                          'absolute top-0 flex h-full flex-col items-center justify-end border-l border-slate-100 pb-1.5',
                          h === checkInH && 'bg-teal-50/70',
                          h === checkOutH && 'bg-amber-50/70'
                        )}
                        style={{ left: h * unitPx, width: unitPx }}
                      >
                        <span className="text-[10px] font-semibold text-slate-600">
                          {String(h).padStart(2, '0')}
                        </span>
                        <span className="text-[9px] text-slate-400">{occupancyByCol[h]}%</span>
                      </div>
                    ))
                  : dates.map((d, i) => {
                      const isToday = d === todayISO();
                      const isWeekend = [0, 6].includes(new Date(d + 'T12:00:00').getDay());
                      return (
                        <div
                          key={d}
                          className={cn(
                            'absolute top-0 flex h-full flex-col items-center justify-end border-l border-slate-100 pb-1',
                            isToday && 'bg-teal-50/90',
                            isWeekend && !isToday && 'bg-slate-50/90'
                          )}
                          style={{ left: i * unitPx, width: unitPx }}
                        >
                          <span
                            className={cn(
                              'text-[10px] font-medium uppercase',
                              isToday ? 'text-teal-700' : 'text-slate-400'
                            )}
                          >
                            {formatDate(d, { weekday: 'short' })}
                          </span>
                          <span
                            className={cn(
                              'text-sm font-bold leading-none',
                              isToday ? 'text-teal-800' : 'text-slate-700'
                            )}
                          >
                            {formatDate(d, { day: 'numeric' })}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {formatDate(d, { month: 'short' })}
                          </span>
                          <div className="mt-1 h-1 w-[68%] overflow-hidden rounded-full bg-slate-200/80">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                occupancyByCol[i] >= 90
                                  ? 'bg-rose-500'
                                  : occupancyByCol[i] >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-teal-500'
                              )}
                              style={{ width: `${occupancyByCol[i]}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                {isHourly && (
                  <>
                    <HeaderGuide x={checkInH * unitPx} color="#0f766e" label={`CI ${state.settings.checkInTime}`} />
                    <HeaderGuide x={checkOutH * unitPx} color="#d97706" label={`CO ${state.settings.checkOutTime}`} />
                  </>
                )}

                {/* Now marker on header */}
                {nowLine && (
                  <div
                    className="pointer-events-none absolute top-0 z-20 h-full"
                    style={{ left: nowLine.x }}
                  >
                    <div className="absolute left-1/2 top-1 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                      ● {nowLine.label}
                    </div>
                    <div className="absolute left-0 top-0 h-full w-[2px] -translate-x-1/2 bg-rose-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="relative" style={{ height: bodyHeight }}>
              {rooms.length === 0 && (
                <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                  Filtreye uyan oda yok
                </div>
              )}

              {rooms.map((room, rowIdx) => {
                const roomRes = activeRes.filter((r) => r.roomId === room.id);
                const blocked =
                  room.status === 'out_of_order' || room.status === 'maintenance';

                return (
                  <div
                    key={room.id}
                    onDragOver={(e) => {
                      if (!draggedResId || blocked) return;
                      e.preventDefault();
                      setDragOverRoomId(room.id);
                    }}
                    onDragLeave={() => setDragOverRoomId((id) => (id === room.id ? null : id))}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleRoomDrop(room);
                    }}
                    className={cn(
                      'absolute left-0 flex border-b border-slate-100',
                      rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50',
                      dragOverRoomId === room.id && 'bg-teal-100/70 ring-2 ring-inset ring-teal-400'
                    )}
                    style={{ top: rowIdx * rowH, height: rowH, width: labelW + gridWidth }}
                  >
                    <button
                      type="button"
                      onClick={() => setRoomQuick(room)}
                      className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r border-slate-200 bg-inherit px-2 text-left transition hover:bg-teal-50/90"
                      style={{ width: labelW }}
                      title={`${room.number} — durum / temizlik ayarla`}
                    >
                      <div
                        className={cn(
                          'shrink-0 rounded-full',
                          compact ? 'h-5 w-[3px]' : 'h-8 w-1',
                          room.status === 'available'
                            ? 'bg-emerald-400'
                            : room.status === 'occupied'
                              ? 'bg-blue-500'
                              : room.status === 'cleaning'
                                ? 'bg-amber-400'
                                : room.status === 'maintenance'
                                  ? 'bg-orange-500'
                                  : 'bg-slate-400'
                        )}
                      />
                      <div className="min-w-0">
                        <p className={cn('truncate font-bold text-slate-900', compact ? 'text-xs' : 'text-sm')}>
                          {room.number}
                        </p>
                        {!compact && (
                          <p className="truncate text-[10px] text-slate-400">
                            {HK_STATUS_LABELS[room.housekeeping]} · K{room.floor}
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="relative" style={{ width: gridWidth, height: rowH }}>
                      {isHourly
                        ? Array.from({ length: 24 }, (_, h) => (
                            <button
                              key={h}
                              type="button"
                              disabled={blocked}
                              onClick={() => openCreateAt(room, dates[0])}
                              className={cn(
                                'absolute top-0 h-full border-l border-slate-100/80 transition',
                                blocked
                                  ? 'cursor-not-allowed bg-slate-200/40'
                                  : 'hover:bg-teal-50/80',
                                h % 2 === 1 && !blocked && 'bg-slate-50/40'
                              )}
                              style={{ left: h * unitPx, width: unitPx }}
                              title={
                                blocked
                                  ? ROOM_STATUS_LABELS[room.status]
                                  : `${room.number} · ${String(h).padStart(2, '0')}:00`
                              }
                            />
                          ))
                        : dates.map((d, i) => {
                            const isToday = d === todayISO();
                            return (
                              <button
                                key={d}
                                type="button"
                                disabled={blocked}
                                onClick={() => openCreateAt(room, d)}
                                className={cn(
                                  'absolute top-0 h-full border-l border-slate-100/80 transition',
                                  blocked
                                    ? 'cursor-not-allowed bg-[repeating-linear-gradient(135deg,#e2e8f0,#e2e8f0_4px,#f8fafc_4px,#f8fafc_8px)]'
                                    : 'hover:bg-teal-50/80',
                                  isToday && !blocked && 'bg-teal-50/25'
                                )}
                                style={{ left: i * unitPx, width: unitPx }}
                                title={
                                  blocked
                                    ? `${room.number} · ${ROOM_STATUS_LABELS[room.status]}`
                                    : `${room.number} · ${formatDate(d)} — tıkla rezervasyon`
                                }
                              />
                            );
                          })}

                      {roomRes.map((res) => {
                        const layout = barLayout(res);
                        if (!layout) return null;
                        const g = state.guests.find((x) => x.id === res.guestId);
                        const name = g ? `${g.firstName} ${g.lastName}` : res.code;
                        const short =
                          layout.width < 72
                            ? `${g?.firstName?.[0] ?? ''}.${g?.lastName ?? res.code.slice(-4)}`
                            : name;
                        return (
                          <button
                            key={res.id}
                            type="button"
                            draggable={!['cancelled', 'checked_out'].includes(res.status)}
                            onDragStart={(e) => {
                              setDraggedResId(res.id);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', res.id);
                            }}
                            onDragEnd={() => {
                              setDraggedResId(null);
                              setDragOverRoomId(null);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(res);
                              setHoverTip(null);
                            }}
                            onMouseEnter={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setHoverTip({
                                x: rect.left + Math.min(rect.width, 160) / 2,
                                y: rect.top,
                                res,
                              });
                            }}
                            onMouseLeave={() => setHoverTip(null)}
                            className={cn(
                              'absolute z-10 flex items-center gap-1 overflow-hidden rounded-lg bg-gradient-to-r px-2 text-left shadow-md ring-1 ring-black/10 transition hover:z-20 hover:brightness-105 hover:shadow-lg',
                              !['cancelled', 'checked_out'].includes(res.status) && 'cursor-grab active:cursor-grabbing',
                              STATUS_BAR[res.status] || STATUS_BAR.confirmed,
                              g?.vip && 'ring-2 ring-amber-300',
                              draggedResId === res.id && 'opacity-40'
                            )}
                            title="Taşımak için sürükle, farklı odaya bırak"
                            style={{
                              left: layout.left,
                              width: layout.width,
                              top: compact ? 7 : 11,
                              height: compact ? rowH - 14 : rowH - 22,
                            }}
                          >
                            {g?.vip && <span className="text-[10px]">★</span>}
                            <span className="truncate text-[11px] font-semibold leading-tight">
                              {short}
                            </span>
                            {layout.width > 100 && (
                              <span className="truncate text-[9px] opacity-85">
                                {nightsOf(res)}g
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Full-height NOW line across all rows */}
              {nowLine && rooms.length > 0 && (
                <div
                  className="pointer-events-none absolute z-[15]"
                  style={{
                    left: labelW + nowLine.x,
                    top: 0,
                    height: bodyHeight,
                    width: 0,
                  }}
                >
                  <div className="absolute left-0 top-0 h-full w-[2px] -translate-x-1/2 bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.65)]" />
                  <div className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-rose-500 ring-2 ring-white" />
                  {/* pulse */}
                  <div className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 animate-ping rounded-full bg-rose-400 opacity-40" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3">
          <Legend swatch="bg-gradient-to-r from-amber-400 to-amber-500" label="Beklemede" />
          <Legend swatch="bg-gradient-to-r from-teal-400 to-teal-600" label="Onaylı" />
          <Legend swatch="bg-gradient-to-r from-blue-500 to-indigo-600" label="Check-in" />
          <Legend swatch="bg-slate-300" label="Kapalı / Bakım" />
          <Legend swatch="bg-rose-500" label="Şimdi (canlı)" />
          <span className="text-[11px] text-slate-400">
            Oda no → temizlik/durum · Boş hücre → rezervasyon · Çubuk → detay · KPI kartları → liste
          </span>
        </div>
      </Card>

      {hoverTip && !selected && (
        <div
          className="pointer-events-none fixed z-[90] w-64 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
          style={{ left: hoverTip.x, top: hoverTip.y - 10 }}
        >
          <HoverCard res={hoverTip.res} state={state} />
        </div>
      )}

      <Modal
        open={!!liveSelected}
        onClose={() => setSelected(null)}
        title={liveSelected?.code ?? 'Rezervasyon'}
        wide
      >
        {liveSelected && (
          <ResDetail
            res={liveSelected}
            state={state}
            onClose={() => setSelected(null)}
            onCheckIn={() => {
              const err = checkIn(liveSelected.id);
              if (err) pushToast('err', String(err));
              else setSelected(null);
            }}
            onCancel={() => {
              if (confirm('Rezervasyon iptal edilsin mi?')) {
                cancelReservation(liveSelected.id);
                setSelected(null);
              }
            }}
            onPay={(method) => {
              const bal = balanceDue(liveSelected, state.payments);
              if (bal <= 0) {
                pushToast('info', 'Bakiye yok');
                return;
              }
              addPayment({
                reservationId: liveSelected.id,
                amount: bal,
                method,
                date: todayISO(),
                note: 'Takvimden tahsilat',
                receivedBy: currentUser?.name ?? 'Sistem',
              });
            }}
            onOpenFull={() => {
              setSelected(null);
              navigate('/reservations');
            }}
            onFrontDesk={() => {
              setSelected(null);
              navigate('/front-desk');
            }}
          />
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Hızlı Rezervasyon" wide>
        <div className="space-y-3">
          {createError && (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Giriş"
              type="date"
              value={createPrefill.checkIn}
              onChange={(e) =>
                setCreatePrefill((p) => ({ ...p, checkIn: e.target.value, roomId: '' }))
              }
            />
            <Input
              label="Çıkış"
              type="date"
              value={createPrefill.checkOut}
              onChange={(e) =>
                setCreatePrefill((p) => ({ ...p, checkOut: e.target.value, roomId: '' }))
              }
            />
            <Select
              label={`Oda (${availableForCreate.length} müsait)`}
              value={createPrefill.roomId}
              onChange={(e) => {
                const id = e.target.value;
                // ONEMLI: fiyat artık otomatik doldurulmuyor — personel
                // gecelik fiyatı kendisi girsin diye bilinçli olarak
                // bırakıldı. Başka bir odanın eski fiyatı kalmasın diye
                // sıfırlanır.
                setCreatePrefill((p) => ({ ...p, roomId: id }));
                setCreateForm((f) => ({ ...f, nightlyRate: 0 }));
              }}
            >
              <option value="">Seçin...</option>
              {availableForCreate.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} — {ROOM_TYPE_LABELS[r.type]} — {formatCurrency(r.pricePerNight)}
                </option>
              ))}
            </Select>
            <div>
              <Input
                label="Gecelik fiyat"
                type="number"
                value={createForm.nightlyRate}
                onChange={(e) => setCreateForm((f) => ({ ...f, nightlyRate: +e.target.value }))}
              />
              {createPrefill.roomId && (
                <p className="mt-1 text-xs text-slate-400">
                  Odanın standart fiyatı: {formatCurrency(state.rooms.find((r) => r.id === createPrefill.roomId)?.pricePerNight ?? 0)}
                </p>
              )}
            </div>
            <Input
              label="Giriş Saati (opsiyonel)"
              type="time"
              value={createPrefill.checkInTime}
              onChange={(e) => setCreatePrefill((p) => ({ ...p, checkInTime: e.target.value }))}
            />
            <Input
              label="Çıkış Saati"
              type="time"
              value={createPrefill.checkOutTime}
              onChange={(e) => setCreatePrefill((p) => ({ ...p, checkOutTime: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Ad"
              value={createForm.firstName}
              onChange={(e) => {
                setMatchedGuestId('');
                setBlacklistAck(false);
                setCreateForm((f) => ({ ...f, firstName: e.target.value }));
              }}
            />
            <Input
              label="Soyad"
              value={createForm.lastName}
              onChange={(e) => {
                setMatchedGuestId('');
                setBlacklistAck(false);
                setCreateForm((f) => ({ ...f, lastName: e.target.value }));
              }}
            />
            <Input
              label="Telefon"
              value={createForm.phone}
              onChange={(e) => {
                setMatchedGuestId('');
                setBlacklistAck(false);
                setCreateForm((f) => ({ ...f, phone: e.target.value }));
              }}
            />
            <Input
              label="TC / Pasaport No"
              value={createForm.idNumber}
              onChange={(e) => {
                setMatchedGuestId('');
                setBlacklistAck(false);
                setCreateForm((f) => ({ ...f, idNumber: e.target.value }));
              }}
            />
          </div>

          {!matchedGuestId && guestSuggestions.length > 0 && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-2">
              <p className="mb-1.5 px-1 text-xs font-semibold text-teal-800">
                Daha önce konaklamış olabilir — birini seçersen bilgileri otomatik dolar:
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {guestSuggestions.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setMatchedGuestId(g.id);
                      setBlacklistAck(false);
                      setCreateForm((f) => ({
                        ...f,
                        firstName: g.firstName,
                        lastName: g.lastName,
                        idNumber: g.idNumber,
                        phone: g.phone,
                      }));
                    }}
                    className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm hover:bg-teal-100"
                  >
                    <span className="flex items-center gap-1.5">
                      {g.firstName} {g.lastName}
                      {g.vip && <span className="text-amber-500">★</span>}
                      {g.blacklisted && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          KARA LİSTE
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-400">{g.idNumber || g.phone}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedGuestId && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <span>✓ Kayıtlı misafir seçildi — bilgiler otomatik dolduruldu.</span>
              <button
                type="button"
                className="text-xs font-semibold text-emerald-700 underline"
                onClick={() => {
                  setMatchedGuestId('');
                  setBlacklistAck(false);
                }}
              >
                Vazgeç, yeni gibi devam et
              </button>
            </div>
          )}

          {matchedGuest?.blacklisted && (
            <div className="rounded-xl border-2 border-rose-400 bg-rose-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-bold text-rose-700">
                ⚠️ DİKKAT: Bu misafir KARA LİSTEDE
              </p>
              {matchedGuest.blacklistReason && (
                <p className="mt-1 text-sm text-rose-700">{matchedGuest.blacklistReason}</p>
              )}
              <label className="mt-2 flex items-center gap-2 text-sm font-medium text-rose-800">
                <input
                  type="checkbox"
                  checked={blacklistAck}
                  onChange={(e) => setBlacklistAck(e.target.checked)}
                />
                Kara listede olduğunu biliyorum, yine de rezervasyon oluşturmak istiyorum
              </label>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Yetişkin"
              type="number"
              min={1}
              value={createForm.adults}
              onChange={(e) => setCreateForm((f) => ({ ...f, adults: +e.target.value }))}
            />
            <Input
              label="Çocuk"
              type="number"
              min={0}
              value={createForm.children}
              onChange={(e) => setCreateForm((f) => ({ ...f, children: +e.target.value }))}
            />
            <Select
              label="Kaynak"
              value={createForm.source}
              onChange={(e) => setCreateForm((f) => ({ ...f, source: e.target.value }))}
            >
              {['Doğrudan', 'Telefon', 'Booking.com', 'Expedia', 'Walk-in', 'Diğer'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              İptal
            </Button>
            <Button onClick={submitCreate}>Oluştur</Button>
          </div>
        </div>
      </Modal>

      {/* Quick room status / HK panel */}
      <Modal
        open={!!liveRoomQuick}
        onClose={() => setRoomQuick(null)}
        title={liveRoomQuick ? `Oda ${liveRoomQuick.number}` : 'Oda'}
      >
        {liveRoomQuick && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge color={statusColor(liveRoomQuick.status)}>
                {ROOM_STATUS_LABELS[liveRoomQuick.status]}
              </Badge>
              <Badge color={statusColor(liveRoomQuick.housekeeping)}>
                {HK_STATUS_LABELS[liveRoomQuick.housekeeping]}
              </Badge>
              <Badge color="slate">{ROOM_TYPE_LABELS[liveRoomQuick.type]}</Badge>
            </div>

            <p className="text-sm text-slate-600">
              Kat {liveRoomQuick.floor} · {liveRoomQuick.beds} ·{' '}
              {formatCurrency(liveRoomQuick.pricePerNight)}/gece
              {liveRoomQuick.lastCleaned && (
                <span className="text-slate-400"> · Son temizlik {liveRoomQuick.lastCleaned}</span>
              )}
            </p>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hızlı temizlik (HK)
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(
                  [
                    ['clean', 'Temiz', 'success'],
                    ['dirty', 'Kirli', 'danger'],
                    ['in_progress', 'Temizleniyor', 'outline'],
                    ['inspected', 'Kontrol edildi', 'secondary'],
                    ['do_not_disturb', 'Rahatsız etme', 'outline'],
                  ] as const
                ).map(([key, label, variant]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={
                      liveRoomQuick.housekeeping === key
                        ? key === 'clean'
                          ? 'success'
                          : key === 'dirty'
                            ? 'danger'
                            : 'primary'
                        : variant
                    }
                    onClick={() => setRoomHkQuick(liveRoomQuick.id, key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Oda durumu
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(
                  [
                    ['available', 'Müsait'],
                    ['occupied', 'Dolu'],
                    ['cleaning', 'Temizlikte'],
                    ['maintenance', 'Bakımda'],
                    ['out_of_order', 'Kapalı'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={liveRoomQuick.status === key ? 'primary' : 'outline'}
                    onClick={() => setRoomStatusQuick(liveRoomQuick.id, key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {liveRoomQuick.status === 'available' &&
                liveRoomQuick.housekeeping !== 'dirty' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      openCreateAt(liveRoomQuick, today);
                      setRoomQuick(null);
                    }}
                  >
                    <Plus size={14} /> Rezervasyon aç
                  </Button>
                )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRoomQuick(null);
                  navigate('/housekeeping');
                }}
              >
                Kat Hizmetleri
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRoomQuick(null)}>
                Kapat
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Hayalet Rezervasyonlar — silinmis kayitlari inceleme/kurtarma */}
      <Modal
        open={ghostOpen}
        onClose={() => setGhostOpen(false)}
        title={`👻 Hayalet Rezervasyonlar (${ghostReservations.length})`}
        wide
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Silinmiş ama sistemde hâlâ duran rezervasyonlar. Sadece Yönetici ve Müdür görebilir.
            Kalıcı silme geri alınamaz.
          </p>
          {ghostReservations.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">Silinmiş rezervasyon yok</p>
          )}
          {ghostReservations.map(({ res: r, deletedBy, deletedAt }) => {
            const g = state.guests.find((x) => x.id === r.guestId);
            const room = state.rooms.find((x) => x.id === r.roomId);
            const total = grandTotal(r);
            const paid = paidTotal(state.payments, r.id);
            return (
              <div key={r.id} className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-slate-500">{r.code}</p>
                    <p className="font-semibold text-slate-800">
                      {g ? `${g.firstName} ${g.lastName}` : 'Misafir silinmiş'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Oda {room?.number ?? '—'} · {formatDate(r.checkIn)} → {formatDate(r.checkOut)} ({nightsOf(r)} gece)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(total)}</p>
                    <p className="text-xs text-emerald-700">Ödenen: {formatCurrency(paid)}</p>
                    <p className="text-xs text-rose-600">Kalan: {formatCurrency(total - paid)}</p>
                  </div>
                </div>
                <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
                  <span className="font-semibold text-rose-700">{deletedBy || 'Bilinmiyor'}</span> tarafından{' '}
                  {deletedAt ? formatDateTime(deletedAt) : '—'} tarihinde silindi
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (confirm(`${r.code} geri getirilsin mi? Rezervasyon tekrar aktif olacak.`)) {
                        restoreReservation(r.id);
                      }
                    }}
                  >
                    ↩️ Geri Getir
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (
                          confirm(
                            `${r.code} KALICI olarak silinsin mi? Bu işlem GERİ ALINAMAZ, veri tamamen kaybolur.`
                          )
                        ) {
                          permanentlyDeleteReservation(r.id);
                        }
                      }}
                    >
                      🗑 Kalıcı Sil
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub: string;
  accent: 'teal' | 'emerald' | 'blue' | 'rose' | 'violet';
  onClick?: () => void;
  active?: boolean;
}) {
  const ring = {
    teal: 'border-teal-100',
    emerald: 'border-emerald-100',
    blue: 'border-blue-100',
    rose: 'border-rose-100',
    violet: 'border-violet-100',
  }[accent];
  const val = {
    teal: 'text-teal-800',
    emerald: 'text-emerald-800',
    blue: 'text-blue-800',
    rose: 'text-rose-800',
    violet: 'text-violet-800',
  }[accent];
  const activeRing = {
    teal: 'ring-2 ring-teal-400 border-teal-300 bg-teal-50/50',
    emerald: 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50/50',
    blue: 'ring-2 ring-blue-400 border-blue-300 bg-blue-50/50',
    rose: 'ring-2 ring-rose-400 border-rose-300 bg-rose-50/50',
    violet: 'ring-2 ring-violet-400 border-violet-300 bg-violet-50/50',
  }[accent];

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
          ring,
          active && activeRing
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className={cn('mt-1 text-xl font-bold tabular-nums', val)}>{value}</p>
        <p className="text-[11px] text-slate-400">{sub}</p>
      </button>
    );
  }

  return (
    <div className={cn('rounded-2xl border bg-white p-3 shadow-sm', ring)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', val)}>{value}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-600">
      <span className={cn('h-3 w-5 rounded', swatch)} />
      {label}
    </div>
  );
}

function HeaderGuide({ x, color, label }: { x: number; color: string; label: string }) {
  return (
    <div className="pointer-events-none absolute top-0 z-[5] h-full" style={{ left: x }}>
      <div
        className="absolute left-1 top-1 whitespace-nowrap rounded px-1 text-[9px] font-bold text-white"
        style={{ background: color }}
      >
        {label}
      </div>
      <div className="h-full w-px border-l border-dashed opacity-60" style={{ borderColor: color }} />
    </div>
  );
}

function HoverCard({ res, state }: { res: Reservation; state: AppState }) {
  const g = state.guests.find((x) => x.id === res.guestId);
  const room = state.rooms.find((x) => x.id === res.roomId);
  const bal = balanceDue(res, state.payments);
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-slate-900">
          {g?.firstName} {g?.lastName}
          {g?.vip ? ' ★' : ''}
        </p>
        <Badge color={statusColor(res.status)}>{RES_STATUS_LABELS[res.status]}</Badge>
      </div>
      <p className="text-slate-500">
        {res.code} · Oda {room?.number}
      </p>
      <p className="text-slate-600">
        {formatDate(res.checkIn)}{res.checkInTime ? ` ${res.checkInTime}` : ''} → {formatDate(res.checkOut)} {res.checkOutTime || '11:00'} · {nightsOf(res)} gece
      </p>
      <p className="font-semibold text-teal-800">
        {formatCurrency(grandTotal(res))} · Bakiye {formatCurrency(bal)}
      </p>
      <p className="text-slate-500">
        Ödenen: {formatCurrency(paidTotal(state.payments, res.id))} · {paymentMethodSummary(state.payments, res.id)}
      </p>
    </div>
  );
}

function ResDetail({
  res,
  state,
  onClose,
  onCheckIn,
  onCancel,
  onPay,
  onOpenFull,
  onFrontDesk,
}: {
  res: Reservation;
  state: AppState;
  onClose: () => void;
  onCheckIn: () => void;
  onCancel: () => void;
  onPay: (method: PaymentMethod) => void;
  onOpenFull: () => void;
  onFrontDesk: () => void;
}) {
  const g = state.guests.find((x) => x.id === res.guestId);
  const room = state.rooms.find((x) => x.id === res.roomId);
  const bal = balanceDue(res, state.payments);
  const canCheckIn = ['pending', 'confirmed'].includes(res.status);
  const [payMethodChoice, setPayMethodChoice] = useState<PaymentMethod>('cash');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge color={statusColor(res.status)}>{RES_STATUS_LABELS[res.status]}</Badge>
        <Badge color={statusColor(res.paymentStatus)}>{PAY_STATUS_LABELS[res.paymentStatus]}</Badge>
        <Badge color="slate">{res.source}</Badge>
        {g?.vip && <Badge color="amber">VIP</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Misafir</p>
          <p className="mt-1 font-semibold">
            {g?.firstName} {g?.lastName}
          </p>
          <p className="text-sm text-slate-500">{g?.phone || g?.idNumber || '—'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Konaklama</p>
          <p className="mt-1 font-semibold">
            Oda {room?.number} · {room && ROOM_TYPE_LABELS[room.type]}
          </p>
          <p className="text-sm text-slate-500">
            {formatDate(res.checkIn)}{res.checkInTime ? ` ${res.checkInTime}` : ''} → {formatDate(res.checkOut)} {res.checkOutTime || '11:00'} ({nightsOf(res)} gece)
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 p-4 text-sm">
        <div className="flex justify-between">
          <span>Toplam</span>
          <span className="font-bold">{formatCurrency(grandTotal(res))}</span>
        </div>
        <div className="mt-1 flex justify-between text-teal-800">
          <span>Bakiye</span>
          <span className="font-semibold">{formatCurrency(bal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-emerald-700">
          <span>Ödenen ({paymentMethodSummary(state.payments, res.id)})</span>
          <span className="font-semibold">{formatCurrency(paidTotal(state.payments, res.id))}</span>
        </div>
        {res.specialRequests && (
          <p className="mt-2 text-xs text-violet-700">Özel istek: {res.specialRequests}</p>
        )}
        {res.notes && <p className="mt-1 text-xs text-slate-500">Not: {res.notes}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {canCheckIn && (
          <Button size="sm" onClick={onCheckIn}>
            <LogIn size={14} /> Check-in
          </Button>
        )}
        {res.status === 'checked_in' && (
          <Button size="sm" variant="secondary" onClick={onFrontDesk}>
            <LogOut size={14} /> Resepsiyon / Çıkış
          </Button>
        )}
        {bal > 0 && (
          <>
            <select
              value={payMethodChoice}
              onChange={(e) => setPayMethodChoice(e.target.value as PaymentMethod)}
              className="h-8 rounded-lg border border-slate-200 px-1.5 text-xs"
            >
              {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={() => onPay(payMethodChoice)}>
              Bakiyeyi Tahsil Et
            </Button>
          </>
        )}
        {!['cancelled', 'checked_out'].includes(res.status) && (
          <Button size="sm" variant="danger" onClick={onCancel}>
            İptal
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onOpenFull}>
          <CalendarRange size={14} /> Rezervasyonlar
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </div>
  );
}
