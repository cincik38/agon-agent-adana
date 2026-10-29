import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { Button, Modal, Select } from './ui';
import { formatDate, ROOM_TYPE_LABELS } from '../lib/utils';
import { markWebReservation, type WebReservation } from '../lib/webInbox';

const digits = (s?: string | null) => (s || '').replace(/\D/g, '');

/** Web rezervasyonuna oda atar: misafiri eşleştirir/oluşturur, normal rezervasyonu açar, gelen kutusu satırını kapatır. */
export default function WebAssignModal({
  item,
  initialRoomId,
  onClose,
  onDone,
}: {
  item: WebReservation | null;
  initialRoomId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { state, addGuest, addReservation, getAvailableRooms, pushToast } = useStore();
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRoomId(initialRoomId || '');
    setError('');
  }, [item, initialRoomId]);

  const availableRooms = useMemo(
    () => (item ? getAvailableRooms(item.check_in, item.check_out) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, state.reservations, state.rooms]
  );

  const assign = async () => {
    if (!item) return;
    if (!roomId) {
      setError('Bir oda seçin.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const phoneD = digits(item.guest_phone);
      const existing = phoneD
        ? state.guests.find((g) => !g.deletedAt && digits(g.phone).slice(-10) === phoneD.slice(-10))
        : undefined;
      let guestId = existing?.id;
      if (!guestId) {
        const parts = item.guest_name.trim().split(/\s+/);
        const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
        const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '-';
        guestId = addGuest({
          firstName,
          lastName,
          email: item.guest_email || '',
          phone: item.guest_phone || '',
          idNumber: '',
          nationality: 'TR',
          address: '',
          notes: 'Web sitesinden geldi',
          vip: false,
        });
      }
      const nights =
        item.nights ||
        Math.max(1, Math.round((Date.parse(item.check_out) - Date.parse(item.check_in)) / 86400000));
      const note = [
        `Web rezervasyonu ${item.code}`,
        item.payment_method ? `Ödeme: ${item.payment_method}` : '',
        item.room_name ? `İstenen oda: ${item.room_name}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const result = addReservation({
        guestId,
        roomId,
        checkIn: item.check_in,
        checkOut: item.check_out,
        checkOutTime: '11:00',
        adults: item.adults || 1,
        children: item.children || 0,
        status: 'confirmed',
        nightlyRate: item.total_price ? Math.round((item.total_price / nights) * 100) / 100 : 0,
        discount: 0,
        taxRate: state.settings.taxRate,
        deposit: 0,
        notes: note,
        source: 'Web Sitesi',
        specialRequests: item.special_requests || '',
      });
      if (typeof result === 'object' && 'error' in result) {
        setError(result.error);
        return;
      }
      await markWebReservation(item.id, 'assigned', result);
      pushToast('ok', `Web rezervasyonu ${item.code} odaya atandı`);
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    if (!item) return;
    if (!window.confirm(`${item.code} numaralı web rezervasyonu listeden kaldırılsın mı? (Rezervasyon oluşturulmaz)`)) return;
    try {
      await markWebReservation(item.id, 'dismissed');
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  };

  return (
    <Modal open={!!item} onClose={onClose} title="Web rezervasyonuna oda ata">
      {item && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 space-y-0.5">
            <p className="font-semibold text-slate-900">
              {item.guest_name} <span className="font-normal text-slate-500">· {item.code}</span>
            </p>
            <p>
              {formatDate(item.check_in)} → {formatDate(item.check_out)}
              {item.nights ? ` · ${item.nights} gece` : ''} · {item.adults ?? 1} yetişkin
              {item.children ? `, ${item.children} çocuk` : ''}
            </p>
            {item.guest_phone && <p>{item.guest_phone}</p>}
            {item.room_name && <p className="text-slate-500">İstenen oda: {item.room_name}</p>}
            {item.special_requests && <p className="text-amber-700">Özel istek: {item.special_requests}</p>}
          </div>
          <Select label="Müsait odalar" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Oda seçin…</option>
            {availableRooms.map((rm) => (
              <option key={rm.id} value={rm.id}>
                Oda {rm.number} · {ROOM_TYPE_LABELS[rm.type] || rm.type} · {rm.capacity} kişilik
              </option>
            ))}
          </Select>
          {availableRooms.length === 0 && <p className="text-sm text-rose-600">Bu tarihlerde müsait oda yok.</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => void dismiss()}>
              Listeden kaldır
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Vazgeç
              </Button>
              <Button onClick={() => void assign()} disabled={busy || !roomId}>
                {busy ? 'Kaydediliyor…' : 'Rezervasyonu oluştur'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
