import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, MessageCircle, PhoneCall, Plus, Minus } from 'lucide-react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Select } from '../components/ui';
import { formatCurrency, formatDateTime, buildMenuWhatsAppLink } from '../lib/utils';

export default function CafeOrders() {
  const { state, deliverCafeOrder, cancelCafeOrder, createCafeOrder, currentUser, pushToast } = useStore();
  const [tab, setTab] = useState<'pending' | 'delivered' | 'all'>('pending');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualResId, setManualResId] = useState('');
  const [manualCart, setManualCart] = useState<Record<string, number>>({});
  const [manualNote, setManualNote] = useState('');

  const orders = useMemo(() => {
    return (state.cafeOrders || [])
      .filter((o) => !o.deletedAt)
      .filter((o) => {
        if (tab === 'pending') return o.status === 'pending';
        if (tab === 'delivered') return o.status === 'delivered';
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.cafeOrders, tab]);

  const activeReservations = useMemo(
    () => state.reservations.filter((r) => !r.deletedAt && ['confirmed', 'checked_in'].includes(r.status)),
    [state.reservations]
  );
  const menu = useMemo(() => (state.menuItems || []).filter((m) => !m.deletedAt && m.available), [state.menuItems]);

  const openManual = () => {
    setManualResId(activeReservations[0]?.id || '');
    setManualCart({});
    setManualNote('');
    setManualOpen(true);
  };

  const manualTotal = Object.entries(manualCart).reduce((a, [id, qty]) => {
    const it = menu.find((m) => m.id === id);
    return a + (it ? it.price * qty : 0);
  }, 0);

  const submitManual = () => {
    const res = state.reservations.find((r) => r.id === manualResId);
    if (!res) {
      pushToast('err', 'Rezervasyon seçin');
      return;
    }
    const items = Object.entries(manualCart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const it = menu.find((m) => m.id === id)!;
        return { menuItemId: it.id, name: it.name, price: it.price, qty };
      });
    if (items.length === 0) {
      pushToast('err', 'En az bir ürün seçin');
      return;
    }
    const result = createCafeOrder({
      reservationId: res.id,
      guestId: res.guestId,
      roomId: res.roomId,
      items,
      note: manualNote || undefined,
      placedBy: currentUser?.name || 'Personel',
    });
    if (typeof result === 'object' && 'error' in result) {
      pushToast('err', result.error);
      return;
    }
    pushToast('ok', 'Sipariş eklendi');
    setManualOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Oda Servisi Siparişleri"
        subtitle="Misafirlerin WhatsApp üzerinden verdiği siparişler ve telefonla alınan siparişler burada listelenir"
        actions={
          <Button onClick={openManual}>
            <PhoneCall size={16} /> Telefon Siparişi Ekle
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <p className="mb-2 text-sm font-semibold">Misafire sipariş linki gönder</p>
        <p className="mb-3 text-xs text-slate-500">
          Bir rezervasyona tıkla, WhatsApp açılır, misafire menü linki hazır mesajla gönderilir.
        </p>
        <div className="flex flex-wrap gap-2">
          {activeReservations.slice(0, 12).map((r) => {
            const g = state.guests.find((x) => x.id === r.guestId);
            const room = state.rooms.find((x) => x.id === r.roomId);
            if (!g?.phone) return null;
            return (
              <a
                key={r.id}
                href={buildMenuWhatsAppLink(g.phone, g.firstName, `${window.location.origin}/order/${r.id}`)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                <MessageCircle size={12} className="text-emerald-600" />
                {r.code} · Oda {room?.number} · {g?.firstName}
              </a>
            );
          })}
          {activeReservations.length === 0 && (
            <p className="text-xs text-slate-400">Şu an aktif rezervasyon yok</p>
          )}
        </div>
      </Card>

      <Card className="mb-4 p-3">
        <div className="flex gap-2">
          {(['pending', 'delivered', 'all'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t === 'pending' ? 'Bekleyen' : t === 'delivered' ? 'Teslim Edilen' : 'Tümü'}
            </button>
          ))}
        </div>
      </Card>

      {orders.length === 0 ? (
        <Card><EmptyState title="Sipariş yok" /></Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const res = state.reservations.find((r) => r.id === o.reservationId);
            const guest = state.guests.find((g) => g.id === o.guestId);
            const room = state.rooms.find((r) => r.id === o.roomId);
            return (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      Oda {room?.number ?? '-'} · {guest?.firstName} {guest?.lastName}
                      <span className="ml-2 text-xs font-normal text-slate-400">{res?.code}</span>
                    </p>
                    <ul className="mt-1 text-sm text-slate-600">
                      {o.items.map((it, i) => (
                        <li key={i}>{it.qty}x {it.name} — {formatCurrency(it.price * it.qty)}</li>
                      ))}
                    </ul>
                    {o.note && <p className="mt-1 text-xs italic text-slate-400">Not: {o.note}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge color={o.status === 'pending' ? 'amber' : o.status === 'delivered' ? 'emerald' : 'rose'}>
                        {o.status === 'pending' ? 'Bekliyor' : o.status === 'delivered' ? 'Teslim Edildi' : 'İptal'}
                      </Badge>
                      {o.placedBy && (
                        <Badge color="violet">
                          <PhoneCall size={11} className="mr-1 inline" /> {o.placedBy}
                        </Badge>
                      )}
                      <span className="text-xs text-slate-400">{formatDateTime(o.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-teal-800">{formatCurrency(o.total)}</p>
                    {o.status === 'pending' && (
                      <div className="mt-2 flex gap-1">
                        <Button size="sm" onClick={() => deliverCafeOrder(o.id)}>
                          <CheckCircle2 size={14} /> Teslim Et
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelCafeOrder(o.id)}>
                          <XCircle size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Telefon Siparişi Ekle" wide>
        <div className="space-y-3">
          <Select label="Rezervasyon" value={manualResId} onChange={(e) => setManualResId(e.target.value)}>
            {activeReservations.map((r) => {
              const g = state.guests.find((x) => x.id === r.guestId);
              const room = state.rooms.find((x) => x.id === r.roomId);
              return (
                <option key={r.id} value={r.id}>
                  {r.code} · Oda {room?.number} · {g?.firstName} {g?.lastName}
                </option>
              );
            })}
          </Select>

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-100 p-2">
            {menu.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-slate-400">{formatCurrency(m.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setManualCart((c) => ({ ...c, [m.id]: Math.max(0, (c[m.id] || 0) - 1) }))}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-5 text-center text-sm font-bold">{manualCart[m.id] || 0}</span>
                  <button
                    onClick={() => setManualCart((c) => ({ ...c, [m.id]: (c[m.id] || 0) + 1 }))}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-700 text-white"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            ))}
            {menu.length === 0 && <p className="p-3 text-center text-xs text-slate-400">Önce Menü sayfasından ürün ekleyin</p>}
          </div>

          <textarea
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="Sipariş notu (opsiyonel)"
            className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-teal-500"
            rows={2}
          />

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-500">Toplam: <span className="font-bold text-slate-800">{formatCurrency(manualTotal)}</span></span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setManualOpen(false)}>İptal</Button>
              <Button onClick={submitManual}>Siparişi Ekle</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
