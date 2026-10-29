import { useCallback, useEffect, useMemo, useState } from 'react';
import { BedDouble, CalendarDays, Mail, Phone, RefreshCw, Users, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Select } from '../components/ui';
import { formatCurrency, formatDate, formatDateTime, ROOM_TYPE_LABELS } from '../lib/utils';
import { fetchWebReservations, markWebReservation, type WebReservation } from '../lib/webInbox';

const digits = (s?: string | null) => (s || '').replace(/\D/g, '');

export default function WebReservations() {
  const { state, addGuest, addReservation, getAvailableRooms, pushToast } = useStore();
  const [tab, setTab] = useState<'new' | 'done'>('new');
  const [items, setItems] = useState<WebReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState<WebReservation | null>(null);
  const [roomId, setRoomId] = useState('');
  const [assignError, setAssignError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const rows = await fetchWebReservations();
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, [load]);

  const list = useMemo(
    () => items.filter((r) => (tab === 'new' ? r.status === 'new' : r.status !== 'new')),
    [items, tab]
  );
  const newCount = items.filter((r) => r.status === 'new').length;

  const availableRooms = useMemo(() => {
    if (!active) return [];
    return getAvailableRooms(active.check_in, active.check_out);
  }, [active, getAvailableRooms, state.reservations]);

  const openAssign = (r: WebReservation) => {
    setActive(r);
    setRoomId('');
    setAssignError('');
  };

  const assign = async () => {
    if (!active) return;
    if (!roomId) {
      setAssignError('Bir oda seçin.');
      return;
    }
    setBusy(true);
    setAssignError('');
    try {
      // Misafir: telefon numarasına göre mevcut kayıt, yoksa yeni
      const phoneD = digits(active.guest_phone);
      const existing = phoneD
        ? state.guests.find((g) => !g.deletedAt && digits(g.phone).slice(-10) === phoneD.slice(-10))
        : undefined;
      let guestId = existing?.id;
      if (!guestId) {
        const parts = active.guest_name.trim().split(/\s+/);
        const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
        const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '-';
        guestId = addGuest({
          firstName,
          lastName,
          email: active.guest_email || '',
          phone: active.guest_phone || '',
          idNumber: '',
          nationality: 'TR',
          address: '',
          notes: 'Web sitesinden geldi',
          vip: false,
        });
      }
      const nights =
        active.nights ||
        Math.max(1, Math.round((Date.parse(active.check_out) - Date.parse(active.check_in)) / 86400000));
      const noteParts = [
        `Web rezervasyonu ${active.code}`,
        active.payment_method ? `Ödeme: ${active.payment_method}` : '',
        active.room_name ? `İstenen oda: ${active.room_name}` : '',
      ].filter(Boolean);
      const result = addReservation({
        guestId,
        roomId,
        checkIn: active.check_in,
        checkOut: active.check_out,
        checkOutTime: '11:00',
        adults: active.adults || 1,
        children: active.children || 0,
        status: 'confirmed',
        nightlyRate: active.total_price ? Math.round((active.total_price / nights) * 100) / 100 : 0,
        discount: 0,
        taxRate: state.settings.taxRate,
        deposit: 0,
        notes: noteParts.join(' · '),
        source: 'Web Sitesi',
        specialRequests: active.special_requests || '',
      });
      if (typeof result === 'object' && 'error' in result) {
        setAssignError(result.error);
        return;
      }
      await markWebReservation(active.id, 'assigned', result);
      setActive(null);
      pushToast('ok', `Web rezervasyonu ${active.code} odaya atandı`);
      await load();
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (r: WebReservation) => {
    if (!window.confirm(`${r.code} numaralı web rezervasyonu listeden kaldırılsın mı? (Rezervasyon oluşturulmaz)`)) return;
    try {
      await markWebReservation(r.id, 'dismissed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  };

  return (
    <div>
      <PageHeader
        title="Web Rezervasyonları"
        subtitle="uyuroom.com üzerinden gelen, henüz odası atanmamış rezervasyonlar"
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw size={14} /> Yenile
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('new')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${tab === 'new' ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          Oda bekleyen {newCount > 0 && <span className="ml-1 rounded-full bg-white/25 px-1.5 text-xs">{newCount}</span>}
        </button>
        <button
          onClick={() => setTab('done')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${tab === 'done' ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          İşlenenler
        </button>
      </div>

      {error && <p className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Yükleniyor…</p>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            title={tab === 'new' ? 'Oda bekleyen web rezervasyonu yok' : 'İşlenmiş kayıt yok'}
            desc={tab === 'new' ? 'Siteden yeni rezervasyon geldiğinde burada görünür.' : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{r.guest_name}</span>
                    <Badge color="blue">{r.code}</Badge>
                    {r.status === 'assigned' && <Badge color="emerald">Odası atandı</Badge>}
                    {r.status === 'dismissed' && <Badge color="slate">Kaldırıldı</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={14} /> {formatDate(r.check_in)} → {formatDate(r.check_out)}
                      {r.nights ? ` (${r.nights} gece)` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={14} /> {r.adults ?? 1} yetişkin{r.children ? `, ${r.children} çocuk` : ''}
                    </span>
                    {r.room_name && (
                      <span className="inline-flex items-center gap-1.5">
                        <BedDouble size={14} /> {r.room_name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                    {r.guest_phone && (
                      <a href={`tel:${r.guest_phone}`} className="inline-flex items-center gap-1.5 hover:text-teal-700">
                        <Phone size={14} /> {r.guest_phone}
                      </a>
                    )}
                    {r.guest_email && (
                      <a href={`mailto:${r.guest_email}`} className="inline-flex items-center gap-1.5 hover:text-teal-700">
                        <Mail size={14} /> {r.guest_email}
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {r.total_price != null && <strong className="text-slate-800">{formatCurrency(r.total_price)}</strong>}
                    {r.payment_method ? ` · ${r.payment_method}` : ''} · {formatDateTime(r.created_at)}
                  </p>
                  {r.special_requests && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Özel istek: {r.special_requests}</p>
                  )}
                </div>
                {r.status === 'new' && (
                  <div className="flex shrink-0 gap-2">
                    <Button onClick={() => openAssign(r)}>Oda ata</Button>
                    <Button variant="ghost" onClick={() => void dismiss(r)} title="Listeden kaldır">
                      <X size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!active} onClose={() => setActive(null)} title="Oda ata">
        {active && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{active.guest_name}</p>
              <p>
                {formatDate(active.check_in)} → {formatDate(active.check_out)}
                {active.nights ? ` · ${active.nights} gece` : ''}
              </p>
              {active.room_name && <p className="text-slate-500">İstenen oda: {active.room_name}</p>}
            </div>
            <Select label="Müsait odalar" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Oda seçin…</option>
              {availableRooms.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  Oda {rm.number} · {ROOM_TYPE_LABELS[rm.type] || rm.type} · {rm.capacity} kişilik
                </option>
              ))}
            </Select>
            {availableRooms.length === 0 && (
              <p className="text-sm text-rose-600">Bu tarihlerde müsait oda yok.</p>
            )}
            {assignError && <p className="text-sm text-rose-600">{assignError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setActive(null)}>
                Vazgeç
              </Button>
              <Button onClick={() => void assign()} disabled={busy || !roomId}>
                {busy ? 'Kaydediliyor…' : 'Rezervasyonu oluştur'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
