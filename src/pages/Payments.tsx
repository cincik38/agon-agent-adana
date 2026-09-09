import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Plus, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { useStore } from '../lib/store';
import type { PaymentMethod } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
} from '../components/ui';
import {
  downloadCSV,
  formatCurrency,
  formatDate,
  PAY_METHOD_LABELS,
  todayISO,
  hotelDayRange,
  currentHotelDayAnchor,
  capStampAtNow,
  entryStamp,
  entryTime,
  addDays,
} from '../lib/utils';
import { Wallet, TrendingUp, CreditCard } from 'lucide-react';

export default function Payments() {
  const { state, addPayment, updatePayment, deletePayment, currentUser, isAdmin } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'range' | 'hotelDay'>('hotelDay');
  const [rangeFrom, setRangeFrom] = useState(todayISO());
  const [rangeTo, setRangeTo] = useState(todayISO());
  const [hotelDayAnchor, setHotelDayAnchor] = useState(currentHotelDayAnchor());
  const [form, setForm] = useState({
    reservationId: '',
    amount: 0,
    method: 'cash' as PaymentMethod,
    note: '',
    date: todayISO(),
  });

  const payments = useMemo(() => {
    return state.payments
      .filter((p) => !p.deletedAt)
      .filter((p) => methodFilter === 'all' || p.method === methodFilter)
      .filter((p) => {
        if (dateFilter === 'hotelDay') {
          const { fromStamp, toStamp: rawToStamp } = hotelDayRange(hotelDayAnchor);
          const toStamp = capStampAtNow(rawToStamp);
          const ledgerEntry = (state.ledger || []).find((l) => l.paymentId === p.id);
          const stamp = ledgerEntry ? entryStamp(ledgerEntry) : `${p.date.slice(0, 10)}T12:00`;
          return stamp >= fromStamp && stamp < toStamp;
        }
        const d = p.date.slice(0, 10);
        if (dateFilter === 'today') return d === todayISO();
        if (dateFilter === 'range') return d >= rangeFrom && d <= rangeTo;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.payments, state.ledger, methodFilter, dateFilter, rangeFrom, rangeTo, hotelDayAnchor]);

  const stats = useMemo(() => {
    const income = payments.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
    const refunds = payments.filter((p) => p.amount < 0).reduce((s, p) => s + p.amount, 0);
    const today = payments.filter((p) => p.date === todayISO() || p.date.startsWith(todayISO()));
    const todayTotal = today.reduce((s, p) => s + Math.max(0, p.amount), 0);
    const byMethod: Record<string, number> = {};
    payments.forEach((p) => {
      if (p.amount > 0) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    });
    return { income, refunds, todayTotal, byMethod, count: payments.length };
  }, [payments]);

  // Ayni rezervasyon + tutar + yontem + tarih ile birden fazla odeme kaydi
  // varsa muhtemelen yanlislikla iki kez girilmis (cift tiklama vb.) —
  // Yonetici'ye bunu goruntuleyip inceleyebilecegi bir uyari gosterelim.
  const possibleDuplicates = useMemo(() => {
    const groups: Record<string, typeof payments> = {};
    payments.forEach((p) => {
      const key = `${p.reservationId}|${p.amount}|${p.method}|${p.date.slice(0, 10)}`;
      (groups[key] ||= []).push(p);
    });
    return Object.values(groups).filter((g) => g.length > 1).flat();
  }, [payments]);

  // Yinelenen gruplarda EN ESKI kayit haric hepsini siler (Yonetici,
  // tek tikla temizlik icin).
  const duplicatesToRemove = useMemo(() => {
    const groups: Record<string, typeof payments> = {};
    payments.forEach((p) => {
      const key = `${p.reservationId}|${p.amount}|${p.method}|${p.date.slice(0, 10)}`;
      (groups[key] ||= []).push(p);
    });
    return Object.values(groups)
      .filter((g) => g.length > 1)
      .flatMap((g) => g.slice(1)); // ilkini (en eskiyi) koru, gerisini sil
  }, [payments]);

  const paymentTime = (p: (typeof payments)[number]): string => {
    const entry = (state.ledger || []).find((l) => l.paymentId === p.id);
    return entry ? entryTime(entry) : '';
  };

  const activeRes = state.reservations.filter((r) => !r.deletedAt && !['cancelled'].includes(r.status));

  return (
    <div>
      <PageHeader
        title="Ödemeler & Kasa"
        subtitle="Misafirlerden alınan oda/ekstra tahsilatları — rezervasyon bazlı kasa hareketleri (genel gider/gelir için Finansal Muhasebe'yi kullanın)"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCSV(
                  `odemeler-${todayISO()}.csv`,
                  payments.map((p) => {
                    const r = state.reservations.find((x) => x.id === p.reservationId);
                    return {
                      Tarih: p.date,
                      Rezervasyon: r?.code ?? p.reservationId,
                      Tutar: p.amount,
                      Yontem: PAY_METHOD_LABELS[p.method],
                      Not: p.note,
                      Alan: p.receivedBy,
                    };
                  })
                )
              }
            >
              <Download size={16} /> CSV
            </Button>
            <Button onClick={() => { setEditId(null); setOpen(true); }}>
              <Plus size={16} /> Ödeme Kaydet
            </Button>
          </>
        }
      />

      {isAdmin && possibleDuplicates.length > 0 && (
        <Card className="mb-4 border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              ⚠️ {possibleDuplicates.length} adet olası yinelenen ödeme bulundu (aynı rezervasyon + tutar + yöntem +
              tarih ile birden fazla kayıt) — muhtemelen çift tıklama/çift girişten kaynaklanıyor. Sarı işaretli
              satırları kontrol edebilir ya da tek tıkla temizleyebilirsin (her grubun en eski kaydı korunur).
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (
                  confirm(
                    `${duplicatesToRemove.length} yinelenen ödeme kaydı silinecek (her grubun ilk/en eski kaydı korunacak). Devam edilsin mi?`
                  )
                ) {
                  duplicatesToRemove.forEach((p) => deletePayment(p.id));
                }
              }}
            >
              <Trash2 size={14} /> Yinelenenleri Temizle ({duplicatesToRemove.length})
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Toplam Tahsilat" value={formatCurrency(stats.income)} icon={<Wallet size={20} />} tone="emerald" />
        <StatCard label="Bugün" value={formatCurrency(stats.todayTotal)} icon={<TrendingUp size={20} />} tone="teal" />
        <StatCard label="İadeler" value={formatCurrency(stats.refunds)} icon={<CreditCard size={20} />} tone="rose" />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
          <Card key={k} className="p-3">
            <p className="text-xs text-slate-500">{v}</p>
            <p className="text-lg font-bold">{formatCurrency(stats.byMethod[k] || 0)}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="sm:w-48">
            <option value="all">Tüm yöntemler</option>
            {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setDateFilter('hotelDay'); setHotelDayAnchor(currentHotelDayAnchor()); }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                dateFilter === 'hotelDay' ? 'bg-teal-700 text-white' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100'
              }`}
              title="Otel gün dönümü: bir önceki günün 07:00'inden bugünün 07:00'ine kadar"
            >
              🌅 07:00–07:00 Gün Dönümü
            </button>
            {(['today', 'range', 'all'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  dateFilter === d ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {d === 'today' ? 'Bugün (takvim)' : d === 'range' ? 'Tarih Aralığı' : 'Tümü'}
              </button>
            ))}
          </div>
          {dateFilter === 'range' && (
            <>
              <Input label="Başlangıç" type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              <Input label="Bitiş" type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
            </>
          )}
        </div>

        {dateFilter === 'hotelDay' && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-amber-50/60 px-3 py-2">
            <span className="text-xs font-semibold text-amber-900">
              {formatDate(addDays(hotelDayAnchor, -1))} 07:00 →{' '}
              {hotelDayAnchor === currentHotelDayAnchor() ? 'Şimdi' : `${formatDate(hotelDayAnchor)} 07:00`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setHotelDayAnchor((d) => addDays(d, -1))}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                ← Önceki Gün
              </button>
              <button
                onClick={() => setHotelDayAnchor(currentHotelDayAnchor())}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                Bugün
              </button>
              <button
                onClick={() => setHotelDayAnchor((d) => addDays(d, 1))}
                disabled={hotelDayAnchor >= currentHotelDayAnchor()}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-40"
              >
                Sonraki Gün →
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {payments.length === 0 ? (
          <EmptyState title="Ödeme kaydı yok" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tarih / Saat</th>
                  <th className="px-4 py-3 font-medium">Rezervasyon</th>
                  <th className="px-4 py-3 font-medium">Oda</th>
                  <th className="px-4 py-3 font-medium">Yöntem</th>
                  <th className="px-4 py-3 font-medium">Not</th>
                  <th className="px-4 py-3 font-medium">Alan</th>
                  <th className="px-4 py-3 font-medium text-right">Tutar</th>
                  {isAdmin && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const r = state.reservations.find((x) => x.id === p.reservationId);
                  const g = state.guests.find((x) => x.id === r?.guestId);
                  const room = state.rooms.find((x) => x.id === r?.roomId);
                  const isDup = possibleDuplicates.some((d) => d.id === p.id);
                  return (
                    <tr key={p.id} className={isDup ? 'bg-amber-50 hover:bg-amber-100/70' : 'hover:bg-slate-50/80'}>
                      <td className="px-4 py-3">
                        <p>{formatDate(p.date)}{paymentTime(p) ? ` ${paymentTime(p)}` : ''}</p>
                        {isDup && <span title="Olası yinelenen ödeme" className="text-amber-600">⚠️ Yinelenen olabilir</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r ? (
                          <button
                            onClick={() => navigate(`/reservations?id=${r.id}`)}
                            className="flex items-center gap-1 font-mono text-xs font-semibold text-teal-800 hover:underline"
                          >
                            {r.code} <ExternalLink size={11} />
                          </button>
                        ) : (
                          <p className="font-mono text-xs font-semibold text-slate-400">—</p>
                        )}
                        <p className="text-xs text-slate-400">{g ? `${g.firstName} ${g.lastName}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{room?.number ?? '—'}</td>
                      <td className="px-4 py-3"><Badge>{PAY_METHOD_LABELS[p.method]}</Badge></td>
                      <td className="px-4 py-3 text-slate-500">{p.note}</td>
                      <td className="px-4 py-3 text-slate-500">{p.receivedBy}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${p.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {formatCurrency(p.amount)}
                      </td>
                      {isAdmin && (
                        <td className="px-2 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditId(p.id);
                                setForm({
                                  reservationId: p.reservationId,
                                  amount: p.amount,
                                  method: p.method,
                                  note: p.note || '',
                                  date: p.date.slice(0, 10),
                                });
                                setOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Bu ödeme silinsin mi?')) deletePayment(p.id);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Ödemeyi Düzenle' : 'Ödeme Kaydet'}>
        <div className="space-y-3">
          <Select label="Rezervasyon" value={form.reservationId} onChange={(e) => setForm({ ...form, reservationId: e.target.value })} disabled={!!editId}>
            <option value="">Seçin...</option>
            {activeRes.map((r) => {
              const g = state.guests.find((x) => x.id === r.guestId);
              return (
                <option key={r.id} value={r.id}>
                  {r.code} — {g?.firstName} {g?.lastName}
                </option>
              );
            })}
          </Select>
          <Input label="Tutar (₺) — iade için negatif girin" type="number" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: +e.target.value })} />
          <Select label="Yöntem" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
            {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Input label="Tarih" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Not" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button
              onClick={() => {
                if (!form.reservationId || !form.amount) return;
                if (editId) {
                  updatePayment(editId, {
                    amount: form.amount,
                    method: form.method,
                    date: form.date,
                    note: form.note,
                  });
                } else {
                  addPayment({
                    ...form,
                    receivedBy: currentUser?.name ?? 'Sistem',
                  });
                }
                setOpen(false);
                setEditId(null);
                setForm({ reservationId: '', amount: 0, method: 'cash', note: '', date: todayISO() });
              }}
            >
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
