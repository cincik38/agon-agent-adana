import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, Eye, Pencil, Trash2, XCircle, MessageCircle, RotateCcw } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Reservation, ReservationStatus } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  statusColor,
} from '../components/ui';
import {
  balanceDue,
  extrasTotal,
  grandTotal,
  nightsOf,
  roomSubtotal,
  paymentMethodSummary,
  paidTotal,
} from '../lib/calculations';
import {
  downloadCSV,
  formatCurrency,
  formatDate,
  formatDateTime,
  PAY_STATUS_LABELS,
  RES_STATUS_LABELS,
  ROOM_TYPE_LABELS,
  addDays,
  todayISO,
  buildReviewWhatsAppLink,
  buildMenuWhatsAppLink,
  PAY_METHOD_LABELS,
} from '../lib/utils';

export default function Reservations() {
  const {
    state,
    addReservation,
    updateReservation,
    cancelReservation,
    deleteReservation,
    undoCheckOut,
    addGuest,
    updateGuest,
    getAvailableRooms,
    addExtra,
    removeExtra,
    addPayment,
    updatePayment,
    deletePayment,
    updateRoom,
    currentUser,
    isAdmin,
    addCompanion,
    removeCompanion,
  } = useStore();

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Reservation | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const rid = searchParams.get('id');
    if (rid) {
      const r = state.reservations.find((x) => x.id === rid);
      if (r) setDetail(r);
      setSearchParams((p) => {
        p.delete('id');
        return p;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [error, setError] = useState('');
  const [matchedGuestId, setMatchedGuestId] = useState('');
  const [blacklistAck, setBlacklistAck] = useState(false);

  const [form, setForm] = useState({
    roomId: '',
    checkIn: todayISO(),
    checkOut: addDays(todayISO(), 2),
    checkInTime: '',
    checkOutTime: '11:00',
    adults: 2,
    children: 0,
    status: 'confirmed' as ReservationStatus,
    nightlyRate: 0,
    discount: 0,
    taxRate: state.settings.taxRate,
    deposit: 0,
    depositMethod: 'cash' as 'cash' | 'card' | 'transfer' | 'online' | 'other',
    notes: '',
    source: 'Doğrudan',
    specialRequests: '',
    // new guest fields
    firstName: '',
    lastName: '',
    idNumber: '',
    phone: '',
  });

  const [extraForm, setExtraForm] = useState({ name: '', amount: 0, quantity: 1, category: 'F&B' });
  const [payForm, setPayForm] = useState({ amount: 0, method: 'cash' as 'cash' | 'card' | 'transfer' | 'online' | 'other', note: '' });
  // Belirli bir odemeyi duzenlemek icin (satir ici) acilan form
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentEditForm, setPaymentEditForm] = useState({ amount: 0, method: 'cash' as 'cash' | 'card' | 'transfer' | 'online' | 'other', note: '' });
  // Ana misafirin bilgilerini rezervasyonu silip yeniden olusturmadan
  // duzenleyebilmek icin (telefonla hizli rezervasyon sonrasi eksik
  // bilgileri tamamlamak gibi durumlar icin).
  const [guestEditOpen, setGuestEditOpen] = useState(false);
  const [guestEditForm, setGuestEditForm] = useState({ firstName: '', lastName: '', idNumber: '', phone: '', email: '' });
  // Yeni rezervasyon olustururken eklenecek ek misafirler — rezervasyon
  // henuz olusturulmadigi icin gecici olarak burada tutulur, kaydedince
  // her biri icin addCompanion (+ ucretliyse addExtra) cagrilir.
  const [companionDraft, setCompanionDraft] = useState({
    firstName: '',
    lastName: '',
    idNumber: '',
    phone: '',
    extraCharge: 0,
    isChild: false,
  });
  const [companionsStaged, setCompanionsStaged] = useState<
    Array<{ firstName: string; lastName: string; idNumber: string; phone: string; extraCharge: number; isChild: boolean }>
  >([]);
  // Mevcut (olusturulmus) rezervasyon detayindan misafir eklemek icin
  const [detailCompanionDraft, setDetailCompanionDraft] = useState({
    firstName: '',
    lastName: '',
    idNumber: '',
    phone: '',
    extraCharge: 0,
    isChild: false,
  });

  const list = useMemo(() => {
    return state.reservations
      .filter((r) => !r.deletedAt)
      .filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (!q) return true;
        const g = state.guests.find((x) => x.id === r.guestId);
        const room = state.rooms.find((x) => x.id === r.roomId);
        const s = q.toLowerCase();
        return (
          r.code.toLowerCase().includes(s) ||
          g?.firstName.toLowerCase().includes(s) ||
          g?.lastName.toLowerCase().includes(s) ||
          room?.number.includes(s)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state, q, statusFilter]);

  const availableRooms = getAvailableRooms(form.checkIn, form.checkOut, detail?.id, form.checkInTime, form.checkOutTime);

  const guestSuggestions = useMemo(() => {
    if (matchedGuestId) return [];
    const fn = form.firstName.trim().toLowerCase();
    const ln = form.lastName.trim().toLowerCase();
    const id = form.idNumber.trim();
    const ph = form.phone.trim();
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
  }, [state.guests, form.firstName, form.lastName, form.idNumber, form.phone, matchedGuestId]);

  const matchedGuest = matchedGuestId ? state.guests.find((g) => g.id === matchedGuestId) : undefined;

  const openCreate = () => {
    setError('');
    setMatchedGuestId('');
    setBlacklistAck(false);
    setForm({
      roomId: '',
      checkIn: todayISO(),
      checkOut: addDays(todayISO(), 2),
      checkInTime: '',
      checkOutTime: '11:00',
      adults: 2,
      children: 0,
      status: 'confirmed',
      nightlyRate: 0,
      discount: 0,
      taxRate: state.settings.taxRate,
      deposit: 0,
      depositMethod: 'cash',
      notes: '',
      source: 'Doğrudan',
      specialRequests: '',
      firstName: '',
      lastName: '',
      idNumber: '',
      phone: '',
    });
    setCompanionsStaged([]);
    setCompanionDraft({ firstName: '', lastName: '', idNumber: '', phone: '', extraCharge: 0, isChild: false });
    setOpen(true);
  };

  // Oda seçildiğinde fiyat artık OTOMATIK doldurulmuyor — personel
  // gecelik fiyatı kendisi girsin diye bilinçli olarak bırakıldı. Otomatik
  // doldurma, personelin yanlış/eski fiyatı fark etmeden onaylamasına
  // (dolayısıyla hataya) sebep oluyordu. Oda değiştirildiğinde de eski
  // odanın fiyatı yanlışlıkla kalmasın diye kutu sıfırlanır.
  const onRoomPick = (roomId: string) => {
    setForm((f) => ({ ...f, roomId, nightlyRate: 0 }));
  };

  const save = () => {
    setError('');
    if (!form.firstName || !form.lastName) {
      setError('Misafir adı soyadı gerekli');
      return;
    }
    const matched = matchedGuestId ? state.guests.find((g) => g.id === matchedGuestId) : undefined;
    if (matched?.blacklisted && !blacklistAck) {
      setError('Bu misafir KARA LİSTEDE. Devam etmek için uyarıyı onaylayın.');
      return;
    }
    let guestId = matchedGuestId;
    if (!guestId) {
      guestId = addGuest({
        firstName: form.firstName,
        lastName: form.lastName,
        email: '',
        phone: form.phone,
        idNumber: form.idNumber,
        nationality: 'TR',
        address: '',
        notes: '',
        vip: false,
      });
    }
    if (!guestId || !form.roomId) {
      setError('Misafir ve oda seçimi zorunlu');
      return;
    }
    if (form.checkOut < form.checkIn) {
      setError('Çıkış tarihi giriş tarihinden önce olamaz');
      return;
    }
    const result = addReservation({
      guestId,
      roomId: form.roomId,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      checkInTime: form.checkInTime || undefined,
      checkOutTime: form.checkOutTime || '11:00',
      adults: form.adults,
      children: form.children,
      status: form.status,
      nightlyRate: form.nightlyRate,
      discount: form.discount,
      taxRate: form.taxRate,
      deposit: form.deposit,
      notes: form.notes,
      source: form.source,
      specialRequests: form.specialRequests,
    });
    if (typeof result === 'object' && 'error' in result) {
      setError(result.error);
      return;
    }
    if (form.deposit > 0 && typeof result === 'string') {
      addPayment({
        reservationId: result,
        amount: form.deposit,
        method: form.depositMethod,
        date: todayISO(),
        note: 'Depozito / ön ödeme',
        receivedBy: currentUser?.name ?? 'Sistem',
      });
    }
    // Formda eklenen ek misafirleri, rezervasyon olusturulduktan sonra
    // odaya ekle — her biri Misafirler sayfasinda da otomatik gorunur
    // (addCompanion zaten yeni Guest kaydi olusturuyor). Ucretli
    // eklenmisse, mevcut ve kanitlanmis Ekstra mekanizmasi uzerinden
    // fatura/muhasebe/raporlara otomatik islensin diye addExtra cagrilir.
    if (typeof result === 'string' && companionsStaged.length > 0) {
      companionsStaged.forEach((c) => {
        addCompanion(result, {
          newGuest: {
            firstName: c.firstName,
            lastName: c.lastName,
            email: '',
            phone: c.phone,
            idNumber: c.idNumber,
            nationality: 'TR',
            address: '',
            notes: '',
            vip: false,
          },
          isExtra: true,
          isChild: c.isChild,
        });
        if (c.extraCharge > 0) {
          addExtra(result, {
            name: `Ek misafir ücreti: ${c.firstName} ${c.lastName}`,
            amount: c.extraCharge,
            quantity: 1,
            date: todayISO(),
            category: 'Ekstra Misafir',
          });
        }
      });
    }
    setOpen(false);
  };

  const exportCSV = () => {
    downloadCSV(
      `rezervasyonlar-${todayISO()}.csv`,
      list.map((r) => {
        const g = state.guests.find((x) => x.id === r.guestId);
        const room = state.rooms.find((x) => x.id === r.roomId);
        return {
          Kod: r.code,
          Misafir: `${g?.firstName ?? ''} ${g?.lastName ?? ''}`,
          TC_Pasaport: g?.idNumber ?? '',
          Telefon: g?.phone ?? '',
          Oda: room?.number ?? '',
          Giris: r.checkIn,
          GirisSaati: r.checkInTime ?? '',
          Cikis: r.checkOut,
          CikisSaati: r.checkOutTime || '11:00',
          Gece: nightsOf(r),
          Durum: RES_STATUS_LABELS[r.status],
          Odeme: PAY_STATUS_LABELS[r.paymentStatus],
          Toplam: grandTotal(r),
          Bakiye: balanceDue(r, state.payments),
          Kaynak: r.source,
        };
      })
    );
  };

  const refreshDetail = (id: string) => {
    const r = state.reservations.find((x) => x.id === id);
    if (r) setDetail(r);
  };

  // Keep detail in sync
  const liveDetail = detail ? state.reservations.find((r) => r.id === detail.id) ?? null : null;

  // Baska bir rezervasyona gecince acik kalan duzenleme formlari
  // (misafir/odeme) yanlislikla yanlis kayda uygulanmasin diye sifirlanir.
  useEffect(() => {
    setGuestEditOpen(false);
    setEditingPaymentId(null);
  }, [detail?.id]);

  return (
    <div>
      <PageHeader
        title="Rezervasyonlar"
        subtitle="Oluştur, düzenle, takip et — tüm rezervasyon yaşam döngüsü"
        actions={
          <>
            <Button variant="outline" onClick={exportCSV}>
              <Download size={16} /> CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} /> Yeni Rezervasyon
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kod, misafir, oda ara..."
              className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48">
            <option value="all">Tüm durumlar</option>
            {Object.entries(RES_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState title="Rezervasyon yok" desc="Yeni rezervasyon oluşturun." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Kod</th>
                  <th className="px-4 py-3 font-medium">Misafir</th>
                  <th className="px-4 py-3 font-medium">Oda</th>
                  <th className="px-4 py-3 font-medium">Tarihler</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
                  <th className="px-4 py-3 font-medium">Ödeme</th>
                  <th className="px-4 py-3 font-medium text-right">Toplam</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => {
                  const g = state.guests.find((x) => x.id === r.guestId);
                  const room = state.rooms.find((x) => x.id === r.roomId);
                  return (
                    <tr key={r.id} className="hover:bg-teal-50/30">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-teal-800">{r.code}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{g?.firstName} {g?.lastName}</p>
                        <p className="text-xs text-slate-400">{r.source}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{room?.number}</p>
                        <p className="text-xs text-slate-400">{room ? ROOM_TYPE_LABELS[room.type] : ''}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <p>{formatDate(r.checkIn)}{r.checkInTime ? ` ${r.checkInTime}` : ''} → {formatDate(r.checkOut)} {r.checkOutTime || '11:00'}</p>
                        <p className="text-slate-400">{nightsOf(r)} gece</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={statusColor(r.status)}>{RES_STATUS_LABELS[r.status]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={statusColor(r.paymentStatus)}>{PAY_STATUS_LABELS[r.paymentStatus]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold">{formatCurrency(grandTotal(r))}</p>
                        <p className="text-[11px] text-slate-400">{paymentMethodSummary(state.payments, r.id)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setDetail(r)}
                            title="Görüntüle"
                            className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-teal-700"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => setDetail(r)}
                            title="Düzenle"
                            className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-teal-700"
                          >
                            <Pencil size={16} />
                          </button>
                          {!['cancelled', 'checked_out'].includes(r.status) && (
                            <button
                              onClick={() => {
                                if (confirm('Rezervasyonu iptal et?')) cancelReservation(r.id);
                              }}
                              title="İptal Et"
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`${r.code} kodlu rezervasyon silinsin mi? (Arşive alınır, geri getirilebilir)`)) {
                                deleteReservation(r.id);
                              }
                            }}
                            title="Sil"
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Yeni Rezervasyon" wide>
        <div className="space-y-4">
          {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Input
                label="Ad"
                value={form.firstName}
                onChange={(e) => {
                  setMatchedGuestId('');
                  setBlacklistAck(false);
                  setForm({ ...form, firstName: e.target.value });
                }}
              />
            </div>
            <Input
              label="Soyad"
              value={form.lastName}
              onChange={(e) => {
                setMatchedGuestId('');
                setBlacklistAck(false);
                setForm({ ...form, lastName: e.target.value });
              }}
            />
            <Input
              label="TC / Pasaport No"
              value={form.idNumber}
              onChange={(e) => {
                setMatchedGuestId('');
                setBlacklistAck(false);
                setForm({ ...form, idNumber: e.target.value });
              }}
            />
            <Input
              label="Telefon"
              value={form.phone}
              onChange={(e) => {
                setMatchedGuestId('');
                setBlacklistAck(false);
                setForm({ ...form, phone: e.target.value });
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
                      setForm({
                        ...form,
                        firstName: g.firstName,
                        lastName: g.lastName,
                        idNumber: g.idNumber,
                        phone: g.phone,
                      });
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Giriş" type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value, roomId: '' })} />
            <Input label="Çıkış" type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value, roomId: '' })} />
            <Input label="Giriş Saati (opsiyonel)" type="time" value={form.checkInTime} onChange={(e) => setForm({ ...form, checkInTime: e.target.value })} />
            <Input label="Çıkış Saati" type="time" value={form.checkOutTime} onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })} />
            <Select label="Oda (müsait)" value={form.roomId} onChange={(e) => onRoomPick(e.target.value)}>
              <option value="">Seçin... ({availableRooms.length} müsait)</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} — {ROOM_TYPE_LABELS[r.type]} — {formatCurrency(r.pricePerNight)}
                </option>
              ))}
            </Select>
            <div>
              <Input label="Gecelik Fiyat" type="number" value={form.nightlyRate} onChange={(e) => setForm({ ...form, nightlyRate: +e.target.value })} />
              {form.roomId && (
                <p className="mt-1 text-xs text-slate-400">
                  Odanın standart fiyatı: {formatCurrency(state.rooms.find((r) => r.id === form.roomId)?.pricePerNight ?? 0)} — gerekirse farklı fiyat girebilirsin
                </p>
              )}
            </div>
            <Input label="Yetişkin" type="number" min={1} value={form.adults} onChange={(e) => setForm({ ...form, adults: +e.target.value })} />
            <Input label="Çocuk" type="number" min={0} value={form.children} onChange={(e) => setForm({ ...form, children: +e.target.value })} />
            <Select label="Kaynak" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {['Doğrudan', 'Telefon', 'Booking.com', 'Expedia', 'Hotels.com', 'Walk-in', 'Diğer'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Input label="Depozito (₺)" type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: +e.target.value })} />
            {form.deposit > 0 && (
              <Select
                label="Depozito Ödeme Yöntemi"
                value={form.depositMethod}
                onChange={(e) => setForm({ ...form, depositMethod: e.target.value as typeof form.depositMethod })}
              >
                {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            )}
            <Textarea label="Notlar" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="sm:col-span-2" />
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="mb-3 font-semibold">Ek Misafirler (opsiyonel)</p>
            {companionsStaged.length > 0 && (
              <div className="mb-3 space-y-2">
                {companionsStaged.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span>
                      {c.firstName} {c.lastName}
                      {c.isChild && <span className="ml-1 text-xs text-slate-400">(çocuk)</span>}
                      {c.idNumber && <span className="ml-1 text-xs text-slate-400">· {c.idNumber}</span>}
                      {c.phone && <span className="ml-1 text-xs text-slate-400">· {c.phone}</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      {c.extraCharge > 0 && <span className="font-medium text-teal-700">{formatCurrency(c.extraCharge)}</span>}
                      <button
                        type="button"
                        onClick={() => setCompanionsStaged((arr) => arr.filter((_, idx) => idx !== i))}
                        className="text-rose-500 text-xs"
                      >
                        Kaldır
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Input placeholder="Ad" value={companionDraft.firstName} onChange={(e) => setCompanionDraft({ ...companionDraft, firstName: e.target.value })} />
              <Input placeholder="Soyad" value={companionDraft.lastName} onChange={(e) => setCompanionDraft({ ...companionDraft, lastName: e.target.value })} />
              <Input placeholder="TC / Pasaport" value={companionDraft.idNumber} onChange={(e) => setCompanionDraft({ ...companionDraft, idNumber: e.target.value })} />
              <Input placeholder="Telefon" value={companionDraft.phone} onChange={(e) => setCompanionDraft({ ...companionDraft, phone: e.target.value })} />
              <Input
                type="number"
                placeholder="Ekstra Ücret (₺)"
                value={companionDraft.extraCharge || ''}
                onChange={(e) => setCompanionDraft({ ...companionDraft, extraCharge: +e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={companionDraft.isChild}
                  onChange={(e) => setCompanionDraft({ ...companionDraft, isChild: e.target.checked })}
                />
                Çocuk
              </label>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => {
                if (!companionDraft.firstName || !companionDraft.lastName) return;
                setCompanionsStaged((arr) => [...arr, companionDraft]);
                setCompanionDraft({ firstName: '', lastName: '', idNumber: '', phone: '', extraCharge: 0, isChild: false });
              }}
            >
              <Plus size={14} /> Misafir Ekle
            </Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={save}>Rezervasyon Oluştur</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!liveDetail} onClose={() => setDetail(null)} title={liveDetail ? liveDetail.code : ''} wide>
        {liveDetail && (() => {
          const r = liveDetail;
          const g = state.guests.find((x) => x.id === r.guestId);
          const room = state.rooms.find((x) => x.id === r.roomId);
          const bal = balanceDue(r, state.payments);
          const pays = state.payments.filter((p) => p.reservationId === r.id && !p.deletedAt);
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Badge color={statusColor(r.status)}>{RES_STATUS_LABELS[r.status]}</Badge>
                  <Badge color={statusColor(r.paymentStatus)}>{PAY_STATUS_LABELS[r.paymentStatus]}</Badge>
                  <Badge color="slate">{r.source}</Badge>
                </div>
                <div className="flex gap-2">
                  {!['cancelled', 'checked_out'].includes(r.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Rezervasyonu iptal et?')) cancelReservation(r.id);
                      }}
                    >
                      <XCircle size={13} /> İptal Et
                    </Button>
                  )}
                  {r.status === 'checked_out' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Çıkış iptal edilsin mi? Misafir konaklamaya devam edecek.')) {
                          const err = undoCheckOut(r.id);
                          if (err) alert(err);
                        }
                      }}
                    >
                      <RotateCcw size={13} /> Çıkışı İptal Et
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`${r.code} kodlu rezervasyon silinsin mi? (Arşive alınır, geri getirilebilir)`)) {
                        deleteReservation(r.id);
                        setDetail(null);
                      }
                    }}
                  >
                    <Trash2 size={13} className="text-rose-600" /> Sil
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase text-slate-400">Misafir</p>
                    {!guestEditOpen && (
                      <button
                        onClick={() => {
                          setGuestEditForm({
                            firstName: g?.firstName || '',
                            lastName: g?.lastName || '',
                            idNumber: g?.idNumber || '',
                            phone: g?.phone || '',
                            email: g?.email || '',
                          });
                          setGuestEditOpen(true);
                        }}
                        className="text-xs font-medium text-teal-700 hover:underline"
                      >
                        Düzenle
                      </button>
                    )}
                  </div>
                  {guestEditOpen ? (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Ad" value={guestEditForm.firstName} onChange={(e) => setGuestEditForm({ ...guestEditForm, firstName: e.target.value })} />
                        <Input placeholder="Soyad" value={guestEditForm.lastName} onChange={(e) => setGuestEditForm({ ...guestEditForm, lastName: e.target.value })} />
                        <Input placeholder="TC / Pasaport" value={guestEditForm.idNumber} onChange={(e) => setGuestEditForm({ ...guestEditForm, idNumber: e.target.value })} />
                        <Input placeholder="Telefon" value={guestEditForm.phone} onChange={(e) => setGuestEditForm({ ...guestEditForm, phone: e.target.value })} />
                        <Input placeholder="E-posta" value={guestEditForm.email} onChange={(e) => setGuestEditForm({ ...guestEditForm, email: e.target.value })} className="col-span-2" />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!g) return;
                            updateGuest(g.id, {
                              firstName: guestEditForm.firstName,
                              lastName: guestEditForm.lastName,
                              idNumber: guestEditForm.idNumber,
                              phone: guestEditForm.phone,
                              email: guestEditForm.email,
                            });
                            setGuestEditOpen(false);
                          }}
                        >
                          Kaydet
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setGuestEditOpen(false)}>
                          Vazgeç
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 font-semibold">{g?.firstName} {g?.lastName} {g?.vip && '★'}</p>
                      <p className="text-sm text-slate-500">{g?.idNumber || <span className="italic text-slate-400">TC/Pasaport girilmedi</span>}</p>
                      <p className="text-sm text-slate-500">{g?.phone || <span className="italic text-slate-400">Telefon girilmedi</span>}</p>
                    </>
                  )}
                  {g?.phone && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={buildReviewWhatsAppLink(g.phone, g.firstName)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-fit items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <MessageCircle size={13} /> Değerlendirme iste
                      </a>
                      <a
                        href={buildMenuWhatsAppLink(g.phone, g.firstName, `${window.location.origin}/order/${r.id}`)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-fit items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                      >
                        <MessageCircle size={13} /> Menü linki gönder
                      </a>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">Konaklama</p>
                  <p className="mt-1 font-semibold">Oda {room?.number} · {room && ROOM_TYPE_LABELS[room.type]}</p>
                  {!['cancelled', 'checked_out'].includes(r.status) ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Input
                        label="Giriş"
                        type="date"
                        value={r.checkIn}
                        onChange={(e) => {
                          const err = updateReservation(r.id, { checkIn: e.target.value });
                          if (err && 'error' in err) alert(err.error);
                          refreshDetail(r.id);
                        }}
                      />
                      <Input
                        label="Çıkış"
                        type="date"
                        value={r.checkOut}
                        onChange={(e) => {
                          const err = updateReservation(r.id, { checkOut: e.target.value });
                          if (err && 'error' in err) alert(err.error);
                          refreshDetail(r.id);
                        }}
                      />
                      <Input
                        label="Giriş Saati"
                        type="time"
                        value={r.checkInTime || ''}
                        onChange={(e) => {
                          updateReservation(r.id, { checkInTime: e.target.value || undefined });
                          refreshDetail(r.id);
                        }}
                      />
                      <Input
                        label="Çıkış Saati"
                        type="time"
                        value={r.checkOutTime || '11:00'}
                        onChange={(e) => {
                          updateReservation(r.id, { checkOutTime: e.target.value || '11:00' });
                          refreshDetail(r.id);
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">{formatDate(r.checkIn)} → {formatDate(r.checkOut)} ({nightsOf(r)} gece)</p>
                  )}
                  <p className="text-sm text-slate-500 mt-1">{r.adults} yetişkin, {r.children} çocuk</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="mb-3 font-semibold">Odadaki Misafirler</p>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between rounded-xl bg-teal-50 px-3 py-2 text-sm">
                    <span className="font-medium">
                      {g?.firstName} {g?.lastName} <span className="text-xs font-normal text-teal-700">(Ana misafir)</span>
                    </span>
                    <span className="text-xs text-slate-400">Rezervasyon: {formatDateTime(r.createdAt)}</span>
                  </div>
                  {(r.companions || []).map((c) => {
                    const cg = state.guests.find((x) => x.id === c.guestId);
                    return (
                      <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{cg?.firstName} {cg?.lastName}</span>
                          {c.isChild && <span className="ml-1 text-xs text-slate-400">(çocuk)</span>}
                          <p className="text-xs text-slate-400">
                            {cg?.idNumber}{cg?.idNumber && cg?.phone ? ' · ' : ''}{cg?.phone}{(cg?.idNumber || cg?.phone) ? ' · ' : ''}Eklendi: {formatDateTime(c.addedAt)}
                          </p>
                        </div>
                        {!['cancelled', 'checked_out'].includes(r.status) && (
                          <button
                            onClick={() => removeCompanion(r.id, c.id)}
                            className="text-rose-500 text-xs"
                          >
                            Çıkar
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {(r.companions || []).length === 0 && <p className="text-sm text-slate-400">Ek misafir yok</p>}
                </div>
                {!['cancelled', 'checked_out'].includes(r.status) && (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Input placeholder="Ad" value={detailCompanionDraft.firstName} onChange={(e) => setDetailCompanionDraft({ ...detailCompanionDraft, firstName: e.target.value })} />
                      <Input placeholder="Soyad" value={detailCompanionDraft.lastName} onChange={(e) => setDetailCompanionDraft({ ...detailCompanionDraft, lastName: e.target.value })} />
                      <Input placeholder="TC / Pasaport" value={detailCompanionDraft.idNumber} onChange={(e) => setDetailCompanionDraft({ ...detailCompanionDraft, idNumber: e.target.value })} />
                      <Input placeholder="Telefon" value={detailCompanionDraft.phone} onChange={(e) => setDetailCompanionDraft({ ...detailCompanionDraft, phone: e.target.value })} />
                      <Input
                        type="number"
                        placeholder="Ekstra Ücret (₺)"
                        value={detailCompanionDraft.extraCharge || ''}
                        onChange={(e) => setDetailCompanionDraft({ ...detailCompanionDraft, extraCharge: +e.target.value })}
                      />
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={detailCompanionDraft.isChild}
                          onChange={(e) => setDetailCompanionDraft({ ...detailCompanionDraft, isChild: e.target.checked })}
                        />
                        Çocuk
                      </label>
                    </div>
                    <Button
                      size="md"
                      className="mt-2"
                      onClick={() => {
                        if (!detailCompanionDraft.firstName || !detailCompanionDraft.lastName) return;
                        const cRes = addCompanion(r.id, {
                          newGuest: {
                            firstName: detailCompanionDraft.firstName,
                            lastName: detailCompanionDraft.lastName,
                            email: '',
                            phone: detailCompanionDraft.phone,
                            idNumber: detailCompanionDraft.idNumber,
                            nationality: 'TR',
                            address: '',
                            notes: '',
                            vip: false,
                          },
                          isExtra: true,
                          isChild: detailCompanionDraft.isChild,
                        });
                        if (typeof cRes === 'string' && detailCompanionDraft.extraCharge > 0) {
                          addExtra(r.id, {
                            name: `Ek misafir ücreti: ${detailCompanionDraft.firstName} ${detailCompanionDraft.lastName}`,
                            amount: detailCompanionDraft.extraCharge,
                            quantity: 1,
                            date: todayISO(),
                            category: 'Ekstra Misafir',
                          });
                        }
                        setDetailCompanionDraft({ firstName: '', lastName: '', idNumber: '', phone: '', extraCharge: 0, isChild: false });
                        refreshDetail(r.id);
                      }}
                    >
                      <Plus size={14} /> Misafir Ekle
                    </Button>
                  </>
                )}
              </div>

              {!['cancelled', 'checked_out'].includes(r.status) && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select
                    label="Durum"
                    value={r.status}
                    onChange={(e) => {
                      updateReservation(r.id, { status: e.target.value as ReservationStatus });
                      refreshDetail(r.id);
                    }}
                  >
                    {Object.entries(RES_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                  <Select
                    label="Oda Değiştir"
                    value={r.roomId}
                    onChange={(e) => {
                      const roomId = e.target.value;
                      if (roomId === r.roomId) return;
                      const oldRoomId = r.roomId;
                      // ONEMLI: fiyat artık otomatik doldurulmuyor — oda
                      // değiştikten sonra personel gecelik fiyatı "Gecelik
                      // Fiyat" kutusundan kendisi girmeli. Eski odanın fiyatı
                      // yanlışlıkla kalmasın diye 0'a sıfırlanır.
                      const err = updateReservation(r.id, { roomId, nightlyRate: 0 });
                      if (err && 'error' in err) {
                        alert(err.error);
                        refreshDetail(r.id);
                        return;
                      }
                      const markDirty = window.confirm(
                        'Oda değiştirildi. Eski oda (temizlik için) "Kirli" olarak işaretlensin mi?'
                      );
                      if (markDirty) {
                        updateRoom(oldRoomId, { housekeeping: 'dirty', status: 'cleaning' });
                      }
                      refreshDetail(r.id);
                    }}
                  >
                    {getAvailableRooms(r.checkIn, r.checkOut, r.id, r.checkInTime, r.checkOutTime).concat(
                      state.rooms.filter((x) => x.id === r.roomId)
                    ).filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i).map((rm) => (
                      <option key={rm.id} value={rm.id}>{rm.number} — {ROOM_TYPE_LABELS[rm.type]}</option>
                    ))}
                  </Select>
                  <div>
                    <Input
                      label="Gecelik Fiyat"
                      type="number"
                      value={r.nightlyRate}
                      onChange={(e) => updateReservation(r.id, { nightlyRate: +e.target.value })}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Odanın standart fiyatı: {formatCurrency(room?.pricePerNight ?? 0)}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="mb-3 font-semibold">Fatura Özeti</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span>Oda ({nightsOf(r)} × {formatCurrency(r.nightlyRate)})</span><span>{formatCurrency(roomSubtotal(r))}</span></div>
                  <div className="flex justify-between"><span>Ekstralar</span><span>{formatCurrency(extrasTotal(r.extras))}</span></div>
                  <div className="flex justify-between text-rose-600"><span>İndirim</span><span>-{formatCurrency(r.discount)}</span></div>
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold"><span>Toplam</span><span>{formatCurrency(grandTotal(r))}</span></div>
                  <div className="flex justify-between text-emerald-700"><span>Ödenen ({paymentMethodSummary(state.payments, r.id)})</span><span>{formatCurrency(paidTotal(state.payments, r.id))}</span></div>
                  <div className={`flex justify-between font-semibold ${balanceDue(r, state.payments) > 0 ? 'text-rose-600' : 'text-emerald-700'}`}><span>Kalan Bakiye</span><span>{formatCurrency(balanceDue(r, state.payments))}</span></div>
                  <div className="flex justify-between text-teal-700"><span>Kalan Bakiye</span><span className="font-semibold">{formatCurrency(bal)}</span></div>
                </div>
              </div>

              <div>
                <p className="mb-2 font-semibold">Ekstralar</p>
                <div className="space-y-2 mb-3">
                  {r.extras.map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span>{ex.name} × {ex.quantity} <span className="text-slate-400">({ex.category})</span></span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(ex.amount * ex.quantity)}</span>
                        <button onClick={() => removeExtra(r.id, ex.id)} className="text-rose-500 text-xs">Sil</button>
                      </div>
                    </div>
                  ))}
                  {r.extras.length === 0 && <p className="text-sm text-slate-400">Ekstra yok</p>}
                </div>
                {!['cancelled', 'checked_out'].includes(r.status) && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Input placeholder="Ad" value={extraForm.name} onChange={(e) => setExtraForm({ ...extraForm, name: e.target.value })} />
                    <Input type="number" placeholder="Tutar" value={extraForm.amount || ''} onChange={(e) => setExtraForm({ ...extraForm, amount: +e.target.value })} />
                    <Input type="number" placeholder="Adet" value={extraForm.quantity} onChange={(e) => setExtraForm({ ...extraForm, quantity: +e.target.value })} />
                    <Select value={extraForm.category} onChange={(e) => setExtraForm({ ...extraForm, category: e.target.value })}>
                      {['F&B', 'Spa', 'Hizmet', 'Transfer', 'Diğer'].map((c) => <option key={c}>{c}</option>)}
                    </Select>
                    <Button
                      size="md"
                      onClick={() => {
                        if (!extraForm.name || !extraForm.amount) return;
                        addExtra(r.id, { ...extraForm, date: todayISO() });
                        setExtraForm({ name: '', amount: 0, quantity: 1, category: 'F&B' });
                      }}
                    >
                      Ekle
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 font-semibold">Ödemeler</p>
                <div className="space-y-2 mb-3">
                  {pays.map((p) => (
                    <div key={p.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      {editingPaymentId === p.id ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Input
                            type="number"
                            value={paymentEditForm.amount || ''}
                            onChange={(e) => setPaymentEditForm({ ...paymentEditForm, amount: +e.target.value })}
                          />
                          <Select
                            value={paymentEditForm.method}
                            onChange={(e) => setPaymentEditForm({ ...paymentEditForm, method: e.target.value as typeof paymentEditForm.method })}
                          >
                            <option value="cash">Nakit</option>
                            <option value="card">Kart</option>
                            <option value="transfer">Havale</option>
                            <option value="online">Online</option>
                          </Select>
                          <Input
                            placeholder="Not"
                            value={paymentEditForm.note}
                            onChange={(e) => setPaymentEditForm({ ...paymentEditForm, note: e.target.value })}
                          />
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => {
                                updatePayment(p.id, {
                                  amount: paymentEditForm.amount,
                                  method: paymentEditForm.method,
                                  note: paymentEditForm.note,
                                });
                                setEditingPaymentId(null);
                                refreshDetail(r.id);
                              }}
                            >
                              Kaydet
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingPaymentId(null)}>
                              Vazgeç
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span>{p.date} · {PAY_METHOD_LABELS[p.method] || p.method} · {p.note}</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${p.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatCurrency(p.amount)}</span>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingPaymentId(p.id);
                                    setPaymentEditForm({ amount: p.amount, method: p.method, note: p.note || '' });
                                  }}
                                  className="text-xs text-slate-500 hover:text-teal-700"
                                >
                                  Düzenle
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`${formatCurrency(p.amount)} tutarındaki ödeme iptal edilsin mi? Bakiye ve muhasebe otomatik güncellenir.`)) {
                                      deletePayment(p.id);
                                      refreshDetail(r.id);
                                    }
                                  }}
                                  className="text-xs text-rose-500 hover:text-rose-700"
                                >
                                  İptal Et
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {pays.length === 0 && <p className="text-sm text-slate-400">Ödeme yok</p>}
                </div>
                {!['cancelled'].includes(r.status) && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Input type="number" placeholder="Tutar" value={payForm.amount || ''} onChange={(e) => setPayForm({ ...payForm, amount: +e.target.value })} />
                    <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value as typeof payForm.method })}>
                      <option value="cash">Nakit</option>
                      <option value="card">Kart</option>
                      <option value="transfer">Havale</option>
                      <option value="online">Online</option>
                    </Select>
                    <Input placeholder="Not" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
                    <Button
                      onClick={() => {
                        if (!payForm.amount) return;
                        addPayment({
                          reservationId: r.id,
                          amount: payForm.amount,
                          method: payForm.method,
                          date: todayISO(),
                          note: payForm.note || 'Ödeme',
                          receivedBy: currentUser?.name ?? 'Sistem',
                        });
                        setPayForm({ amount: 0, method: 'cash', note: '' });
                      }}
                    >
                      Tahsil Et
                    </Button>
                  </div>
                )}
              </div>

              {(r.notes || r.specialRequests) && (
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  {r.specialRequests && <p><strong>Özel istek:</strong> {r.specialRequests}</p>}
                  {r.notes && <p className="mt-1"><strong>Not:</strong> {r.notes}</p>}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
