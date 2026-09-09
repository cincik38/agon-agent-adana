import { useMemo, useState } from 'react';
import { Plus, CheckCircle2, Play, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import type { TaskPriority, TaskStatus } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Select,
  Textarea,
  statusColor,
} from '../components/ui';
import { formatDateTime, HK_STATUS_LABELS, ROOM_STATUS_LABELS } from '../lib/utils';

export default function Housekeeping() {
  const { state, addTask, updateTask, deleteTask, updateRoom } = useStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('open');
  const [form, setForm] = useState({
    roomId: state.rooms[0]?.id ?? '',
    assignedTo: '',
    priority: 'medium' as TaskPriority,
    type: 'Günlük Temizlik',
    notes: '',
  });

  const tasks = useMemo(() => {
    return state.tasks
      .filter((t) => !t.deletedAt)
      .filter((t) => {
        if (filter === 'all') return true;
        if (filter === 'open') return t.status === 'open' || t.status === 'in_progress';
        return t.status === filter;
      })
      .sort((a, b) => {
        const p = { urgent: 0, high: 1, medium: 2, low: 3 };
        return p[a.priority] - p[b.priority];
      });
  }, [state.tasks, filter]);

  const hkStaff = state.staff.filter((s) => s.role === 'housekeeping' && s.active && !s.deletedAt);

  const roomBoard = useMemo(() => {
    return state.rooms
      .filter((r) => !r.deletedAt)
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [state.rooms]);

  const guestByRoom = useMemo(() => {
    const map: Record<string, string> = {};
    state.reservations
      .filter((r) => !r.deletedAt && r.status === 'checked_in')
      .forEach((r) => {
        const g = state.guests.find((x) => x.id === r.guestId);
        map[r.roomId] = g ? `${g.firstName} ${g.lastName}` : 'Misafir';
      });
    return map;
  }, [state.reservations, state.guests]);

  return (
    <div>
      <PageHeader
        title="Kat Hizmetleri"
        subtitle="Temizlik görevleri, oda HK durumu ve atamalar"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Yeni Görev
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {roomBoard.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              const next =
                r.housekeeping === 'dirty'
                  ? 'in_progress'
                  : r.housekeeping === 'in_progress'
                    ? 'clean'
                    : r.housekeeping === 'clean'
                      ? 'inspected'
                      : 'dirty';
              updateRoom(r.id, {
                housekeeping: next as typeof r.housekeeping,
                status:
                  next === 'clean' || next === 'inspected'
                    ? r.status === 'cleaning'
                      ? 'available'
                      : r.status
                    : r.status === 'available'
                      ? 'cleaning'
                      : r.status,
                lastCleaned: next === 'clean' || next === 'inspected' ? new Date().toISOString().slice(0, 10) : r.lastCleaned,
              });
            }}
            className={`overflow-hidden rounded-2xl border text-left transition hover:shadow-md ${
              r.housekeeping === 'clean' || r.housekeeping === 'inspected'
                ? 'border-emerald-200 bg-emerald-50'
                : r.housekeeping === 'in_progress'
                  ? 'border-amber-200 bg-amber-50'
                  : r.housekeeping === 'do_not_disturb'
                    ? 'border-violet-200 bg-violet-50'
                    : 'border-rose-200 bg-rose-50'
            }`}
          >
            <div className={`h-1.5 ${r.status === 'occupied' ? 'bg-blue-500' : r.status === 'out_of_order' ? 'bg-rose-600' : r.status === 'maintenance' ? 'bg-orange-500' : 'bg-emerald-400'}`} />
            <div className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">{r.number}</p>
                {r.status === 'occupied' && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">DOLU</span>
                )}
              </div>
              <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">
                {HK_STATUS_LABELS[r.housekeeping]}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">{ROOM_STATUS_LABELS[r.status]}</p>
              {guestByRoom[r.id] && (
                <p className="mt-1 truncate text-[10px] font-semibold text-blue-800">{guestByRoom[r.id]}</p>
              )}
            </div>
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-slate-500">Oda kartına tıklayarak HK durumunu döngüsel güncelleyin.</p>

      <Card className="mb-4 p-3">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:w-56">
          <option value="open">Açık / Devam Eden</option>
          <option value="done">Tamamlanan</option>
          <option value="all">Tümü</option>
          <option value="cancelled">İptal</option>
        </Select>
      </Card>

      {tasks.length === 0 ? (
        <Card><EmptyState title="Görev yok" /></Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const room = state.rooms.find((r) => r.id === t.roomId);
            const staff = state.staff.find((s) => s.id === t.assignedTo);
            return (
              <Card key={t.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{t.type}</p>
                      <Badge color={statusColor(t.priority)}>{t.priority}</Badge>
                      <Badge color={statusColor(t.status)}>{t.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Oda {room?.number ?? '—'} · {staff?.name ?? 'Atanmadı'}
                    </p>
                    {t.notes && <p className="mt-1 text-xs text-slate-500">{t.notes}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(t.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {t.status === 'open' && (
                      <Button size="sm" variant="outline" onClick={() => updateTask(t.id, { status: 'in_progress' as TaskStatus })}>
                        <Play size={14} /> Başlat
                      </Button>
                    )}
                    {(t.status === 'open' || t.status === 'in_progress') && (
                      <Button size="sm" variant="success" onClick={() => updateTask(t.id, { status: 'done' })}>
                        <CheckCircle2 size={14} /> Tamamla
                      </Button>
                    )}
                    <Select
                      value={t.assignedTo ?? ''}
                      onChange={(e) => updateTask(t.id, { assignedTo: e.target.value || undefined })}
                      className="w-40"
                    >
                      <option value="">Atanmadı</option>
                      {hkStaff.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                    <button onClick={() => deleteTask(t.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Yeni HK Görevi">
        <div className="space-y-3">
          <Select label="Oda" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
            {state.rooms.filter((r) => !r.deletedAt).map((r) => (
              <option key={r.id} value={r.id}>{r.number}</option>
            ))}
          </Select>
          <Select label="Tip" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['Günlük Temizlik', 'Çıkış Temizliği', 'Derin Temizlik', 'Turndown', 'Bakım Bildirimi', 'Minibar Kontrol', 'Diğer'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <Select label="Öncelik" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            <option value="low">Düşük</option>
            <option value="medium">Orta</option>
            <option value="high">Yüksek</option>
            <option value="urgent">Acil</option>
          </Select>
          <Select label="Personel" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
            <option value="">Atanmadı</option>
            {hkStaff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Textarea label="Not" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button
              onClick={() => {
                addTask({
                  roomId: form.roomId,
                  assignedTo: form.assignedTo || undefined,
                  status: 'open',
                  priority: form.priority,
                  type: form.type,
                  notes: form.notes,
                });
                setOpen(false);
              }}
            >
              Oluştur
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
