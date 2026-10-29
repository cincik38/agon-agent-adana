/**
 * Web sitesi (uyuroom.com) rezervasyon gelen kutusu.
 * Site, her yeni rezervasyonu bu veritabanındaki `web_reservations` tablosuna yazar.
 * Burada okunur; odası atanınca normal rezervasyona dönüştürülür ve satır "assigned" olur.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './teamSync';

export interface WebReservation {
  id: string;
  code: string;
  source: string;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  check_in: string;
  check_out: string;
  nights: number | null;
  adults: number | null;
  children: number | null;
  room_name: string | null;
  total_price: number | null;
  payment_method: string | null;
  special_requests: string | null;
  status: 'new' | 'assigned' | 'dismissed';
  pms_reservation_id: string | null;
  created_at: string;
}

export async function fetchWebReservations(status?: WebReservation['status']): Promise<WebReservation[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb.from('web_reservations').select('*').order('created_at', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({ ...r, total_price: r.total_price == null ? null : Number(r.total_price) })) as WebReservation[];
}

export async function markWebReservation(
  id: string,
  status: WebReservation['status'],
  pmsReservationId?: string
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Bağlantı yok');
  const { error } = await sb
    .from('web_reservations')
    .update({ status, pms_reservation_id: pmsReservationId ?? null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Bekleyen (oda atanmamış) web rezervasyonu sayısı — her 30 sn'de bir yenilenir. */
export function useWebInboxCount(intervalMs = 30000): number {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { count: c, error } = await sb
      .from('web_reservations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new');
    if (!error) setCount(c || 0);
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), intervalMs);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [load, intervalMs]);
  return count;
}

/** Oda bekleyen (status = new) web rezervasyonları — 30 sn'de bir ve odaklanınca yenilenir. */
export function useWebInbox(intervalMs = 30000): { items: WebReservation[]; reload: () => Promise<void> } {
  const [items, setItems] = useState<WebReservation[]>([]);
  const reload = useCallback(async () => {
    try {
      setItems(await fetchWebReservations('new'));
    } catch {
      /* bağlantı yoksa mevcut liste kalsın */
    }
  }, []);
  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), intervalMs);
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [reload, intervalMs]);
  return { items, reload };
}
