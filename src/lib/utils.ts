export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatCurrency(amount: number, currency = 'TRY'): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Parse YYYY-MM-DD as local calendar date (avoids UTC day-shift). */
export function parseLocalDate(date: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  return new Date(date);
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  if (opts) return d.toLocaleDateString('tr-TR', opts);
  // Varsayilan format: 06.08.2026 — daha kolay okunur/anlasilir
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

/** Local timezone YYYY-MM-DD (not UTC). */
export function todayISO(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(start: string, end: string): number {
  const a = parseLocalDate(start).getTime();
  const b = parseLocalDate(end).getTime();
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

export function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date < end;
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Bir rezervasyonun gercekte hangi saat araligini kapladigini hesaplar
 * (YYYY-MM-DDTHH:mm formatinda, siralanabilir). Kisa sureli/gunduz
 * konaklama (checkIn===checkOut) dahil dogru sonuc verir — bu sayede
 * ayni oda ayni gun icinde farkli saatlerde birden fazla kez
 * kullanilabilir, sadece gercekten cakisan saatler engellenir. */
export function reservationTimeRange(
  checkIn: string,
  checkOut: string,
  checkInTime: string | undefined,
  checkOutTime: string | undefined,
  defaultCheckInTime = '14:00',
  defaultCheckOutTime = '12:00'
): { start: string; end: string } {
  const ciTime = checkInTime || defaultCheckInTime;
  const coTime = checkOutTime || defaultCheckOutTime;
  return {
    start: `${checkIn}T${ciTime}`,
    end: `${checkOut}T${coTime}`,
  };
}

/** Saat farkindaligi olan cakisma kontrolu — iki rezervasyonun gercekten
 * ayni saat araliginda ayni odayi istedigini dogrular. */
export function reservationsOverlap(
  a: { checkIn: string; checkOut: string; checkInTime?: string; checkOutTime?: string },
  b: { checkIn: string; checkOut: string; checkInTime?: string; checkOutTime?: string },
  defaultCI = '14:00',
  defaultCO = '12:00'
): boolean {
  const ra = reservationTimeRange(a.checkIn, a.checkOut, a.checkInTime, a.checkOutTime, defaultCI, defaultCO);
  const rb = reservationTimeRange(b.checkIn, b.checkOut, b.checkInTime, b.checkOutTime, defaultCI, defaultCO);
  return ra.start < rb.end && rb.start < ra.end;
}

/** Sıralı rezervasyon kodu: UYU-0001, UYU-0002, … UYU-1000, UYU-10000 */
export function formatReservationCode(seq: number): string {
  const n = Math.max(1, Math.floor(seq));
  const width = Math.max(4, String(n).length);
  return `UYU-${String(n).padStart(width, '0')}`;
}

/** Eski kodlardan veya mevcut listeden en yüksek sıra numarasını bul */
export function maxReservationSeq(codes: string[]): number {
  let max = 0;
  for (const code of codes) {
    const m = /UYU-0*(\d+)/i.exec(code);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

/** @deprecated use formatReservationCode with seq */
export function reservationCode(seq?: number): string {
  if (typeof seq === 'number') return formatReservationCode(seq);
  return formatReservationCode(1);
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') inQ = false;
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') {
          result.push(cur);
          cur = '';
        } else cur += c;
      }
    }
    result.push(cur);
    return result;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = vals[i] ?? '';
    });
    return obj;
  });
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const ROOM_TYPE_LABELS: Record<string, string> = {
  economy: 'Ekonomi',
  standard: 'Standart',
  deluxe: 'Deluxe',
  suite: 'Suit',
  family: 'Aile',
  presidential: 'Presidential',
};

export const ROOM_STATUS_LABELS: Record<string, string> = {
  available: 'Müsait',
  occupied: 'Dolu',
  cleaning: 'Temizleniyor',
  maintenance: 'Bakımda',
  out_of_order: 'Kullanım Dışı',
};

