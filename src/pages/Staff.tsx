import { useState } from 'react';
import { Plus, Pencil, Trash2, KeyRound, ShieldAlert } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Staff, StaffRole } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
} from '../components/ui';
import { ROLE_LABELS, formatDate } from '../lib/utils';

const empty = {
  name: '',
  email: '',
  phone: '',
  role: 'receptionist' as StaffRole,
  roles: ['receptionist'] as StaffRole[],
  active: true,
  shift: '08:00-16:00',
  department: 'Resepsiyon',
  hiredAt: new Date().toISOString().slice(0, 10),
  username: '',
  password: '',
  salary: 0,
};

export default function StaffPage() {
  const { state, addStaff, updateStaff, deleteStaff, isManager } = useStore();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const openCreate = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditId(s.id);
    setForm({
      name: s.name,
      email: s.email,
      phone: s.phone,
      role: s.role,
      roles: s.roles && s.roles.length ? s.roles : [s.role],
      active: s.active,
      shift: s.shift,
      department: s.department,
      hiredAt: s.hiredAt,
      username: s.username ?? '',
      password: s.password ?? '',
      salary: s.salary ?? 0,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name) return;
    if (form.roles.length === 0) return;
    const payload = {
      ...form,
      role: form.roles[0],
      username: form.username.trim() || undefined,
      password: form.password || undefined,
    };
    if (editId) updateStaff(editId, payload);
    else addStaff(payload);
    setOpen(false);
  };

  const roleColors: Record<string, 'teal' | 'blue' | 'violet' | 'amber' | 'emerald' | 'rose'> = {
    admin: 'rose',
    manager: 'violet',
    receptionist: 'teal',
    housekeeping: 'amber',
    accountant: 'blue',
    concierge: 'emerald',
  };

  if (!isManager) {
    return (
      <div>
        <PageHeader title="Personel" subtitle="Yetkisiz erişim" />
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
        title="Personel"
        subtitle="Çalışanlar, roller, vardiyalar ve panel giriş bilgileri"
        actions={
          isManager ? (
            <Button onClick={openCreate}>
              <Plus size={16} /> Personel Ekle
            </Button>
          ) : undefined
        }
      />

      {state.staff.filter((s) => !s.deletedAt).length === 0 ? (
        <Card>
          <EmptyState title="Personel yok" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state.staff
            .filter((s) => !s.deletedAt)
            .map((s) => (
              <Card key={s.id} className={`p-4 ${!s.active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                      {s.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {isManager && (
                      <>
                        <button
                          onClick={() => openEdit(s)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Personel arşive alınsın mı? (Kalıcı silinmez)')) deleteStaff(s.id);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <div className="flex flex-wrap gap-1">
                    {(s.roles && s.roles.length ? s.roles : [s.role]).map((r) => (
                      <Badge key={r} color={roleColors[r] || 'slate'}>{ROLE_LABELS[r]}</Badge>
                    ))}
                  </div>
                  <Badge color={s.active ? 'emerald' : 'rose'}>{s.active ? 'Aktif' : 'Pasif'}</Badge>
                  {s.username ? (
                    <Badge color="teal">
                      <span className="inline-flex items-center gap-1">
                        <KeyRound size={10} /> {s.username}
                      </span>
                    </Badge>
                  ) : (
                    <Badge color="slate">Giriş yok</Badge>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-400">Departman</dt>
                    <dd className="font-medium">{s.department}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Vardiya</dt>
                    <dd className="font-medium">{s.shift}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Telefon</dt>
                    <dd className="font-medium">{s.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">İşe Giriş</dt>
                    <dd className="font-medium">{formatDate(s.hiredAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Maaş</dt>
                    <dd className="font-medium">{s.salary ? s.salary.toLocaleString('tr-TR') + ' ₺' : '—'}</dd>
                  </div>
                </dl>
              </Card>
            ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Personel Düzenle' : 'Yeni Personel'} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Ad Soyad" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="E-posta" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Görevler (birden fazla seçilebilir — örn. hem Resepsiyon hem Vale)
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.entries(ROLE_LABELS) as [StaffRole, string][]).map(([k, v]) => (
                <label
                  key={k}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50"
                >
                  <input
                    type="checkbox"
                    checked={form.roles.includes(k)}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        roles: e.target.checked
                          ? [...f.roles, k]
                          : f.roles.filter((r) => r !== k),
                      }));
                    }}
                  />
                  {v}
                </label>
              ))}
            </div>
          </div>
          <Input label="Departman" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <Input label="Vardiya" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} />
          <Input label="Aylık maaş (₺)" type="number" value={form.salary || ''} onChange={(e) => setForm({ ...form, salary: +e.target.value })} />
          <Input label="İşe Giriş" type="date" value={form.hiredAt} onChange={(e) => setForm({ ...form, hiredAt: e.target.value })} />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Aktif çalışan
          </label>
          <div className="sm:col-span-2 rounded-2xl border border-teal-100 bg-teal-50/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-800">Panel girişi</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Kullanıcı adı"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Boş = giriş yok"
              />
              <Input
                label="Şifre"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Panel şifresi"
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            İptal
          </Button>
          <Button onClick={save}>Kaydet</Button>
        </div>
      </Modal>
    </div>
  );
}
