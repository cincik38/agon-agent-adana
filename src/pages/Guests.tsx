import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Star, Pencil, Trash2, ShieldAlert, MessageCircle } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Guest } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Textarea,
} from '../components/ui';
import { formatCurrency, formatDate, buildReviewWhatsAppLink } from '../lib/utils';
import { paymentMethodSummary } from '../lib/calculations';

const empty = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  idNumber: '',
  nationality: 'TR',
  address: '',
  notes: '',
  vip: false,
  blacklisted: false,
  blacklistReason: '',
};

export default function Guests() {
  const { state, addGuest, updateGuest, deleteGuest } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [detail, setDetail] = useState<Guest | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const gid = searchParams.get('id');
    if (gid) {
      const g = state.guests.find((x) => x.id === gid);
      if (g) setDetail(g);
      setSearchParams((p) => {
        p.delete('id');
        return p;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const guests = useMemo(() => {
    return state.guests
      .filter((g) => !g.deletedAt)
      .filter((g) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          g.firstName.toLowerCase().includes(s) ||
          g.lastName.toLowerCase().includes(s) ||
          g.phone.includes(s) ||
          g.idNumber.includes(s)
        );
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'tr'));
  }, [state.guests, q]);

  // g.totalSpent/totalStays sadece check-out an\u0131nda guncellenen "biriken"
  // alanlar — check-out yap\u0131lmam\u0131\u015f rezervasyonlarda hep 0 kal\u0131yordu.
  // Gercegi yans\u0131tmas\u0131 icin dogrudan odemelerden CANLI hesapl\u0131yoruz.
  const guestFinance = useMemo(() => {
    const map: Record<string, { spent: number; stays: number; resIds: string[] }> = {};
    state.reservations
      .filter((r) => !r.deletedAt && r.status !== 'cancelled')
      .forEach((r) => {
        if (!map[r.guestId]) map[r.guestId] = { spent: 0, stays: 0, resIds: [] };
        map[r.guestId].stays += 1;
        map[r.guestId].resIds.push(r.id);
      });
    state.payments
      .filter((p) => !p.deletedAt)
      .forEach((p) => {
        const res = state.reservations.find((r) => r.id === p.reservationId);
        if (!res) return;
        if (!map[res.guestId]) map[res.guestId] = { spent: 0, stays: 0, resIds: [] };
        map[res.guestId].spent += p.amount;
      });
    return map;
  }, [state.reservations, state.payments]);

  const openCreate = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (g: Guest) => {
    setEditId(g.id);
    setForm({
      firstName: g.firstName,
      lastName: g.lastName,
      email: g.email,
      phone: g.phone,
      idNumber: g.idNumber,
      nationality: g.nationality,
      address: g.address,
      notes: g.notes,
      vip: g.vip,
      blacklisted: g.blacklisted || false,
      blacklistReason: g.blacklistReason || '',
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.firstName || !form.lastName) return;
    if (editId) updateGuest(editId, form);
    else addGuest(form);
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Misafirler"
        subtitle="CRM · geçmiş konaklamalar, VIP ve iletişim bilgileri"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Yeni Misafir
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad, telefon veya TC/Pasaport ara..."
            className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </Card>

      {guests.length === 0 ? (
        <Card><EmptyState title="Misafir bulunamadı" /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {guests.map((g) => (
            <Card key={g.id} className={`p-4 ${g.blacklisted ? 'border-rose-300 bg-rose-50/40' : ''}`} onClick={() => setDetail(g)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-sm font-bold text-white">
                    {g.firstName[0]}{g.lastName[0]}
                  </div>
                  <div>
                    <p className="font-semibold flex items-center gap-1">
                      {g.firstName} {g.lastName}
                      {g.vip && <Star size={14} className="fill-amber-400 text-amber-400" />}
                    </p>
                    <p className="text-xs text-slate-500">{g.nationality} · {g.idNumber || 'TC/Pasaport yok'}</p>
                  </div>
                </div>
                <div className="flex" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(g)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Pencil size={14} /></button>
                  <button
                    onClick={() => {
                      if (confirm('Misafir arşive alınsın mı? (Kalıcı silinmez)')) deleteGuest(g.id);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {g.blacklisted && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                  <ShieldAlert size={13} /> KARA LİSTE
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <Badge>{guestFinance[g.id]?.stays ?? 0} konaklama</Badge>
                  <Badge color="teal">{formatCurrency(guestFinance[g.id]?.spent ?? 0)}</Badge>
                </div>
                {g.phone && (
                  <a
                    href={buildReviewWhatsAppLink(g.phone, g.firstName)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    title="WhatsApp'tan değerlendirme iste"
                  >
                    <MessageCircle size={13} /> Değerlendirme iste
                  </a>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">{g.phone || 'Telefon yok'}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Misafir Düzenle' : 'Yeni Misafir'} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Ad" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <Input label="Soyad" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <Input label="TC / Pasaport No" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
          <Input label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Uyruk" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
          <Input label="Adres" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="sm:col-span-2" />
          <Textarea label="Notlar" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="sm:col-span-2" />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.vip} onChange={(e) => setForm({ ...form, vip: e.target.checked })} />
            VIP misafir
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-rose-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.blacklisted}
              onChange={(e) => setForm({ ...form, blacklisted: e.target.checked })}
            />
            <ShieldAlert size={15} /> Kara listeye al
          </label>
          {form.blacklisted && (
            <Textarea
              label="Kara liste açıklaması (neden?)"
              value={form.blacklistReason}
              onChange={(e) => setForm({ ...form, blacklistReason: e.target.value })}
              className="sm:col-span-2"
            />
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
          <Button onClick={save}>Kaydet</Button>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.firstName} ${detail.lastName}` : ''}>
        {detail && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  openEdit(detail);
                  setDetail(null);
                }}
              >
                <Pencil size={13} /> Düzenle
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm('Misafir arşive alınsın mı? (Kalıcı silinmez)')) {
                    deleteGuest(detail.id);
                    setDetail(null);
                  }
                }}
              >
                <Trash2 size={13} className="text-rose-600" /> Sil
              </Button>
            </div>
            {detail.vip && <Badge color="amber">VIP Misafir</Badge>}
            {detail.blacklisted && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3">
                <ShieldAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />
                <div>
                  <p className="text-sm font-bold text-rose-700">KARA LİSTEDE</p>
                  {detail.blacklistReason && (
                    <p className="mt-0.5 text-sm text-rose-600">{detail.blacklistReason}</p>
                  )}
                </div>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">TC / Pasaport</dt><dd className="font-medium">{detail.idNumber || '—'}</dd></div>
              <div><dt className="text-slate-500">Telefon</dt><dd className="font-medium">{detail.phone || '—'}</dd></div>
              <div><dt className="text-slate-500">Uyruk</dt><dd className="font-medium">{detail.nationality}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Adres</dt><dd className="font-medium">{detail.address || '—'}</dd></div>
              <div><dt className="text-slate-500">Toplam Konaklama</dt><dd className="font-medium">{guestFinance[detail.id]?.stays ?? 0}</dd></div>
              <div><dt className="text-slate-500">Toplam Harcama</dt><dd className="font-medium">{formatCurrency(guestFinance[detail.id]?.spent ?? 0)}</dd></div>
              <div className="col-span-2">
                <dt className="text-slate-500">Ödeme Yöntemleri</dt>
                <dd className="font-medium">
                  {(guestFinance[detail.id]?.resIds || [])
                    .map((rid) => paymentMethodSummary(state.payments, rid))
                    .filter((s) => s !== 'Ödeme yok')
                    .join(', ') || 'Ödeme yok'}
                </dd>
              </div>
              <div className="col-span-2"><dt className="text-slate-500">Kayıt</dt><dd className="font-medium">{formatDate(detail.createdAt)}</dd></div>
            </dl>
            {detail.notes && <p className="rounded-xl bg-slate-50 p-3 text-sm">{detail.notes}</p>}
            {detail.phone && (
              <a
                href={buildReviewWhatsAppLink(detail.phone, detail.firstName)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                <MessageCircle size={16} /> WhatsApp'tan değerlendirme iste
              </a>
            )}
            <div>
              <p className="mb-2 text-sm font-semibold">Rezervasyon Geçmişi</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {state.reservations
                  .filter((r) => r.guestId === detail.id)
                  .map((r) => {
                    const room = state.rooms.find((x) => x.id === r.roomId);
                    return (
                      <div key={r.id} className="flex justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                        <span>{r.code} · Oda {room?.number}</span>
                        <span className="text-slate-500">{r.checkIn}</span>
                      </div>
                    );
                  })}
                {state.reservations.filter((r) => r.guestId === detail.id).length === 0 && (
                  <p className="text-sm text-slate-400">Henüz rezervasyon yok</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
