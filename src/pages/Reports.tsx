import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ChevronDown, ChevronUp, Trash2, ExternalLink, ShieldAlert } from 'lucide-react';
import { useStore } from '../lib/store';
import { Button, Card, PageHeader, StatCard } from '../components/ui';
import { grandTotal, nightsOf } from '../lib/calculations';
import {
  addDays,
  downloadCSV,
  formatCurrency,
  formatDate,
  PAY_METHOD_LABELS,
  RES_STATUS_LABELS,
  ROOM_TYPE_LABELS,
  todayISO,
} from '../lib/utils';
import { BarChart3, BedDouble, Percent, Wallet } from 'lucide-react';

export default function Reports() {
  const { state, isManager, isAdmin, deletePayment, deleteReservation } = useStore();
  const navigate = useNavigate();
  const [from, setFrom] = useState(addDays(todayISO(), -30));
  const [to, setTo] = useState(todayISO());
  const [expanded, setExpanded] = useState<'revenue' | 'occupancy' | 'adr' | 'revpar' | null>(null);

  const report = useMemo(() => {
    const allRes = state.reservations.filter((r) => !r.deletedAt);
    const allPay = state.payments.filter((p) => !p.deletedAt);
    const allRooms = state.rooms.filter((r) => !r.deletedAt);

    const resInRange = allRes.filter(
      (r) => r.checkIn <= to && r.checkOut >= from && r.status !== 'cancelled'
    );
    const paymentsInRange = allPay.filter((p) => p.date >= from && p.date <= to);
    const revenue = paymentsInRange.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
    const refunds = paymentsInRange.filter((p) => p.amount < 0).reduce((s, p) => s + p.amount, 0);

    const checkedOut = resInRange.filter((r) => r.status === 'checked_out' || r.status === 'checked_in');
    const roomNights = checkedOut.reduce((s, r) => s + nightsOf(r), 0);
    const sellableRooms = allRooms.filter((r) => r.status !== 'out_of_order').length;
    const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
    const availableNights = sellableRooms * days;
    const occupancy = availableNights ? Math.round((roomNights / availableNights) * 1000) / 10 : 0;

    const adr =
      roomNights > 0
        ? Math.round(checkedOut.reduce((s, r) => s + r.nightlyRate * nightsOf(r), 0) / roomNights)
        : 0;
    const revpar = Math.round((adr * occupancy) / 100);

    const bySource: Record<string, number> = {};
    resInRange.forEach((r) => {
      bySource[r.source] = (bySource[r.source] || 0) + 1;
    });

    const byType: Record<string, { nights: number; revenue: number }> = {};
    checkedOut.forEach((r) => {
      const room = allRooms.find((x) => x.id === r.roomId);
      const type = room?.type ?? 'standard';
      if (!byType[type]) byType[type] = { nights: 0, revenue: 0 };
      byType[type].nights += nightsOf(r);
      byType[type].revenue += grandTotal(r);
    });

    const byStatus: Record<string, number> = {};
    allRes.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    // Daily revenue sparkline data
    const daily: { date: string; amount: number }[] = [];
    let d = from;
    while (d <= to) {
      const amount = allPay
        .filter((p) => p.date === d && p.amount > 0)
        .reduce((s, p) => s + p.amount, 0);
      daily.push({ date: d, amount });
      d = addDays(d, 1);
      if (daily.length > 90) break;
    }
    const maxDaily = Math.max(1, ...daily.map((x) => x.amount));

    return {
      revenue,
      refunds,
      roomNights,
      occupancy,
      adr,
      revpar,
      resCount: resInRange.length,
      bySource,
      byType,
      byStatus,
      daily,
      maxDaily,
      cancellations: allRes.filter(
        (r) => r.status === 'cancelled' && r.createdAt >= from && r.createdAt <= to
      ).length,
      // Kartlara tiklaninca altta gosterilecek ham veriler
      paymentsInRange,
      checkedOut,
    };
  }, [state, from, to]);

  if (!isManager) {
    return (
      <div>
        <PageHeader title="Raporlar & Analitik" subtitle="Yetkisiz erişim" />
        <Card className="mt-4 flex items-center gap-3 p-6 text-slate-600">
          <ShieldAlert className="text-rose-500" />
          <p>Bu sayfayı görüntülemek için Yönetici veya Müdür yetkisi gerekiyor.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Raporlar & Analitik"
        subtitle="Doluluk, gelir, ADR, RevPAR ve kanal performansı"
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCSV(`rapor-${from}-${to}.csv`, [
                {
                  Donem: `${from} - ${to}`,
                  Gelir: report.revenue,
                  Iadeler: report.refunds,
                  Doluluk: report.occupancy,
                  ADR: report.adr,
                  RevPAR: report.revpar,
                  OdaGecesi: report.roomNights,
                  Rezervasyon: report.resCount,
                  Iptal: report.cancellations,
                },
              ])
            }
          >
            <Download size={16} /> Rapor CSV
          </Button>
        }
      />

      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="block flex-1 space-y-1.5">
          <span className="text-xs font-medium text-slate-600">Başlangıç</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
        </label>
        <label className="block flex-1 space-y-1.5">
          <span className="text-xs font-medium text-slate-600">Bitiş</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setFrom(addDays(todayISO(), -7)); setTo(todayISO()); }}>7 gün</Button>
          <Button size="sm" variant="outline" onClick={() => { setFrom(addDays(todayISO(), -30)); setTo(todayISO()); }}>30 gün</Button>
          <Button size="sm" variant="outline" onClick={() => { setFrom(todayISO().slice(0, 8) + '01'); setTo(todayISO()); }}>Bu ay</Button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net Gelir"
          value={formatCurrency(report.revenue + report.refunds)}
          hint={`İade: ${formatCurrency(report.refunds)} · Detay için tıkla`}
          icon={<Wallet size={20} />}
          tone="emerald"
          onClick={() => setExpanded(expanded === 'revenue' ? null : 'revenue')}
        />
        <StatCard
          label="Doluluk"
          value={`${report.occupancy}%`}
          hint={`${report.roomNights} oda-gecesi · Detay için tıkla`}
          icon={<Percent size={20} />}
          tone="teal"
          onClick={() => setExpanded(expanded === 'occupancy' ? null : 'occupancy')}
        />
        <StatCard
          label="ADR"
          value={formatCurrency(report.adr)}
          hint="Ortalama günlük oda fiyatı · Detay için tıkla"
          icon={<BedDouble size={20} />}
          tone="blue"
          onClick={() => setExpanded(expanded === 'adr' ? null : 'adr')}
        />
        <StatCard
          label="RevPAR"
          value={formatCurrency(report.revpar)}
          hint="Oda başına gelir · Detay için tıkla"
          icon={<BarChart3 size={20} />}
          tone="violet"
          onClick={() => setExpanded(expanded === 'revpar' ? null : 'revpar')}
        />
      </div>

      {expanded && (
        <Card className="mt-4 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">
              {expanded === 'revenue' && 'Net Geliri Oluşturan Ödemeler'}
              {expanded === 'occupancy' && 'Dolulukta Sayılan Rezervasyonlar (oda-geceleri)'}
              {expanded === 'adr' && 'ADR Hesabına Giren Rezervasyonlar'}
              {expanded === 'revpar' && 'RevPAR Hesabına Giren Rezervasyonlar'}
            </h3>
            <button onClick={() => setExpanded(null)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700">
              Kapat <ChevronUp size={14} />
            </button>
          </div>

          {expanded === 'revenue' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Tarih</th>
                    <th className="px-3 py-2">Rezervasyon</th>
                    <th className="px-3 py-2">Yöntem</th>
                    <th className="px-3 py-2">Not</th>
                    <th className="px-3 py-2 text-right">Tutar</th>
                    {isAdmin && <th className="px-3 py-2"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.paymentsInRange.map((p) => {
                    const r = state.reservations.find((x) => x.id === p.reservationId);
                    const g = r ? state.guests.find((x) => x.id === r.guestId) : undefined;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2">{formatDate(p.date)}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => navigate(`/reservations?id=${p.reservationId}`)}
                            className="flex items-center gap-1 font-mono text-xs font-semibold text-teal-800 hover:underline"
                          >
                            {r?.code ?? '—'} <ExternalLink size={11} />
                          </button>
                          <p className="text-xs text-slate-400">{g ? `${g.firstName} ${g.lastName}` : ''}</p>
                        </td>
                        <td className="px-3 py-2">{PAY_METHOD_LABELS[p.method]}</td>
                        <td className="px-3 py-2 text-slate-500">{p.note}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${p.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {formatCurrency(p.amount)}
                        </td>
                        {isAdmin && (
                          <td className="px-2 py-2">
                            <button
                              onClick={() => {
                                if (confirm('Bu ödeme silinsin mi?')) deletePayment(p.id);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {report.paymentsInRange.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Bu aralıkta ödeme yok</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Rezervasyon</th>
                    <th className="px-3 py-2">Misafir</th>
                    <th className="px-3 py-2">Oda</th>
                    <th className="px-3 py-2">Tarihler</th>
                    <th className="px-3 py-2 text-right">Gece</th>
                    <th className="px-3 py-2 text-right">Gecelik</th>
                    <th className="px-3 py-2 text-right">Toplam</th>
                    {isManager && <th className="px-3 py-2"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.checkedOut.map((r) => {
                    const g = state.guests.find((x) => x.id === r.guestId);
                    const room = state.rooms.find((x) => x.id === r.roomId);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2">
                          <button
                            onClick={() => navigate(`/reservations?id=${r.id}`)}
                            className="flex items-center gap-1 font-mono text-xs font-semibold text-teal-800 hover:underline"
                          >
                            {r.code} <ExternalLink size={11} />
                          </button>
                        </td>
                        <td className="px-3 py-2">{g ? `${g.firstName} ${g.lastName}` : '—'}</td>
                        <td className="px-3 py-2">{room?.number ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{formatDate(r.checkIn)} → {formatDate(r.checkOut)}</td>
                        <td className="px-3 py-2 text-right">{nightsOf(r)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(r.nightlyRate)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(grandTotal(r))}</td>
                        {isManager && (
                          <td className="px-2 py-2">
                            <div className="flex gap-1">
                              <button
                                onClick={() => navigate(`/reservations?id=${r.id}`)}
                                title="Düzenle"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                              >
                                <ExternalLink size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`${r.code} kodlu rezervasyon silinsin mi? (Arşive alınır)`)) {
                                    deleteReservation(r.id);
                                  }
                                }}
                                title="Sil"
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
                  {report.checkedOut.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Bu aralıkta kayıt yok</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card className="mt-4 p-5">
        <h3 className="mb-4 font-semibold">Günlük Tahsilat</h3>
        <div className="flex h-40 items-end gap-0.5 sm:gap-1">
          {report.daily.map((d) => (
            <div key={d.date} className="group relative flex-1 min-w-0">
              <div
                className="w-full rounded-t-sm bg-gradient-to-t from-teal-700 to-teal-400 transition hover:to-teal-300"
                style={{ height: `${Math.max(4, (d.amount / report.maxDaily) * 100)}%` }}
                title={`${d.date}: ${formatCurrency(d.amount)}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-400">
          <span>{from}</span>
          <span>{to}</span>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Kanal / Kaynak</h3>
          <div className="space-y-3">
            {Object.entries(report.bySource)
              .sort((a, b) => b[1] - a[1])
              .map(([src, count]) => {
                const pct = report.resCount ? Math.round((count / report.resCount) * 100) : 0;
                return (
                  <div key={src}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{src}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            {Object.keys(report.bySource).length === 0 && (
              <p className="text-sm text-slate-400">Veri yok</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Oda Tipi Performansı</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2">Tip</th>
                  <th className="pb-2">Gece</th>
                  <th className="pb-2 text-right">Gelir*</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Object.entries(report.byType).map(([type, data]) => (
                  <tr key={type}>
                    <td className="py-2">{ROOM_TYPE_LABELS[type] || type}</td>
                    <td className="py-2">{data.nights}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(data.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-slate-400">* Fatura toplamı (konaklama bazlı)</p>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Rezervasyon Durumları (Tümü)</h3>
          <div className="space-y-2">
            {Object.entries(report.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span>{RES_STATUS_LABELS[status]}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Dönem iptalleri: <strong>{report.cancellations}</strong>
          </div>
        </Card>
      </div>
    </div>
  );
}
