import { useMemo, useState } from 'react';
import { LogIn, LogOut, Search, CreditCard, UserPlus, FileText, Users, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
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
import { balanceDue, grandTotal, paidTotal, paymentMethodSummary } from '../lib/calculations';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  PAY_METHOD_LABELS,
  RES_STATUS_LABELS,
  todayISO,
} from '../lib/utils';
import type { PaymentMethod, Reservation } from '../lib/types';

type CompanionDraft = {
  mode: 'existing' | 'new';
  guestId: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  isChild: boolean;
  isExtra: boolean;
  relation: string;
};

const emptyDraft = (): CompanionDraft => ({
  mode: 'new',
  guestId: '',
  firstName: '',
  lastName: '',
  idNumber: '',
  phone: '',
  isChild: false,
  isExtra: false,
  relation: 'Yan misafir',
});

export default function FrontDesk() {
  const {
    state,
    checkIn,
    checkOut,
    undoCheckOut,
    addPayment,
    addCompanion,
    removeCompanion,
    currentUser,
    session,
  } = useStore();
  const t = todayISO();
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [checkInRes, setCheckInRes] = useState<Reservation | null>(null);
  const [drafts, setDrafts] = useState<CompanionDraft[]>([]);
  const [extraOpen, setExtraOpen] = useState<Reservation | null>(null);
  const [extraDraft, setExtraDraft] = useState<CompanionDraft>(emptyDraft());

  const myId = session?.staffId || state.currentUserId;
  const pendingInvoices = useMemo(
    () =>
      (state.invoices || []).filter(
        (i) => !i.deletedAt && i.status === 'pending' && i.responsibleStaffId === myId
      ),
    [state.invoices, myId]
  );

  const guestName = (id: string) => {
    const g = state.guests.find((x) => x.id === id);
    return g ? `${g.firstName} ${g.lastName}` : '-';
  };
  const roomCap = (roomId: string) => state.rooms.find((r) => r.id === roomId)?.capacity ?? 0;
  const partyCount = (r: Reservation) => 1 + (r.companions || []).length;

  const arrivals = useMemo(() => {
    return state.reservations.filter((r) => {
      if (r.deletedAt) return false;
      if (!['confirmed', 'pending'].includes(r.status)) return false;
      if (r.checkIn > t) return false;
      if (!q) return true;
      const g = state.guests.find((x) => x.id === r.guestId);
      const room = state.rooms.find((x) => x.id === r.roomId);
      const s = q.toLowerCase();
      const compHit = (r.companions || []).some((c) => {
        const cg = state.guests.find((x) => x.id === c.guestId);
        return (
          !!cg &&
          (cg.firstName.toLowerCase().includes(s) || cg.lastName.toLowerCase().includes(s))
        );
      });
      return (
        r.code.toLowerCase().includes(s) ||
        g?.firstName.toLowerCase().includes(s) ||
        g?.lastName.toLowerCase().includes(s) ||
        room?.number.includes(s) ||
        compHit
      );
    });
  }, [state, t, q]);

  const departures = useMemo(
    () =>
      state.reservations
        .filter((r) => !r.deletedAt && r.status === 'checked_in')
        .sort((a, b) => a.checkOut.localeCompare(b.checkOut)),
    [state]
  );
  const todayDepartures = departures.filter((r) => r.checkOut <= t);
  const staying = departures.filter((r) => r.checkOut > t);
  const liveRes = (id: string) => state.reservations.find((r) => r.id === id);

  // Son 3 saat icinde check-out yapilmis rezervasyonlar — misafir fikir
  // degistirip konaklamaya devam etmek isterse "Cikisi Iptal Et" ile
  // buradan geri alinabilir.
  const recentCheckouts = useMemo(
    () =>
      state.reservations
        .filter(
          (r) =>
            !r.deletedAt &&
            r.status === 'checked_out' &&
            r.checkedOutAt &&
            Date.now() - new Date(r.checkedOutAt).getTime() < 3 * 3600 * 1000
        )
        .sort((a, b) => (b.checkedOutAt || '').localeCompare(a.checkedOutAt || '')),
    [state.reservations]
  );

  const applyDrafts = (reservationId: string) => {
    for (const d of drafts) {
      if (d.mode === 'existing') {
        if (!d.guestId) continue;
        const err = addCompanion(reservationId, {
          guestId: d.guestId,
          isChild: d.isChild,
          isExtra: d.isExtra,
          relation: d.relation,
        });
        if (typeof err === 'object' && err && 'error' in err) {
          setMsg({ type: 'err', text: err.error });
          return false;
        }
      } else {
        if (!d.firstName.trim() || !d.lastName.trim()) {
          setMsg({ type: 'err', text: 'Ek misafir adi soyadi zorunlu' });
          return false;
        }
        const err = addCompanion(reservationId, {
          newGuest: {
            firstName: d.firstName.trim(),
            lastName: d.lastName.trim(),
            email: '',
            phone: d.phone,
            idNumber: d.idNumber,
            nationality: 'TR',
            address: '',
            notes: d.relation || 'Check-in ek misafir',
            vip: false,
          },
          isChild: d.isChild,
          isExtra: d.isExtra,
          relation: d.relation,
        });
        if (typeof err === 'object' && err && 'error' in err) {
          setMsg({ type: 'err', text: err.error });
          return false;
        }
      }
    }
    return true;
  };

  const confirmCheckIn = () => {
    if (!checkInRes) return;
    if (drafts.length && !applyDrafts(checkInRes.id)) return;
    const err = checkIn(checkInRes.id);
    if (err) setMsg({ type: 'err', text: String(err) });
    else {
      setMsg({
        type: 'ok',
        text: 'Check-in tamam. Fatura kesmeniz gerekiyor - Faturalar sayfasini kontrol edin.',
      });
      setCheckInRes(null);
      setDrafts([]);
    }
  };

  const doCheckOut = (id: string) => {
    const err = checkOut(id);
    if (err) setMsg({ type: 'err', text: String(err) });
    else setMsg({ type: 'ok', text: 'Check-out tamamlandi. Oda temilige alindi.' });
  };

  const openPay = (resId: string) => {
    const r = state.reservations.find((x) => x.id === resId);
    if (!r) return;
    setPayOpen(resId);
    setPayAmount(Math.max(0, balanceDue(r, state.payments)));
    setPayMethod('cash');
  };

  const submitPay = () => {
    if (!payOpen || !payAmount) return;
    addPayment({
      reservationId: payOpen,
      amount: payAmount,
      method: payMethod,
      date: todayISO(),
      note: 'Resepsiyon tahsilati',
      receivedBy: currentUser?.name ?? 'Resepsiyon',
      receivedByStaffId: myId,
    });
    setPayOpen(null);
    setMsg({
      type: 'ok',
      text: `Odeme alindi: ${formatCurrency(payAmount)}. Fatura goreviniz olustu.`,
    });
  };

  const submitExtra = () => {
    if (!extraOpen) return;
    const d = extraDraft;
    if (d.mode === 'existing') {
      if (!d.guestId) return;
      const err = addCompanion(extraOpen.id, {
        guestId: d.guestId,
        isChild: d.isChild,
        isExtra: true,
        relation: d.relation,
      });
      if (typeof err === 'object' && err && 'error' in err) setMsg({ type: 'err', text: err.error });
      else {
        setMsg({ type: 'ok', text: 'Ekstra misafir eklendi' });
        setExtraOpen(null);
      }
    } else {
      if (!d.firstName.trim() || !d.lastName.trim()) {
        setMsg({ type: 'err', text: 'Ad soyad zorunlu' });
        return;
      }
      const err = addCompanion(extraOpen.id, {
        newGuest: {
          firstName: d.firstName.trim(),
          lastName: d.lastName.trim(),
          email: '',
          phone: d.phone,
          idNumber: d.idNumber,
          nationality: 'TR',
          address: '',
          notes: 'Ekstra misafir',
          vip: false,
        },
        isChild: d.isChild,
        isExtra: true,
        relation: d.relation,
      });
      if (typeof err === 'object' && err && 'error' in err) setMsg({ type: 'err', text: err.error });
      else {
        setMsg({ type: 'ok', text: 'Ekstra misafir eklendi (profil olustu)' });
        setExtraOpen(null);
      }
    }
  };

  const compsLine = (r: Reservation) => {
    const comps = r.companions || [];
    if (!comps.length) return null;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {comps.map((c) => (
          <Badge key={c.id} color={c.isExtra ? 'orange' : c.isChild ? 'violet' : 'slate'}>
            {guestName(c.guestId)}
            {c.isChild ? ' (cocuk)' : ''}
            {c.isExtra ? ' +ekstra' : ''}
          </Badge>
        ))}
      </div>
    );
  };

  const ci = checkInRes ? liveRes(checkInRes.id) || checkInRes : null;

  return (
    <div>
      <PageHeader
        title="Resepsiyon (Front Desk)"
        subtitle="Check-in · oda misafirleri · tahsilat · fatura sorumlulugu"
        actions={
          pendingInvoices.length > 0 ? (
            <Link to="/invoices">
              <Button variant="danger" size="sm">
                <FileText size={14} /> {pendingInvoices.length} fatura bekliyor
              </Button>
            </Link>
          ) : undefined
        }
      />

      {pendingInvoices.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Mali uyari:</strong> Sorumlulugunuzda {pendingInvoices.length} kesilmemis fatura var.
          Denetimde ceza riski icin dosyayi yukleyip numara girin.{' '}
          <Link to="/invoices" className="font-semibold underline">
            Faturalar sayfasina git
          </Link>
        </div>
      )}

      {msg && (
        <div
          className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
            msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
          }`}
        >
          {msg.text}
          <button className="ml-3 underline" type="button" onClick={() => setMsg(null)}>
            Kapat
          </button>
        </div>
      )}

      <Card className="mb-4 p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kod, misafir, yan misafir, oda..."
            className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-blue-50/50 px-4 py-3">
            <LogIn className="text-blue-700" size={18} />
            <h3 className="font-semibold text-blue-900">Gelisler / Check-in</h3>
            <Badge color="blue">{arrivals.length}</Badge>
          </div>
          <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
            {arrivals.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-400">Bekleyen gelis yok</p>
            )}
            {arrivals.map((r) => {
              const g = state.guests.find((x) => x.id === r.guestId);
              const room = state.rooms.find((x) => x.id === r.roomId);
              const cap = roomCap(r.roomId);
              const party = partyCount(r);
              return (
                <div key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {g?.firstName} {g?.lastName}
                        {g?.vip ? ' *' : ''}
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.code} · Oda {room?.number} · {formatDate(r.checkIn)} - {formatDate(r.checkOut)} ·{' '}
                        {party}/{cap || '?'} kisi
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge color={statusColor(r.status)}>{RES_STATUS_LABELS[r.status]}</Badge>
                        {r.checkIn < t && <Badge color="rose">Gecikmis</Badge>}
                        {cap > 0 && party > cap && (
                          <Badge color="orange">Kapasite ustu +{party - cap}</Badge>
                        )}
                      </div>
                      {compsLine(r)}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" onClick={() => { setCheckInRes(r); setDrafts([]); }}>
                        <LogIn size={14} /> Check-in
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openPay(r.id)}>
                        <CreditCard size={14} /> Odeme
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setExtraOpen(r);
                          setExtraDraft({ ...emptyDraft(), isExtra: true });
                        }}
                      >
                        <UserPlus size={14} /> Ek misafir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-rose-50/50 px-4 py-3">
              <LogOut className="text-rose-700" size={18} />
              <h3 className="font-semibold text-rose-900">Bugun / Gecikmis Ayrilislar</h3>
              <Badge color="rose">{todayDepartures.length}</Badge>
            </div>
            <div className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto">
              {todayDepartures.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-400">Bugun ayrilis yok</p>
              )}
              {todayDepartures.map((r) => {
                const g = state.guests.find((x) => x.id === r.guestId);
                const room = state.rooms.find((x) => x.id === r.roomId);
                const bal = balanceDue(r, state.payments);
                const invPending = (state.invoices || []).some(
                  (i) => i.reservationId === r.id && i.status === 'pending'
                );
                return (
                  <div key={r.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {g?.firstName} {g?.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          Oda {room?.number} · {partyCount(r)} kisi · {formatCurrency(grandTotal(r))}
                        </p>
                        {compsLine(r)}
                        <p className={`mt-1 text-sm font-semibold ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          Bakiye: {formatCurrency(bal)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Ödenen: {formatCurrency(paidTotal(state.payments, r.id))} · {paymentMethodSummary(state.payments, r.id)}
                        </p>
                        {invPending && <Badge color="amber">Fatura kesilmedi</Badge>}
                      </div>
                      <div className="flex flex-col gap-2">
                        {bal > 0 && (
                          <Button size="sm" variant="outline" onClick={() => openPay(r.id)}>
                            Tahsil Et
                          </Button>
                        )}
                        <Button size="sm" variant={bal > 0 ? 'secondary' : 'success'} onClick={() => doCheckOut(r.id)}>
                          <LogOut size={14} /> Check-out
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setExtraOpen(r);
                            setExtraDraft({ ...emptyDraft(), isExtra: true });
                          }}
                        >
                          <UserPlus size={14} /> Ek misafir
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {recentCheckouts.length > 0 && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <RotateCcw size={16} />
                <h3 className="font-semibold">Az Önce Çıkış Yapanlar</h3>
                <Badge color="slate">{recentCheckouts.length}</Badge>
              </div>
              <div className="divide-y divide-slate-100">
                {recentCheckouts.map((r) => {
                  const g = state.guests.find((x) => x.id === r.guestId);
                  const room = state.rooms.find((x) => x.id === r.roomId);
                  return (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="font-medium">{g?.firstName} {g?.lastName}</p>
                        <p className="text-xs text-slate-400">
                          Oda {room?.number} · Çıkış: {r.checkedOutAt ? formatDateTime(r.checkedOutAt) : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(`${g?.firstName ?? ''} ${g?.lastName ?? ''} için çıkış iptal edilsin mi? Misafir konaklamaya devam edecek.`)) {
                            const err = undoCheckOut(r.id);
                            if (err) alert(err);
                          }
                        }}
                      >
                        <RotateCcw size={14} /> Çıkışı İptal Et
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Users size={16} />
              <h3 className="font-semibold">Oteldeki Diğer Misafirler</h3>
              <Badge>{staying.length}</Badge>
            </div>
            <div className="max-h-[220px] divide-y divide-slate-100 overflow-y-auto">
              {staying.map((r) => {
                const g = state.guests.find((x) => x.id === r.guestId);
                const room = state.rooms.find((x) => x.id === r.roomId);
                const bal = balanceDue(r, state.payments);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {g?.firstName} {g?.lastName} · {room?.number} · {partyCount(r)} kisi
                      </p>
                      <p className="text-xs text-slate-400">
                        Cikis {formatDate(r.checkOut)} · Bakiye {formatCurrency(bal)}
                      </p>
                      <p className="text-xs text-slate-400">
                        Ödenen {formatCurrency(paidTotal(state.payments, r.id))} · {paymentMethodSummary(state.payments, r.id)}
                      </p>
                      {compsLine(r)}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openPay(r.id)}>
                        Ode
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setExtraOpen(r);
                          setExtraDraft({ ...emptyDraft(), isExtra: true });
                        }}
                      >
                        + Misafir
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => doCheckOut(r.id)}>
                        Erken Cikis
                      </Button>
                    </div>
                  </div>
                );
              })}
              {staying.length === 0 && <p className="p-6 text-center text-sm text-slate-400">-</p>}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={!!ci} onClose={() => setCheckInRes(null)} title={ci ? `Check-in · ${ci.code}` : ''} wide>
        {ci && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold">
                Ana misafir: {guestName(ci.guestId)} · Oda{' '}
                {state.rooms.find((r) => r.id === ci.roomId)?.number}
              </p>
              <p className="text-xs text-slate-500">
                Kapasite {roomCap(ci.roomId)} · Yan misafir {(ci.companions || []).length}
              </p>
              <p className="mt-2 text-xs text-amber-800">
                Check-in sonrasi faturayi kesmek sizin sorumlulugunuzdadir (dosya yukleme zorunlu).
              </p>
            </div>

            {(ci.companions || []).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm"
              >
                <span>
                  {guestName(c.guestId)}
                  {c.isChild ? ' · cocuk' : ''}
                  {c.isExtra ? ' · ekstra' : ''}
                </span>
                <button
                  type="button"
                  className="text-xs text-rose-600"
                  onClick={() => removeCompanion(ci.id, c.id)}
                >
                  Cikar
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Giriste yan misafir ekle</p>
              <Button size="sm" variant="outline" onClick={() => setDrafts((d) => [...d, emptyDraft()])}>
                <UserPlus size={14} /> Satir ekle
              </Button>
            </div>

            {drafts.map((d, idx) => (
              <div key={idx} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={d.mode === 'new'}
                      onChange={() =>
                        setDrafts((arr) => arr.map((x, i) => (i === idx ? { ...x, mode: 'new' } : x)))
                      }
                    />
                    Yeni misafir
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={d.mode === 'existing'}
                      onChange={() =>
                        setDrafts((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, mode: 'existing' } : x))
                        )
                      }
                    />
                    Kayitli
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={d.isChild}
                      onChange={(e) =>
                        setDrafts((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, isChild: e.target.checked } : x))
                        )
                      }
                    />
                    Cocuk
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={d.isExtra}
                      onChange={(e) =>
                        setDrafts((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, isExtra: e.target.checked } : x))
                        )
                      }
                    />
                    Ekstra (kapasite ustu)
                  </label>
                  <button
                    type="button"
                    className="ml-auto text-rose-600"
                    onClick={() => setDrafts((arr) => arr.filter((_, i) => i !== idx))}
                  >
                    Sil
                  </button>
                </div>
                {d.mode === 'existing' ? (
                  <Select
                    label="Misafir"
                    value={d.guestId}
                    onChange={(e) =>
                      setDrafts((arr) =>
                        arr.map((x, i) => (i === idx ? { ...x, guestId: e.target.value } : x))
                      )
                    }
                  >
                    <option value="">Secin...</option>
                    {state.guests
                      .filter((g) => !g.deletedAt && g.id !== ci.guestId)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.firstName} {g.lastName}
                        </option>
                      ))}
                  </Select>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      label="Ad *"
                      value={d.firstName}
                      onChange={(e) =>
                        setDrafts((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, firstName: e.target.value } : x))
                        )
                      }
                    />
                    <Input
                      label="Soyad *"
                      value={d.lastName}
                      onChange={(e) =>
                        setDrafts((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, lastName: e.target.value } : x))
                        )
                      }
                    />
                    <Input
                      label="TC / Pasaport"
                      value={d.idNumber}
                      onChange={(e) =>
                        setDrafts((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, idNumber: e.target.value } : x))
                        )
                      }
                    />
                    <Input
                      label="Telefon"
                      value={d.phone}
                      onChange={(e) =>
                        setDrafts((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, phone: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCheckInRes(null)}>
                Iptal
              </Button>
              <Button onClick={confirmCheckIn}>
                <LogIn size={14} /> Check-in tamamla
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!extraOpen} onClose={() => setExtraOpen(null)} title="Ekstra misafir ekle">
        {extraOpen && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Kapasite {roomCap(extraOpen.roomId)}. Fazla kisi icin ekstra isaretli kalsin. Profil otomatik olusur.
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={extraDraft.mode === 'new'}
                  onChange={() => setExtraDraft({ ...extraDraft, mode: 'new' })}
                />
                Yeni
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={extraDraft.mode === 'existing'}
                  onChange={() => setExtraDraft({ ...extraDraft, mode: 'existing' })}
                />
                Kayitli
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={extraDraft.isChild}
                  onChange={(e) => setExtraDraft({ ...extraDraft, isChild: e.target.checked })}
                />
                Cocuk
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={extraDraft.isExtra}
                  onChange={(e) => setExtraDraft({ ...extraDraft, isExtra: e.target.checked })}
                />
                Ekstra
              </label>
            </div>
            {extraDraft.mode === 'existing' ? (
              <Select
                label="Misafir *"
                value={extraDraft.guestId}
                onChange={(e) => setExtraDraft({ ...extraDraft, guestId: e.target.value })}
              >
                <option value="">Secin...</option>
                {state.guests
                  .filter((g) => !g.deletedAt)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.firstName} {g.lastName}
                    </option>
                  ))}
              </Select>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  label="Ad *"
                  value={extraDraft.firstName}
                  onChange={(e) => setExtraDraft({ ...extraDraft, firstName: e.target.value })}
                />
                <Input
                  label="Soyad *"
                  value={extraDraft.lastName}
                  onChange={(e) => setExtraDraft({ ...extraDraft, lastName: e.target.value })}
                />
                <Input
                  label="TC / Pasaport"
                  value={extraDraft.idNumber}
                  onChange={(e) => setExtraDraft({ ...extraDraft, idNumber: e.target.value })}
                />
                <Input
                  label="Telefon"
                  value={extraDraft.phone}
                  onChange={(e) => setExtraDraft({ ...extraDraft, phone: e.target.value })}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExtraOpen(null)}>
                Iptal
              </Button>
              <Button onClick={submitExtra}>Ekle</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!payOpen} onClose={() => setPayOpen(null)} title="Odeme Al">
        <div className="space-y-3">
          <p className="text-xs text-amber-800">
            Tahsilat sonrasi fatura gorevi size atanir. Dosyayi Faturalar sayfasindan yukleyin.
          </p>
          <Input
            label="Tutar (TL) *"
            type="number"
            value={payAmount || ''}
            onChange={(e) => setPayAmount(+e.target.value)}
          />
          <Select
            label="Yontem *"
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
          >
            {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPayOpen(null)}>
              Iptal
            </Button>
            <Button onClick={submitPay}>Tahsil Et</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