export const RES_STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  confirmed: 'Onaylı',
  checked_in: 'Giriş Yapıldı',
  checked_out: 'Çıkış Yapıldı',
  cancelled: 'İptal',
  no_show: 'Gelmedi',
};

export const PAY_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Ödenmedi',
  partial: 'Kısmi',
  paid: 'Ödendi',
  refunded: 'İade',
};

export const HK_STATUS_LABELS: Record<string, string> = {
  clean: 'Temiz',
  dirty: 'Kirli',
  in_progress: 'Temizleniyor',
  inspected: 'Kontrol Edildi',
  do_not_disturb: 'Rahatsız Etmeyin',
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Yönetici',
  manager: 'Müdür',
  receptionist: 'Resepsiyon',
  housekeeping: 'Kat Hizmetleri',
  accountant: 'Muhasebe',
  concierge: 'Concierge',
};

export const PAY_METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  online: 'Online',
  other: 'Diğer',
};


export const LEDGER_CATEGORY_LABELS: Record<string, string> = {
  oda_geliri: 'Oda Geliri',
  ekstra_gelir: 'Ekstra Gelir',
  yiyecek_icecek: 'Yiyecek & İçecek',
  spa: 'Spa / Wellness',
  diger_gelir: 'Diğer Gelir',
  personel_maas: 'Personel Maaşı',
  sgk_vergi: 'SGK / İşveren Payı',
  elektrik: 'Elektrik',
  su: 'Su',
  dogalgaz: 'Doğalgaz',
  internet: 'İnternet / Telefon',
  kira: 'Kira',
  bakim_onarim: 'Bakım & Onarım',
  temizlik_malzeme: 'Temizlik Malzemesi',
  market_gida: 'Market / Gıda',
  pazarlama: 'Pazarlama',
  sigorta: 'Sigorta',
  vergi_harc: 'Vergi & Harç',
  ulasim: 'Ulaşım',
  yazilim: 'Yazılım / Abonelik',
  diger_gider: 'Diğer Gider',
};

export const INCOME_CATEGORIES = ['oda_geliri', 'ekstra_gelir', 'yiyecek_icecek', 'spa', 'diger_gelir'] as const;
export const EXPENSE_CATEGORIES = [
  'personel_maas', 'sgk_vergi', 'elektrik', 'su', 'dogalgaz', 'internet', 'kira',
  'bakim_onarim', 'temizlik_malzeme', 'market_gida', 'pazarlama', 'sigorta',
  'vergi_harc', 'ulasim', 'yazilim', 'diger_gider',
] as const;

export const GOOGLE_REVIEW_LINK = 'https://g.page/r/CTHFsgTPfnlyEBM/review';

