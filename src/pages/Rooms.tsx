import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, ChevronRight, ExternalLink } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Room, RoomStatus, RoomType } from '../lib/types';
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
import { balanceDue, paidTotal, paymentMethodSummary } from '../lib/calculations';
import {
  formatCurrency,
  HK_STATUS_LABELS,
  ROOM_STATUS_LABELS,
  ROOM_TYPE_LABELS,
} from '../lib/utils';

const emptyForm = {
  number: '',
  floor: 1,
  type: 'standard' as RoomType,
  status: 'available' as RoomStatus,
  housekeeping: 'clean' as const,
  capacity: 2,
  beds: '1 Çift Kişilik',
  pricePerNight: 2500,
  amenities: 'Wi-Fi, TV, Klima',
  description: '',
};

export default function Rooms() {
  const { state, addRoom, updateRoom, deleteRoom } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<Room | null>(null);

  const rooms = useMemo(() => {
    return state.rooms
      .filter((r) => !r.deletedAt)
      .filter((r) => {
        if (filterType !== 'all' && r.type !== filterType) return false;
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;
        if (q) {
          const s = q.toLowerCase();
          return (
            r.number.includes(s) ||
            r.type.includes(s) ||
            r.description.toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [state.rooms, q, filterType, filterStatus]);

  const occupancyByRoom = useMemo(() => {
    const map: Record<string, { res: (typeof state.reservations)[number]; guestName: string }> = {};
    state.reservations
      .filter((r) => !r.deletedAt && r.status === 'checked_in')
      .forEach((r) => {
        const g = state.guests.find((x) => x.id === r.guestId);
        map[r.roomId] = { res: r, guestName: g ? `${g.firstName} ${g.lastName}` : 'Misafir' };
      });
    return map;
  }, [state.reservations, state.guests]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (r: Room) => {
    setEditId(r.id);
    setForm({
      number: r.number,
      floor: r.floor,
      type: r.type,
      status: r.status,
      housekeeping: r.housekeeping as 'clean',
      capacity: r.capacity,
      beds: r.beds,
      pricePerNight: r.pricePerNight,
      amenities: r.amenities.join(', '),
      description: r.description,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.number.trim()) return;
    const payload = {
      number: form.number.trim(),
      floor: Number(form.floor),
      type: form.type,
      status: form.status,
      housekeeping: form.housekeeping,
      capacity: Number(form.capacity),
      beds: form.beds,
      pricePerNight: Number(form.pricePerNight),
      amenities: form.amenities.split(',').map((a) => a.trim()).filter(Boolean),
      description: form.description,
    };
    if (editId) updateRoom(editId, payload);
    else addRoom(payload);
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Oda Yönetimi"
        subtitle={`${rooms.length} oda · filtreleyin, düzenleyin, durum güncelleyin`}
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Yeni Oda
          </Button>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Oda no, tip veya açıklama ara..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="sm:w-40">
            <option value="all">Tüm tipler</option>
            {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="sm:w-40">
            <option value="all">Tüm durumlar</option>
            {Object.entries(ROOM_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
      </Card>

      {rooms.length === 0 ? (
        <Card><EmptyState title="Oda bulunamadı" desc="Filtreleri temizleyin veya yeni oda ekleyin." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rooms.map((r) => (
            <Card key={r.id} className="overflow-hidden" onClick={() => setDetail(r)}>
              <div
                className={`h-1.5 ${
                  r.status === 'available'
                    ? 'bg-emerald-500'
                    : r.status === 'occupied'
                      ? 'bg-blue-500'
                      : r.status === 'cleaning'
                        ? 'bg-amber-400'
                        : r.status === 'maintenance'
                          ? 'bg-orange-500'
                          : 'bg-rose-500'
                }`}
              />
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{r.number}</p>
                    <p className="text-xs text-slate-500">Kat {r.floor} · {ROOM_TYPE_LABELS[r.type]}</p>
                  </div>
                  <Badge color={statusColor(r.status)}>{ROOM_STATUS_LABELS[r.status]}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const cycle: Record<string, 'clean' | 'dirty' | 'in_progress' | 'inspected'> = {
                        dirty: 'in_progress',
                        in_progress: 'clean',
                        clean: 'inspected',
                        inspected: 'dirty',
                        do_not_disturb: 'dirty',
                      };
                      const next = cycle[r.housekeeping] || 'clean';
                      updateRoom(r.id, {
                        housekeeping: next,
                        // Oda kirliden temize gecince, hala fiziksel olarak
                        // "temizleniyor" statusundeyse musait/dolu ile
                        // karsilikli tutarli kalsin diye status'u da guncelle.
                        status:
                          next === 'clean' || next === 'inspected'
                            ? r.status === 'cleaning'
                              ? 'available'
                              : r.status
                            : r.status === 'available'
                              ? 'cleaning'
                              : r.status,
                      });
                    }}
                    title="Tıklayarak temizlik durumunu ilerlet"
                    className="cursor-pointer"
                  >
                    <Badge color={statusColor(r.housekeeping)}>{HK_STATUS_LABELS[r.housekeeping]} ✎</Badge>
                  </button>
                  <Badge>{r.capacity} kişi</Badge>
                </div>
                {occupancyByRoom[r.id] && (
                  <div className="mt-3 rounded-xl bg-blue-50 p-2.5">
                    <p className="truncate text-sm font-semibold text-blue-900">
                      {occupancyByRoom[r.id].guestName}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-blue-700">
                      <span>
                        {occupancyByRoom[r.id].res.adults} yetişkin
                        {occupancyByRoom[r.id].res.children > 0 ? ` · ${occupancyByRoom[r.id].res.children} çocuk` : ''}
                        {' · '}{occupancyByRoom[r.id].res.code}
                      </span>
                      {(() => {
                        const bal = balanceDue(occupancyByRoom[r.id].res, state.payments);
                        return (
                          <span className={bal > 0 ? 'font-bold text-rose-600' : 'font-bold text-emerald-700'}>
                            {bal > 0 ? `Bakiye ${formatCurrency(bal)}` : 'Ödendi'}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-blue-600">
                      <span>Ödenen: {formatCurrency(paidTotal(state.payments, occupancyByRoom[r.id].res.id))}</span>
                      <span>{paymentMethodSummary(state.payments, occupancyByRoom[r.id].res.id)}</span>
                    </div>
                  </div>
                )}
                <p className="mt-3 text-sm text-slate-600 line-clamp-2">{r.description || r.beds}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  {occupancyByRoom[r.id] ? (
                    <p className="font-semibold text-teal-800">
                      {formatCurrency(occupancyByRoom[r.id].res.nightlyRate)}
                      <span className="text-xs font-normal text-slate-400">/gece (bu rezervasyon)</span>
                    </p>
                  ) : (
                    <p className="font-semibold text-teal-800">{formatCurrency(r.pricePerNight)}<span className="text-xs font-normal text-slate-400">/gece</span></p>
                  )}
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEdit(r)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Oda arşive alınsın mı? (Kalıcı silinmez, Ayarlar’dan geri alınabilir)')) deleteRoom(r.id);
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Oda Düzenle' : 'Yeni Oda'} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Oda No" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          <Input label="Kat" type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: +e.target.value })} />
          <Select label="Tip" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RoomType })}>
            {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select label="Durum" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RoomStatus })}>
            {Object.entries(ROOM_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Input label="Kapasite" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: +e.target.value })} />
          <Input label="Gecelik Fiyat (₺)" type="number" value={form.pricePerNight} onChange={(e) => setForm({ ...form, pricePerNight: +e.target.value })} />
          <Input label="Yatak" value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })} className="sm:col-span-2" />
          <Input label="Olanaklar (virgülle)" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} className="sm:col-span-2" />
          <Textarea label="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="sm:col-span-2" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
          <Button onClick={save}>Kaydet</Button>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Oda ${detail.number}` : ''}>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge color={statusColor(detail.status)}>{ROOM_STATUS_LABELS[detail.status]}</Badge>
              <Badge color={statusColor(detail.housekeeping)}>{HK_STATUS_LABELS[detail.housekeeping]}</Badge>
              <Badge color="teal">{ROOM_TYPE_LABELS[detail.type]}</Badge>
            </div>
            {occupancyByRoom[detail.id] && (
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-blue-700">
                  <span>Şu An Konaklayan</span>
                  <button
                    onClick={() => navigate(`/reservations?id=${occupancyByRoom[detail.id].res.id}`)}
                    className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-50"
                  >
                    {occupancyByRoom[detail.id].res.code} <ExternalLink size={11} />
                  </button>
                </p>

                {/* Ana misafir */}
                <button
                  onClick={() => navigate(`/guests?id=${occupancyByRoom[detail.id].res.guestId}`)}
                  className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left hover:bg-blue-100/60"
                >
                  <span className="font-semibold text-blue-900">
                    {occupancyByRoom[detail.id].guestName} <span className="font-normal text-slate-400">(ana misafir)</span>
                  </span>
                  <ChevronRight size={14} className="text-slate-400" />
                </button>

                {/* Refakatciler */}
                {(occupancyByRoom[detail.id].res.companions || []).map((c) => {
                  const cg = state.guests.find((x) => x.id === c.guestId);
                  return (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/guests?id=${c.guestId}`)}
                      className="mt-1 flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left hover:bg-blue-100/60"
                    >
                      <span className="text-sm text-blue-900">
                        {cg ? `${cg.firstName} ${cg.lastName}` : 'Misafir'}
                        {c.isChild ? ' (çocuk)' : ''}
                        {c.isExtra ? ' · ekstra' : ''}
                      </span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  );
                })}

                <p className="mt-2 text-sm text-blue-700">
                  {occupancyByRoom[detail.id].res.adults} yetişkin
                  {occupancyByRoom[detail.id].res.children > 0 ? ` · ${occupancyByRoom[detail.id].res.children} çocuk` : ''}
                </p>
                <p className="mt-1 text-sm">
                  {(() => {
                    const bal = balanceDue(occupancyByRoom[detail.id].res, state.payments);
                    return (
                      <span className={bal > 0 ? 'font-bold text-rose-600' : 'font-bold text-emerald-700'}>
                        {bal > 0 ? `Kalan Bakiye: ${formatCurrency(bal)}` : 'Ödeme Tamamlandı'}
                      </span>
                    );
                  })()}
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  Ödenen: {formatCurrency(paidTotal(state.payments, occupancyByRoom[detail.id].res.id))} ·{' '}
                  {paymentMethodSummary(state.payments, occupancyByRoom[detail.id].res.id)}
                </p>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Kat</dt><dd className="font-medium">{detail.floor}</dd></div>
              <div><dt className="text-slate-500">Kapasite</dt><dd className="font-medium">{detail.capacity} kişi</dd></div>
              <div><dt className="text-slate-500">Yatak</dt><dd className="font-medium">{detail.beds}</dd></div>
              <div><dt className="text-slate-500">Fiyat</dt><dd className="font-medium">{formatCurrency(detail.pricePerNight)}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Son Temizlik</dt><dd className="font-medium">{detail.lastCleaned || '—'}</dd></div>
            </dl>
            <p className="text-sm text-slate-600">{detail.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {detail.amenities.map((a) => (
                <Badge key={a}>{a}</Badge>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                label="Durum güncelle"
                value={detail.status}
                onChange={(e) => {
                  updateRoom(detail.id, { status: e.target.value as RoomStatus });
                  setDetail({ ...detail, status: e.target.value as RoomStatus });
                }}
              >
                {Object.entries(ROOM_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
              <Select
                label="HK durumu"
                value={detail.housekeeping}
                onChange={(e) => {
                  updateRoom(detail.id, { housekeeping: e.target.value as Room['housekeeping'] });
                  setDetail({ ...detail, housekeeping: e.target.value as Room['housekeeping'] });
                }}
              >
                {Object.entries(HK_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
