import type { ExtraCharge, Payment, Reservation } from './types';
import { daysBetween, PAY_METHOD_LABELS } from './utils';

export function nightsOf(res: Reservation): number {
  // Ayni gun giris-cikis (kisa sureli/gunduz konaklamasi) icin en az 1 gece
  // ucretlendirilir — 0 gece hesaplan\u0131p ucretsiz gorunmesin.
  return Math.max(1, daysBetween(res.checkIn, res.checkOut));
}

export function roomSubtotal(res: Reservation): number {
  return nightsOf(res) * res.nightlyRate;
}

export function extrasTotal(extras: ExtraCharge[]): number {
  return extras.reduce((s, e) => s + e.amount * e.quantity, 0);
}

export function discountAmount(res: Reservation): number {
  const base = roomSubtotal(res) + extrasTotal(res.extras);
  return Math.min(res.discount, base);
}

export function taxableAmount(res: Reservation): number {
  return Math.max(0, roomSubtotal(res) + extrasTotal(res.extras) - discountAmount(res));
}

export function taxAmount(res: Reservation): number {
  return Math.round(taxableAmount(res) * (res.taxRate / 100) * 100) / 100;
}

export function grandTotal(res: Reservation): number {
  // KDV misafirden tahsil edilen tutara eklenmiyor — girilen fiyat neyse o alinir.
  // (KDV hesaplamasi faturalandirma icin ayrica ele alinacak, taxAmount() fonksiyonu
  // o amacla hala kullanilabilir durumda birakildi.)
  return Math.round(taxableAmount(res) * 100) / 100;
}

export function paidTotal(payments: Payment[], reservationId: string): number {
  return payments
    .filter((p) => p.reservationId === reservationId && !p.deletedAt)
    .reduce((s, p) => s + p.amount, 0);
}

/** Bir rezervasyona ait odemelerin hangi yontem(ler)le yapildigini ozetler.
 * Tek yontemse "Kart" gibi, birden fazlaysa "Kart + Nakit" gibi doner. */
export function paymentMethodSummary(payments: Payment[], reservationId: string): string {
  const methods = Array.from(
    new Set(
      payments
        .filter((p) => p.reservationId === reservationId && !p.deletedAt && p.amount !== 0)
        .map((p) => p.method)
    )
  );
  if (methods.length === 0) return 'Ödeme yok';
  return methods.map((m) => PAY_METHOD_LABELS[m] || m).join(' + ');
}

export function balanceDue(res: Reservation, payments: Payment[]): number {
  return Math.round((grandTotal(res) - paidTotal(payments, res.id)) * 100) / 100;
}

export function derivePaymentStatus(
  res: Reservation,
  payments: Payment[]
): 'unpaid' | 'partial' | 'paid' | 'refunded' {
  const total = grandTotal(res);
  const related = payments.filter((p) => p.reservationId === res.id && !p.deletedAt);
  const paid = related.reduce((s, p) => s + p.amount, 0);
  if (related.some((p) => p.amount < 0) && paid <= 0) return 'refunded';
  if (paid <= 0) return 'unpaid';
  if (paid >= total - 0.01) return 'paid';
  return 'partial';
}
