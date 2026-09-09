import { useMemo, useState } from 'react';
import { Plus, Wrench, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { useStore } from '../lib/store';
import type { MaintenanceIssue, TaskPriority, TaskStatus } from '../lib/types';
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
} from '../components/ui';
import { formatDateTime } from '../lib/utils';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  urgent: 'Acil',
};
const PRIORITY_COLOR: Record<TaskPriority, 'slate' | 'amber' | 'rose'> = {
  low: 'slate',
  medium: 'slate',
  high: 'amber',
  urgent: 'rose',
};
const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Açık',
  in_progress: 'Devam Ediyor',
  done: 'Tamamlandı',
  cancelled: 'İptal',
};

const empty = {
  roomId: '',
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
  assignedTo: '',
};

export default function Maintenance() {
  const {
    state,
    addMaintenanceIssue,
    completeMaintenanceIssue,
    deleteMaintenanceIssue,
    isManager,
  } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [statusFilter, setStatusFilter] = useState<'active' | 'done' | 'all'>('active');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');

  const issues = useMemo(() => {
    return (state.maintenanceIssues || [])
      .filter((m) => !m.deletedAt)
      .filter((m) => {
        if (statusFilter === 'active') return m.status !== 'done' && m.status !== 'cancelled';
        if (statusFilter === 'done') return m.status === 'done';
        return true;
      })
      .sort((a, b) => {
        const order: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [state.maintenanceIssues, statusFilter]);

  const openCreate = () => {
    setForm(empty);
    setOpen(true);
  };

  const save = () => {
    if (!form.title.trim()) return;
    addMaintenanceIssue({
      roomId: form.roomId || undefined,
      title: form.title,
      description: form.description,
      priority: form.priority,
      assignedTo: form.assignedTo || undefined,
    });
    setOpen(false);
  };

  const activeStaff = state.staff.filter((s) => !s.deletedAt && s.active);

  return (
    <div>
      <PageHeader
        title="Arıza & Teknik İşler"
        subtitle="Bakım, tadilat ve teknik iş takibi"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Yeni İş
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex gap-2">
          {(['active', 'done', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                statusFilter === s ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {s === 'active' ? 'Açık İşler' : s === 'done' ? 'Tamamlananlar' : 'Tümü'}
            </button>
          ))}
        </div>
      </Card>

      {issues.length === 0 ? (
        <Card><EmptyState title="Kayıt bulunamadı" /></Card>
      ) : (
        <div className="space-y-3">
          {issues.map((m) => {
            const room = m.roomId ? state.rooms.find((r) => r.id === m.roomId) : undefined;
            const assignee = m.assignedTo ? state.staff.find((s) => s.id === m.assignedTo) : undefined;
            return (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        m.priority === 'urgent' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {m.priority === 'urgent' ? <AlertTriangle size={16} /> : <Wrench size={16} />}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {m.title} {room && <span className="text-slate-400 font-normal">· Oda {room.number}</span>}
                      </p>
                      {m.description && <p className="mt-0.5 text-sm text-slate-500">{m.description}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge color={PRIORITY_COLOR[m.priority]}>{PRIORITY_LABELS[m.priority]}</Badge>
                        <Badge color={m.status === 'done' ? 'emerald' : 'slate'}>{STATUS_LABELS[m.status]}</Badge>
                        {assignee && <span className="text-xs text-slate-400">Atanan: {assignee.name}</span>}
                        <span className="text-xs text-slate-400">{formatDateTime(m.createdAt)}</span>
                      </div>
                      {m.status === 'done' && m.notes && (
                        <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
                          Not: {m.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {m.status !== 'done' && m.status !== 'cancelled' && (
                      <Button size="sm" variant="outline" onClick={() => { setCompletingId(m.id); setCompleteNotes(''); }}>
                        <CheckCircle2 size={14} /> Tamamla
                      </Button>
                    )}
                    {isManager && (
                      <button
                        onClick={() => {
                          if (confirm('Kayıt silinsin mi?')) deleteMaintenanceIssue(m.id);
                        }}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Yeni Arıza / Bakım İşi">
        <div className="space-y-3">
          <Input label="Başlık" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Select label="Oda (opsiyonel)" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
            <option value="">Genel / oda dışı</option>
            {state.rooms.filter((r) => !r.deletedAt).map((r) => (
              <option key={r.id} value={r.id}>{r.number}</option>
            ))}
          </Select>
          <Textarea label="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select label="Öncelik" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </Select>
          <Select label="Ata (opsiyonel)" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
            <option value="">Atanmadı</option>
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={save}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!completingId} onClose={() => setCompletingId(null)} title="İşi Tamamla">
        <div className="space-y-3">
          <Textarea label="Not (opsiyonel)" value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCompletingId(null)}>İptal</Button>
            <Button
              onClick={() => {
                if (completingId) completeMaintenanceIssue(completingId, completeNotes || undefined);
                setCompletingId(null);
              }}
            >
              Tamamlandı Olarak İşaretle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
