import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BedDouble,
  CalendarCheck2,
  LogIn,
  LogOut,
  Percent,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { balanceDue, grandTotal, paidTotal, paymentMethodSummary } from '../lib/calculations';
import {
  Badge,
  Card,
  PageHeader,
  StatCard,
  statusColor,
} from '../components/ui';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  RES_STATUS_LABELS,
  ROOM_STATUS_LABELS,
  todayISO,
  hotelDayRange,
  entryStamp,
  currentHotelDayAnchor,
  capStampAtNow,
  pageLabel,
  cn,
} from '../lib/utils';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { state, isManager, presence } = useStore();
  const navigate = useNavigate();
  const t = todayISO();

  const stats = useMemo(() => {
    const rooms = state.rooms.filter((r) => !r.deletedAt);
    const reservations = state.reservations.filter((r) => !r.deletedAt);
    const payments = state.payments.filter((p) => !p.deletedAt);
    const guests = state.guests.filter((g) => !g.deletedAt);

    const activeRes = reservations.filter((r) =>
      ['confirmed', 'pending', 'checked_in'].includes(r.status)
    );
    // Doluluk, oda.status alanindan degil dogrudan aktif check-in'li
    // rezervasyonlardan hesaplanir — bu iki alan bazen senkron kaymasi
    // yasayabiliyor, rezervasyon durumu daha guvenilir kaynak.
    const checkedInRoomIds = new Set(
      reservations.filter((r) => r.status === 'checked_in').map((r) => r.roomId)
    );
    const outOfOrderCount = rooms.filter((r) => r.status === 'out_of_order').length;
    const sellable = rooms.length - outOfOrderCount;
    const occupied = checkedInRoomIds.size;
    const available = Math.max(0, sellable - occupied);
    const occupancy = sellable ? Math.round((occupied / sellable) * 100) : 0;

    const arrivals = reservations.filter(
      (r) => r.checkIn === t && ['confirmed', 'pending'].includes(r.status)
    );
    const departures = reservations.filter(
      (r) => r.checkOut === t && r.status === 'checked_in'
    );
    const inHouse = reservations.filter((r) => r.status === 'checked_in');

    // "Bugunku Gelir" otel gun donumune (07:00-07:00) gore hesaplanir —
    // takvim gecesi yarisina degil, otelin gercek gun kapanis saatine gore.
    // Muhasebe sayfasindaki "Gun Donumu" filtresiyle ayni mantik/kaynak.
    const { fromStamp, toStamp: rawToStamp } = hotelDayRange(currentHotelDayAnchor());
    const toStamp = capStampAtNow(rawToStamp);
    const todayLedger = (state.ledger || []).filter((e) => {
      if (e.deletedAt || e.type !== 'income') return false;
      const stamp = entryStamp(e);
      return stamp >= fromStamp && stamp < toStamp;
    });
    const todayRevenue = todayLedger.reduce((s, e) => s + e.amount, 0);

    const month = t.slice(0, 7);
    const monthRes = reservations.filter(
      (r) => r.createdAt.startsWith(month) && r.status !== 'cancelled'
    );
    const monthRevenue = payments
      .filter((p) => p.date.startsWith(month) && p.amount > 0)
      .reduce((s, p) => s + p.amount, 0);

    const adr =
      inHouse.length > 0
        ? Math.round(inHouse.reduce((s, r) => s + r.nightlyRate, 0) / inHouse.length)
        : 0;

    return {
      occupied,
      available,
      occupancy,
      arrivals,
      departures,
      inHouse,
      todayRevenue,
      monthRevenue,
      monthRes: monthRes.length,
      adr,
      activeRes: activeRes.length,
      guests: guests.length,
    };
  }, [state, t]);

  const roomStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    state.rooms.filter((r) => !r.deletedAt).forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [state.rooms]);

  const roomTotal = state.rooms.filter((r) => !r.deletedAt).length || 1;

  return (
    <div>
      <PageHeader
        title="Operasyon Paneli"
        subtitle={`${state.settings.name} · ${new Date().toLocaleDateString('tr-TR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`}
      />
      <p className="-mt-2 mb-4 text-xs text-slate-400">
        Not: "Bugünkü Gelir" oteldeki gün dönümüne göre hesaplanır — dünün 07:00'inden bugünün 07:00'ine
        kadarki tahsilatları kapsar (gece yarısı değil).
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Doluluk"
          value={`${stats.occupancy}%`}
          hint={`${stats.occupied} dolu / ${stats.available} müsait`}
          icon={<Percent size={20} />}
          tone="teal"
          to="/calendar"
        />
        <StatCard
          label="Bugünkü Gelir"
          value={formatCurrency(stats.todayRevenue)}
          hint={`07:00–07:00 gün dönümü · Aylık: ${formatCurrency(stats.monthRevenue)}`}
          icon={<Wallet size={20} />}
          tone="emerald"
          to="/payments"
        />
        <StatCard
          label="Bugün Geliş"
          value={stats.arrivals.length}
          hint={`${stats.departures.length} ayrılış planlı`}
          icon={<LogIn size={20} />}
          tone="blue"
          to="/front-desk"
        />
        <StatCard
          label="Ortalama Oda Fiyatı"
          value={formatCurrency(stats.adr)}
          hint={`${stats.inHouse.length} oda dolu (oteldeki misafir)`}
          icon={<TrendingUp size={20} />}
          tone="violet"
          to="/reports"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Bugünkü Hareketler</h3>
            <Link to="/front-desk" className="text-xs font-medium text-teal-700 hover:underline">
              Resepsiyona git →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <LogIn size={14} className="text-blue-600" /> Gelişler
              </p>
              <div className="space-y-2">
                {stats.arrivals.length === 0 && (
                  <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">Bugün geliş yok</p>
                )}
                {stats.arrivals.map((r) => {
                  const g = state.guests.find((x) => x.id === r.guestId);
                  const room = state.rooms.find((x) => x.id === r.roomId);
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {g?.firstName} {g?.lastName}
                          {g?.vip && <Badge color="amber">VIP</Badge>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {r.code} · Oda {room?.number}
                        </p>
                      </div>
                      <Badge color={statusColor(r.status)}>{RES_STATUS_LABELS[r.status]}</Badge>
                    </motion.div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <LogOut size={14} className="text-rose-600" /> Ayrılışlar
              </p>
              <div className="space-y-2">
                {stats.departures.length === 0 && (
                  <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">Bugün ayrılış yok</p>
                )}
                {stats.departures.map((r) => {
                  const g = state.guests.find((x) => x.id === r.guestId);
                  const room = state.rooms.find((x) => x.id === r.roomId);
                  const bal = balanceDue(r, state.payments);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {g?.firstName} {g?.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          Oda {room?.number} · Bakiye {formatCurrency(bal)}
                        </p>
                      </div>
                      <Badge color={bal > 0 ? 'rose' : 'emerald'}>{bal > 0 ? 'Borçlu' : 'Hazır'}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Oda Durumları</h3>
          <div className="space-y-3">
            {Object.entries(roomStatusCounts).map(([status, count]) => {
              const pct = Math.round((count / roomTotal) * 100);
              return (
                <div key={status}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-slate-600">{ROOM_STATUS_LABELS[status]}</span>
                    <span className="text-slate-500">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        status === 'available'
                          ? 'bg-emerald-500'
                          : status === 'occupied'
                            ? 'bg-blue-500'
                            : status === 'cleaning'
                              ? 'bg-amber-500'
                              : status === 'maintenance'
                                ? 'bg-orange-500'
                                : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link
              to="/rooms"
              className="rounded-xl bg-teal-50 px-3 py-2.5 text-center text-xs font-semibold text-teal-800 hover:bg-teal-100"
            >
              <BedDouble size={14} className="mx-auto mb-1" /> Odalar
            </Link>
            <Link
              to="/reservations"
              className="rounded-xl bg-blue-50 px-3 py-2.5 text-center text-xs font-semibold text-blue-800 hover:bg-blue-100"
            >
              <CalendarCheck2 size={14} className="mx-auto mb-1" /> Rezervasyon
            </Link>
          </div>
        </Card>
      </div>

      {isManager && (
        <Card className="mt-4 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              Canlı Personel — Kim Nerede?
            </h3>
          </div>
          {(() => {
            const now = Date.now();
            // Ayni personelin (sayfa yenileme/yeniden baglanma gibi
            // sebeplerle) birden fazla eski kaydi kalmis olabilir — sadece
            // EN GUNCEL olani gosteriyoruz, yoksa "gecmis" gibi birikmis
            // gorunuyordu, anlik degil.
            const latestByStaff = new Map<string, { staffName: string; page: string; at: number }>();
            Object.entries(presence).forEach(([staffId, entries]) => {
              const newest = entries.reduce((a, b) => (b.at > a.at ? b : a));
              const existing = latestByStaff.get(staffId);
              if (!existing || newest.at > existing.at) latestByStaff.set(staffId, newest);
            });
            const rows = Array.from(latestByStaff.values())
              .filter((p) => now - p.at < 3 * 60 * 1000) // 3 dk'dan eski ise gosterme
              .sort((a, b) => b.at - a.at);
            if (rows.length === 0) {
              return <p className="py-4 text-center text-sm text-slate-400">Şu an aktif personel yok</p>;
            }
            return (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((p, i) => {
                  const online = now - p.at < 60 * 1000;
                  return (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.staffName}</p>
                        <p className="text-xs text-slate-500">{pageLabel(p.page)}</p>
                      </div>
                      <span
                        className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        title={online ? 'Çevrimiçi' : 'Az önce buradaydı'}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Oteldeki Misafirler</h3>
            <Badge color="blue">{stats.inHouse.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="pb-2 font-medium">Misafir</th>
                  <th className="pb-2 font-medium">Oda</th>
                  <th className="pb-2 font-medium">Çıkış</th>
                  <th className="pb-2 font-medium text-right">Ödenen</th>
                  <th className="pb-2 font-medium">Yöntem</th>
                  <th className="pb-2 font-medium text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.inHouse.map((r) => {
                  const g = state.guests.find((x) => x.id === r.guestId && !x.deletedAt) ?? state.guests.find((x) => x.id === r.guestId);
                  const room = state.rooms.find((x) => x.id === r.roomId);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/reservations?id=${r.id}`)}
                      className="cursor-pointer hover:bg-teal-50/70"
                      title="Rezervasyon detayına git"
                    >
                      <td className="py-2.5 font-medium text-teal-800 underline-offset-2 hover:underline">
                        {g?.firstName} {g?.lastName}
                      </td>
                      <td className="py-2.5">{room?.number}</td>
                      <td className="py-2.5 text-slate-500">{formatDate(r.checkOut)}</td>
                      <td className="py-2.5 text-right text-emerald-700">
                        {formatCurrency(paidTotal(state.payments, r.id))}
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">
                        {paymentMethodSummary(state.payments, r.id)}
                      </td>
                      <td className="py-2.5 text-right font-medium">
                        {formatCurrency(balanceDue(r, state.payments))}
                      </td>
                    </tr>
                  );
                })}
                {stats.inHouse.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Otelde misafir yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Son Aktiviteler</h3>
            <Users size={16} className="text-slate-400" />
          </div>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {state.activity.slice(0, 12).map((a) => {
              // relatedId hangi turden bagimsiz olarak, o ID'nin gercekte
              // hangi tabloya ait oldugunu bulup oraya yonlendiriyoruz —
              // boylece "rezervasyon", "check-in", "odeme" gibi turlerin
              // hepsi otomatik olarak dogru detaya gider.
              let target: string | null = null;
              if (a.relatedId) {
                if (state.reservations.some((r) => r.id === a.relatedId)) {
                  target = `/reservations?id=${a.relatedId}`;
                } else if (state.guests.some((g) => g.id === a.relatedId)) {
                  target = `/guests?id=${a.relatedId}`;
                }
              }
              return (
                <div
                  key={a.id}
                  onClick={() => target && navigate(target)}
                  className={cn(
                    'flex gap-3 rounded-lg p-1.5 -m-1.5',
                    target && 'cursor-pointer hover:bg-teal-50/70'
                  )}
                  title={target ? 'Detaya git' : undefined}
                >
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                  <div className="min-w-0">
                    <p className={cn('text-sm text-slate-700', target && 'text-teal-800 hover:underline')}>
                      {a.message}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {a.user} · {formatDateTime(a.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Link to="/reservations" className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
          <p className="text-xs text-slate-500">Aktif Rezervasyon</p>
          <p className="mt-1 text-xl font-bold">{stats.activeRes}</p>
          <p className="mt-1 text-[11px] font-semibold text-teal-700">Rezervasyonlara git →</p>
        </Link>
        <Link to="/guests" className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
          <p className="text-xs text-slate-500">Kayıtlı Misafir</p>
          <p className="mt-1 text-xl font-bold">{stats.guests}</p>
          <p className="mt-1 text-[11px] font-semibold text-teal-700">Misafirlere git →</p>
        </Link>
        <Link to="/reports" className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
          <p className="text-xs text-slate-500">Bu Ay Yeni Rez.</p>
          <p className="mt-1 text-xl font-bold">{stats.monthRes}</p>
          <p className="text-xs text-slate-400 mt-1">
            Tahsilat: {formatCurrency(
              state.reservations
                .filter((r) => !r.deletedAt && r.status === 'checked_in')
                .reduce((s, r) => s + paidTotal(state.payments, r.id), 0)
            )}{' '}
            / Toplam fatura {formatCurrency(
              state.reservations
                .filter((r) => !r.deletedAt && r.status === 'checked_in')
                .reduce((s, r) => s + grandTotal(r), 0)
            )}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-teal-700">Raporlara git →</p>
        </Link>
      </div>
    </div>
  );
}