/** Turkiye telefon numarasini WhatsApp (wa.me) formatina cevirir: 90XXXXXXXXXX */
export function toWhatsAppNumber(phone: string): string {
  let p = (phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = p.slice(1);
  if (!p.startsWith('90')) p = '90' + p;
  return p;
}

/** Google degerlendirme istegi icin WhatsApp linki uretir */
export function buildReviewWhatsAppLink(phone: string, guestFirstName: string): string {
  const num = toWhatsAppNumber(phone);
  const msg =
    `Merhaba ${guestFirstName}, UYU ROOM HOTEL'de bizi tercih ettiğiniz için teşekkür ederiz! ` +
    `Deneyiminizi bizimle paylaşırsanız çok mutlu oluruz 🙏 ` +
    `Google üzerinden değerlendirme bırakmak için: ${GOOGLE_REVIEW_LINK}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

/** Secilen resmi kucultup base64 (JPEG) olarak dondurur — menu urun fotograflari icin */
export function resizeImageToDataUrl(file: File, maxSize = 480, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Görsel yüklenemedi'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas desteklenmiyor'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Secilen resmi kucultup Blob (JPEG) olarak dondurur — Supabase Storage'a yuklemek icin */
export function resizeImageToBlob(file: File, maxSize = 900, quality = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Görsel yüklenemedi'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas desteklenmiyor'));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Blob oluşturulamadı'))),
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Bir muhasebe kaydinin saatini (time alani yoksa createdAt'ten) HH:mm olarak dondurur */
export function entryTime(e: { time?: string; createdAt?: string }): string {
  if (e.time && /^\d{1,2}:\d{2}/.test(e.time)) {
    const [h, m] = e.time.split(':');
    return `${h.padStart(2, '0')}:${m.slice(0, 2).padStart(2, '0')}`;
  }
  if (e.createdAt) {
    const d = new Date(e.createdAt);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  return '12:00';
}

/** Bir muhasebe kaydinin tam zaman damgasi (YYYY-MM-DDTHH:mm), gun donumu
 * kar\u015f\u0131la\u015ft\u0131rmalar\u0131 icin */
export function entryStamp(e: { date: string; time?: string; createdAt?: string }): string {
  return `${e.date.slice(0, 10)}T${entryTime(e)}`;
}

/** Otel gun donumu (07:00) — verilen gunun 07:00'inden bir onceki gunun
 * 07:00'ine kadar olan araligi dondurur. Oteller gece yar\u0131s\u0131 degil sabah
 * 07:00'de "gun kapat\u0131r", raporlar bu saate gore hesaplan\u0131r. */
export const HOTEL_DAY_START = '07:00';
export function hotelDayRange(anchorDateISO: string): { fromStamp: string; toStamp: string } {
  return {
    fromStamp: `${addDays(anchorDateISO, -1)}T${HOTEL_DAY_START}`,
    toStamp: `${anchorDateISO}T${HOTEL_DAY_START}`,
  };
}

/** Su an icinde bulundugumuz (henuz kapanmamis) gun donumunun "capa" tarihini
 * dondurur. Gun donumu sabah 07:00'de kapand\u0131g\u0131 icin: saat 07:00'i
 * gectiyse icinde bulundugumuz aç\u0131k pencere BUGUN 07:00 - YARIN 07:00
 * arasidir (capa = yarin); hen\u00fcz gecmediyse aç\u0131k pencere DUN 07:00 -
 * BUGUN 07:00 arasidir (capa = bugun). */
export function currentHotelDayAnchor(): string {
  const now = new Date();
  return now.getHours() >= 7 ? addDays(todayISO(), 1) : todayISO();
}

/** Verilen toStamp'i "su an"la sinirlar — henuz gelmemis (gelecekteki)
 * bir kapanis saatine kadar degil, sadece o ana kadarki veriler gorulsun. */
export function capStampAtNow(toStamp: string): string {
  const now = new Date();
  const nowStamp = `${todayISO()}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return toStamp < nowStamp ? toStamp : nowStamp;
}

/** Misafire oda servisi menu linkini WhatsApp'tan gondermek icin link uretir */
export function buildMenuWhatsAppLink(phone: string, guestFirstName: string, orderUrl: string): string {
  const num = toWhatsAppNumber(phone);
  const msg =
    `Merhaba ${guestFirstName}, oda servisi menümüze buradan göz atıp doğrudan sipariş verebilirsiniz: ${orderUrl}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

/** Rota yolu -> Turkce sayfa adi — canli personel takibi ve benzeri
 * yerlerde hangi sayfada olunduğunu gostermek icin kullanilir. */
export const PAGE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/rooms': 'Odalar',
  '/reservations': 'Rezervasyonlar',
  '/calendar': 'Takvim / Doluluk',
  '/guests': 'Misafirler',
  '/front-desk': 'Resepsiyon',
  '/housekeeping': 'Kat Hizmetleri',
  '/maintenance': 'Arıza & Teknik İşler',
  '/payments': 'Ödemeler',
  '/invoices': 'Faturalar',
  '/accounting': 'Finansal Muhasebe',
  '/menu': 'Menü / Ürünler',
  '/orders': 'Oda Servisi Siparişleri',
  '/settings': 'Ayarlar',
  '/staff': 'Personel',
  '/reports': 'Raporlar',
  '/activity': 'İşlem Kayıtları',
};
export function pageLabel(path: string): string {
  return PAGE_LABELS[path] || path;
}
