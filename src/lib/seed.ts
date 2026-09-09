import type { AppState } from './types';
import { addDays, todayISO, uid } from './utils';

const t = todayISO();

export function createSeedData(): AppState {
  const rooms = [
    { id: 'r1', number: '101', floor: 1, type: 'economy' as const, status: 'available' as const, housekeeping: 'clean' as const, capacity: 2, beds: '1 Çift Kişilik', pricePerNight: 1800, amenities: ['Wi-Fi', 'TV', 'Klima'], description: 'Konforlu ekonomi oda', lastCleaned: t },
    { id: 'r2', number: '102', floor: 1, type: 'standard' as const, status: 'occupied' as const, housekeeping: 'do_not_disturb' as const, capacity: 2, beds: '1 Çift Kişilik', pricePerNight: 2500, amenities: ['Wi-Fi', 'TV', 'Klima', 'Minibar'], description: 'Standart oda şehir manzaralı', lastCleaned: addDays(t, -1) },
    { id: 'r3', number: '103', floor: 1, type: 'standard' as const, status: 'available' as const, housekeeping: 'clean' as const, capacity: 2, beds: '2 Tek Kişilik', pricePerNight: 2400, amenities: ['Wi-Fi', 'TV', 'Klima', 'Minibar'], description: 'Standart twin oda', lastCleaned: t },
    { id: 'r4', number: '104', floor: 1, type: 'deluxe' as const, status: 'cleaning' as const, housekeeping: 'in_progress' as const, capacity: 2, beds: '1 King', pricePerNight: 3800, amenities: ['Wi-Fi', 'TV', 'Klima', 'Minibar', 'Jakuzi'], description: 'Deluxe oda jakuzili', lastCleaned: addDays(t, -2) },
    { id: 'r5', number: '201', floor: 2, type: 'deluxe' as const, status: 'occupied' as const, housekeeping: 'dirty' as const, capacity: 3, beds: '1 King + 1 Sofa', pricePerNight: 4200, amenities: ['Wi-Fi', 'TV', 'Klima', 'Minibar', 'Balkon'], description: 'Deluxe balkonlu oda', lastCleaned: addDays(t, -3) },
    { id: 'r6', number: '202', floor: 2, type: 'suite' as const, status: 'available' as const, housekeeping: 'clean' as const, capacity: 4, beds: '1 King + 1 Queen', pricePerNight: 6500, amenities: ['Wi-Fi', 'TV', 'Klima', 'Minibar', 'Oturma Alanı', 'Bornoz'], description: 'Geniş suit oda', lastCleaned: t },
    { id: 'r7', number: '203', floor: 2, type: 'family' as const, status: 'available' as const, housekeeping: 'inspected' as const, capacity: 5, beds: '1 King + 2 Twin', pricePerNight: 5500, amenities: ['Wi-Fi', 'TV', 'Klima', 'Minibar', 'Mutfakette'], description: 'Aile odası', lastCleaned: t },
    { id: 'r8', number: '204', floor: 2, type: 'standard' as const, status: 'maintenance' as const, housekeeping: 'dirty' as const, capacity: 2, beds: '1 Çift Kişilik', pricePerNight: 2500, amenities: ['Wi-Fi', 'TV', 'Klima'], description: 'Bakımda - klima arızası', lastCleaned: addDays(t, -5) },
    { id: 'r9', number: '301', floor: 3, type: 'suite' as const, status: 'occupied' as const, housekeeping: 'clean' as const, capacity: 3, beds: '1 King', pricePerNight: 7200, amenities: ['Wi-Fi', 'TV', 'Klima', 'Minibar', 'Deniz Manzarası', 'Bornoz'], description: 'Premium suit deniz manzaralı', lastCleaned: addDays(t, -1) },
    { id: 'r10', number: '302', floor: 3, type: 'presidential' as const, status: 'available' as const, housekeeping: 'clean' as const, capacity: 6, beds: '2 King', pricePerNight: 15000, amenities: ['Wi-Fi', 'TV', 'Klima', 'Minibar', 'Jakuzi', 'Butler', 'Deniz Manzarası', 'Özel Teras'], description: 'Presidential suite — en üst seviye konfor', lastCleaned: t },
    { id: 'r11', number: '303', floor: 3, type: 'deluxe' as const, status: 'available' as const, housekeeping: 'clean' as const, capacity: 2, beds: '1 King', pricePerNight: 4000, amenities: ['Wi-Fi', 'TV', 'Klima', 'Minibar', 'Balkon'], description: 'Deluxe üst kat', lastCleaned: t },
    { id: 'r12', number: '304', floor: 3, type: 'economy' as const, status: 'out_of_order' as const, housekeeping: 'dirty' as const, capacity: 2, beds: '1 Çift', pricePerNight: 1700, amenities: ['Wi-Fi', 'TV'], description: 'Renovasyon nedeniyle kapalı', lastCleaned: addDays(t, -10) },
  ];

  const guests = [
    { id: 'g1', firstName: 'Ayşe', lastName: 'Yılmaz', email: 'ayse.yilmaz@email.com', phone: '+90 532 111 2233', idNumber: '12345678901', nationality: 'TR', address: 'Kadıköy, İstanbul', notes: 'Yüksek kat tercih eder', vip: true, createdAt: addDays(t, -60), totalStays: 4, totalSpent: 28500 },
    { id: 'g2', firstName: 'Mehmet', lastName: 'Kaya', email: 'mehmet.kaya@email.com', phone: '+90 533 222 3344', idNumber: '23456789012', nationality: 'TR', address: 'Çankaya, Ankara', notes: '', vip: false, createdAt: addDays(t, -30), totalStays: 1, totalSpent: 7500 },
    { id: 'g3', firstName: 'Elena', lastName: 'Petrova', email: 'elena.p@email.com', phone: '+7 916 555 0199', idNumber: 'P99887766', nationality: 'RU', address: 'Moscow', notes: 'İngilizce konuşur', vip: true, createdAt: addDays(t, -90), totalStays: 6, totalSpent: 92000 },
    { id: 'g4', firstName: 'John', lastName: 'Smith', email: 'john.smith@email.com', phone: '+1 212 555 0101', idNumber: 'US445566', nationality: 'US', address: 'New York, NY', notes: 'İş seyahati', vip: false, createdAt: addDays(t, -15), totalStays: 2, totalSpent: 14800 },
    { id: 'g5', firstName: 'Zeynep', lastName: 'Demir', email: 'zeynep.demir@email.com', phone: '+90 535 444 5566', idNumber: '34567890123', nationality: 'TR', address: 'Alsancak, İzmir', notes: 'Bebek yatağı gerekli', vip: false, createdAt: addDays(t, -10), totalStays: 1, totalSpent: 0 },
    { id: 'g6', firstName: 'Hans', lastName: 'Müller', email: 'hans.m@email.com', phone: '+49 170 1234567', idNumber: 'DE112233', nationality: 'DE', address: 'Berlin', notes: 'Erken check-in istedi', vip: false, createdAt: addDays(t, -5), totalStays: 0, totalSpent: 0 },
    { id: 'g7', firstName: 'Fatma', lastName: 'Öztürk', email: 'fatma.o@email.com', phone: '+90 536 777 8899', idNumber: '45678901234', nationality: 'TR', address: 'Nilüfer, Bursa', notes: '', vip: false, createdAt: addDays(t, -45), totalStays: 3, totalSpent: 21000 },
    { id: 'g8', firstName: 'Sophie', lastName: 'Martin', email: 's.martin@email.com', phone: '+33 6 12 34 56 78', idNumber: 'FR778899', nationality: 'FR', address: 'Paris', notes: 'Glutensiz kahvaltı', vip: true, createdAt: addDays(t, -20), totalStays: 2, totalSpent: 34000 },
  ];

  const reservations = [
    {
      id: 'res1', code: 'UYU-0001', guestId: 'g1', roomId: 'r2',
      checkIn: addDays(t, -2), checkOut: addDays(t, 2), adults: 2, children: 0,
      status: 'checked_in' as const, paymentStatus: 'partial' as const,
      nightlyRate: 2500, extras: [{ id: 'ex1', name: 'Minibar', amount: 350, quantity: 1, date: t, category: 'F&B' }],
      companions: [],
      discount: 0, taxRate: 10, deposit: 1000, notes: 'Geç check-out mümkünse', source: 'Doğrudan',
      createdAt: addDays(t, -10), checkedInAt: addDays(t, -2) + 'T14:30:00', specialRequests: 'Sessiz oda',
    },
    {
      id: 'res2', code: 'UYU-0002', guestId: 'g3', roomId: 'r5',
      checkIn: addDays(t, -1), checkOut: addDays(t, 3), adults: 2, children: 1,
      status: 'checked_in' as const, paymentStatus: 'paid' as const,
      nightlyRate: 4200, extras: [
        { id: 'ex2', name: 'Spa', amount: 1200, quantity: 1, date: t, category: 'Spa' },
        { id: 'ex3', name: 'Room Service', amount: 480, quantity: 2, date: t, category: 'F&B' },
      ],
      companions: [],
      discount: 500, taxRate: 10, deposit: 2000, notes: '', source: 'Booking.com',
      createdAt: addDays(t, -20), checkedInAt: addDays(t, -1) + 'T15:00:00', specialRequests: 'Bebek yatağı',
    },
    {
      id: 'res3', code: 'UYU-0003', guestId: 'g4', roomId: 'r9',
      checkIn: t, checkOut: addDays(t, 4), adults: 1, children: 0,
      status: 'checked_in' as const, paymentStatus: 'partial' as const,
      nightlyRate: 7200, extras: [],
      companions: [], discount: 0, taxRate: 10, deposit: 3000, notes: 'İş toplantısı için erken kahvaltı',
      source: 'Expedia', createdAt: addDays(t, -7), checkedInAt: t + 'T13:15:00', specialRequests: '',
    },
    {
      id: 'res4', code: 'UYU-0004', guestId: 'g5', roomId: 'r6',
      checkIn: t, checkOut: addDays(t, 3), adults: 2, children: 2,
      status: 'confirmed' as const, paymentStatus: 'unpaid' as const,
      nightlyRate: 6500, extras: [],
      companions: [], discount: 0, taxRate: 10, deposit: 0, notes: '',
      source: 'Doğrudan', createdAt: addDays(t, -3), specialRequests: 'Birleştirilmiş yataklar',
    },
    {
      id: 'res5', code: 'UYU-0005', guestId: 'g6', roomId: 'r11',
      checkIn: addDays(t, 1), checkOut: addDays(t, 5), adults: 2, children: 0,
      status: 'confirmed' as const, paymentStatus: 'partial' as const,
      nightlyRate: 4000, extras: [],
      companions: [], discount: 200, taxRate: 10, deposit: 1500, notes: 'Havalimanı transferi',
      source: 'Hotels.com', createdAt: addDays(t, -5), specialRequests: 'Erken check-in',
    },
    {
      id: 'res6', code: 'UYU-0006', guestId: 'g2', roomId: 'r3',
      checkIn: addDays(t, 2), checkOut: addDays(t, 4), adults: 1, children: 0,
      status: 'pending' as const, paymentStatus: 'unpaid' as const,
      nightlyRate: 2400, extras: [],
      companions: [], discount: 0, taxRate: 10, deposit: 0, notes: 'Onay bekleniyor',
      source: 'Telefon', createdAt: t, specialRequests: '',
    },
    {
      id: 'res7', code: 'UYU-0007', guestId: 'g7', roomId: 'r1',
      checkIn: addDays(t, -5), checkOut: addDays(t, -2), adults: 2, children: 0,
      status: 'checked_out' as const, paymentStatus: 'paid' as const,
      nightlyRate: 1800, extras: [{ id: 'ex4', name: 'Çamaşır', amount: 250, quantity: 1, date: addDays(t, -3), category: 'Hizmet' }],
      companions: [],
      discount: 0, taxRate: 10, deposit: 500, notes: '', source: 'Doğrudan',
      createdAt: addDays(t, -12), checkedInAt: addDays(t, -5) + 'T14:00:00', checkedOutAt: addDays(t, -2) + 'T11:20:00', specialRequests: '',
    },
    {
      id: 'res8', code: 'UYU-0008', guestId: 'g8', roomId: 'r10',
      checkIn: addDays(t, 7), checkOut: addDays(t, 10), adults: 2, children: 0,
      status: 'confirmed' as const, paymentStatus: 'partial' as const,
      nightlyRate: 15000, extras: [],
      companions: [], discount: 1000, taxRate: 10, deposit: 5000, notes: 'Balayı paketi',
      source: 'Doğrudan', createdAt: addDays(t, -14), specialRequests: 'Şampanya ve çiçek',
    },
    {
      id: 'res9', code: 'UYU-0009', guestId: 'g1', roomId: 'r7',
      checkIn: addDays(t, 14), checkOut: addDays(t, 18), adults: 3, children: 2,
      status: 'confirmed' as const, paymentStatus: 'unpaid' as const,
      nightlyRate: 5500, extras: [],
      companions: [], discount: 0, taxRate: 10, deposit: 0, notes: 'Aile tatili',
      source: 'Booking.com', createdAt: addDays(t, -2), specialRequests: 'İki bebek yatağı',
    },
    {
      id: 'res10', code: 'UYU-0010', guestId: 'g4', roomId: 'r4',
      checkIn: addDays(t, -8), checkOut: addDays(t, -6), adults: 2, children: 0,
      status: 'cancelled' as const, paymentStatus: 'refunded' as const,
      nightlyRate: 3800, extras: [],
      companions: [], discount: 0, taxRate: 10, deposit: 0, notes: 'İptal edildi - uçuş iptali',
      source: 'Expedia', createdAt: addDays(t, -15), specialRequests: '',
    },
  ];

  const payments = [
    { id: 'p1', reservationId: 'res1', amount: 1000, method: 'card' as const, date: addDays(t, -10), note: 'Depozito', receivedBy: 'Elif Acar' },
    { id: 'p2', reservationId: 'res1', amount: 4000, method: 'card' as const, date: addDays(t, -2), note: 'Kısmi ödeme', receivedBy: 'Elif Acar' },
    { id: 'p3', reservationId: 'res2', amount: 2000, method: 'online' as const, date: addDays(t, -20), note: 'Online depozito', receivedBy: 'Sistem' },
    { id: 'p4', reservationId: 'res2', amount: 17056, method: 'card' as const, date: addDays(t, -1), note: 'Kalan bakiye', receivedBy: 'Can Yıldız' },
    { id: 'p5', reservationId: 'res3', amount: 3000, method: 'transfer' as const, date: addDays(t, -7), note: 'Havale depozito', receivedBy: 'Sistem' },
    { id: 'p6', reservationId: 'res5', amount: 1500, method: 'online' as const, date: addDays(t, -5), note: 'Online ön ödeme', receivedBy: 'Sistem' },
    { id: 'p7', reservationId: 'res7', amount: 6195, method: 'cash' as const, date: addDays(t, -2), note: 'Çıkış ödemesi', receivedBy: 'Elif Acar' },
    { id: 'p8', reservationId: 'res8', amount: 5000, method: 'card' as const, date: addDays(t, -14), note: 'Balayı depozito', receivedBy: 'Can Yıldız' },
    { id: 'p9', reservationId: 'res10', amount: -760, method: 'card' as const, date: addDays(t, -6), note: 'İade', receivedBy: 'Müdür' },
  ];

  const staff = [
    { id: 's1', name: 'Yönetici', email: 'yonetici@uyuroom.com', phone: '+90 532 000 0001', role: 'admin' as const, active: true, shift: 'Tam Zamanlı', department: 'Yönetim', hiredAt: '2020-01-15', username: 'UYUROOM', password: '180364', salary: 85000 },
    { id: 's2', name: 'Elif Acar', email: 'resepsiyon@uyuroom.com', phone: '+90 532 000 0002', role: 'receptionist' as const, active: true, shift: '08:00-16:00', department: 'Resepsiyon', hiredAt: '2021-06-01', username: 'UYURESEP', password: 'Resep364', salary: 42000 },
    { id: 's3', name: 'Can Yıldız', email: 'can@uyuroom.com', phone: '+90 532 000 0003', role: 'receptionist' as const, active: true, shift: '16:00-00:00', department: 'Resepsiyon', hiredAt: '2022-03-12', salary: 40000 },
    { id: 's4', name: 'Selin Arslan', email: 'selin@uyuroom.com', phone: '+90 532 000 0004', role: 'housekeeping' as const, active: true, shift: '08:00-16:00', department: 'Kat Hizmetleri', hiredAt: '2021-09-20', salary: 32000 },
    { id: 's5', name: 'Burak Şahin', email: 'burak@uyuroom.com', phone: '+90 532 000 0005', role: 'housekeeping' as const, active: true, shift: '08:00-16:00', department: 'Kat Hizmetleri', hiredAt: '2023-01-08', salary: 31000 },
    { id: 's6', name: 'Ayhan Çelik', email: 'mudur@uyuroom.com', phone: '+90 532 000 0006', role: 'manager' as const, active: true, shift: '09:00-18:00', department: 'Operasyon', hiredAt: '2019-04-01', username: 'UYUMUDUR', password: 'Mudur364', salary: 65000 },
    { id: 's7', name: 'Merve Aksoy', email: 'merve@uyuroom.com', phone: '+90 532 000 0007', role: 'accountant' as const, active: true, shift: '09:00-17:00', department: 'Muhasebe', hiredAt: '2022-11-15', salary: 48000 },
    { id: 's8', name: 'Emre Koç', email: 'emre@uyuroom.com', phone: '+90 532 000 0008', role: 'concierge' as const, active: true, shift: '10:00-18:00', department: 'Misafir Hizmetleri', hiredAt: '2023-05-22', salary: 35000 },
  ];

  const tasks = [
    { id: 't1', roomId: 'r4', assignedTo: 's4', status: 'in_progress' as const, priority: 'high' as const, type: 'Çıkış Temizliği', notes: 'Derin temizlik', createdAt: t + 'T09:00:00' },
    { id: 't2', roomId: 'r5', assignedTo: 's5', status: 'open' as const, priority: 'medium' as const, type: 'Günlük Temizlik', notes: '', createdAt: t + 'T08:30:00' },
    { id: 't3', roomId: 'r8', assignedTo: 's5', status: 'open' as const, priority: 'urgent' as const, type: 'Bakım Bildirimi', notes: 'Klima çalışmıyor - teknik ekibe iletildi', createdAt: addDays(t, -1) + 'T11:00:00' },
    { id: 't4', roomId: 'r12', assignedTo: undefined, status: 'open' as const, priority: 'low' as const, type: 'Renovasyon', notes: 'Banyo yenileme devam ediyor', createdAt: addDays(t, -10) + 'T10:00:00' },
    { id: 't5', roomId: 'r2', assignedTo: 's4', status: 'done' as const, priority: 'medium' as const, type: 'Günlük Temizlik', notes: 'Tamamlandı', createdAt: addDays(t, -1) + 'T09:00:00', completedAt: addDays(t, -1) + 'T11:30:00' },
  ];

  const activity = [
    { id: uid('act'), type: 'checkin', message: 'John Smith oda 301\'e giriş yaptı', user: 'Elif Acar', timestamp: t + 'T13:15:00', relatedId: 'res3' },
    { id: uid('act'), type: 'payment', message: 'UYU-0002 için 17.056 ₺ ödeme alındı', user: 'Can Yıldız', timestamp: addDays(t, -1) + 'T15:30:00', relatedId: 'res2' },
    { id: uid('act'), type: 'reservation', message: 'Yeni rezervasyon: UYU-0006 (Mehmet Kaya)', user: 'Elif Acar', timestamp: t + 'T10:20:00', relatedId: 'res6' },
    { id: uid('act'), type: 'housekeeping', message: 'Oda 104 temizliği başlatıldı', user: 'Selin Arslan', timestamp: t + 'T09:05:00', relatedId: 't1' },
    { id: uid('act'), type: 'checkout', message: 'Fatma Öztürk oda 101\'den çıkış yaptı', user: 'Elif Acar', timestamp: addDays(t, -2) + 'T11:20:00', relatedId: 'res7' },
    { id: uid('act'), type: 'reservation', message: 'Rezervasyon iptal: UYU-0010', user: 'Ayhan Çelik', timestamp: addDays(t, -6) + 'T16:00:00', relatedId: 'res10' },
  ];


  const ledger = [
    { id: 'l1', date: addDays(t, -25), time: '09:11', type: 'expense' as const, category: 'kira' as const, description: 'Aylık otel binası kirası', amount: 180000, method: 'transfer' as const, createdAt: addDays(t, -25), createdBy: 'Sistem' },
    { id: 'l2', date: addDays(t, -20), time: '10:22', type: 'expense' as const, category: 'elektrik' as const, description: 'Elektrik faturası', amount: 28500, method: 'transfer' as const, createdAt: addDays(t, -20), createdBy: 'Sistem' },
    { id: 'l3', date: addDays(t, -18), time: '11:33', type: 'expense' as const, category: 'su' as const, description: 'Su faturası', amount: 6400, method: 'transfer' as const, createdAt: addDays(t, -18), createdBy: 'Sistem' },
    { id: 'l4', date: addDays(t, -18), time: '12:44', type: 'expense' as const, category: 'dogalgaz' as const, description: 'Doğalgaz faturası', amount: 9200, method: 'transfer' as const, createdAt: addDays(t, -18), createdBy: 'Sistem' },
    { id: 'l5', date: addDays(t, -15), time: '13:55', type: 'expense' as const, category: 'internet' as const, description: 'İnternet + santral', amount: 4500, method: 'card' as const, createdAt: addDays(t, -15), createdBy: 'Sistem' },
    { id: 'l6', date: addDays(t, -12), time: '14:06', type: 'expense' as const, category: 'market_gida' as const, description: 'Kahvaltı / minibar stok', amount: 18750, method: 'cash' as const, createdAt: addDays(t, -12), createdBy: 'Elif Acar' },
    { id: 'l7', date: addDays(t, -10), time: '15:17', type: 'expense' as const, category: 'temizlik_malzeme' as const, description: 'Kat hizmetleri malzemesi', amount: 5300, method: 'cash' as const, createdAt: addDays(t, -10), createdBy: 'Selin Arslan' },
    { id: 'l8', date: addDays(t, -8), time: '16:28', type: 'expense' as const, category: 'personel_maas' as const, description: 'Maaş: Yönetici', amount: 85000, method: 'salary' as const, staffId: 's1', createdAt: addDays(t, -8), createdBy: 'Sistem' },
    { id: 'l9', date: addDays(t, -8), time: '17:39', type: 'expense' as const, category: 'personel_maas' as const, description: 'Maaş: Elif Acar', amount: 42000, method: 'salary' as const, staffId: 's2', createdAt: addDays(t, -8), createdBy: 'Sistem' },
    { id: 'l10', date: addDays(t, -8), time: '18:50', type: 'expense' as const, category: 'personel_maas' as const, description: 'Maaş: Can Yıldız', amount: 40000, method: 'salary' as const, staffId: 's3', createdAt: addDays(t, -8), createdBy: 'Sistem' },
    { id: 'l11', date: addDays(t, -8), time: '19:01', type: 'expense' as const, category: 'personel_maas' as const, description: 'Maaş: Selin Arslan', amount: 32000, method: 'salary' as const, staffId: 's4', createdAt: addDays(t, -8), createdBy: 'Sistem' },
    { id: 'l12', date: addDays(t, -8), time: '08:12', type: 'expense' as const, category: 'personel_maas' as const, description: 'Maaş: Burak Şahin', amount: 31000, method: 'salary' as const, staffId: 's5', createdAt: addDays(t, -8), createdBy: 'Sistem' },
    { id: 'l13', date: addDays(t, -8), time: '09:23', type: 'expense' as const, category: 'personel_maas' as const, description: 'Maaş: Ayhan Çelik', amount: 65000, method: 'salary' as const, staffId: 's6', createdAt: addDays(t, -8), createdBy: 'Sistem' },
    { id: 'l14', date: addDays(t, -8), time: '10:34', type: 'expense' as const, category: 'personel_maas' as const, description: 'Maaş: Merve Aksoy', amount: 48000, method: 'salary' as const, staffId: 's7', createdAt: addDays(t, -8), createdBy: 'Sistem' },
    { id: 'l15', date: addDays(t, -8), time: '11:45', type: 'expense' as const, category: 'personel_maas' as const, description: 'Maaş: Emre Koç', amount: 35000, method: 'salary' as const, staffId: 's8', createdAt: addDays(t, -8), createdBy: 'Sistem' },
    { id: 'l16', date: addDays(t, -8), time: '12:56', type: 'expense' as const, category: 'sgk_vergi' as const, description: 'SGK işveren payı (aylık)', amount: 75600, method: 'transfer' as const, createdAt: addDays(t, -8), createdBy: 'Sistem' },
    { id: 'l17', date: addDays(t, -5), time: '13:07', type: 'expense' as const, category: 'bakim_onarim' as const, description: 'Klima servisi (oda 204)', amount: 8500, method: 'cash' as const, createdAt: addDays(t, -5), createdBy: 'Ayhan Çelik' },
    { id: 'l18', date: addDays(t, -3), time: '14:18', type: 'expense' as const, category: 'pazarlama' as const, description: 'Booking.com komisyon dönemi', amount: 12400, method: 'online' as const, createdAt: addDays(t, -3), createdBy: 'Sistem' },
    { id: 'l19', date: addDays(t, -2), time: '15:29', type: 'income' as const, category: 'oda_geliri' as const, description: 'Oda tahsilatı · UYU-0007', amount: 6195, method: 'cash' as const, reservationId: 'res7', paymentId: 'p7', reference: 'UYU-0007', createdAt: addDays(t, -2), createdBy: 'Elif Acar' },
    { id: 'l20', date: addDays(t, -1), time: '16:40', type: 'income' as const, category: 'oda_geliri' as const, description: 'Oda tahsilatı · UYU-0002', amount: 17056, method: 'card' as const, reservationId: 'res2', paymentId: 'p4', reference: 'UYU-0002', createdAt: addDays(t, -1), createdBy: 'Can Yıldız' },
    { id: 'l21', date: addDays(t, -1), time: '17:51', type: 'income' as const, category: 'ekstra_gelir' as const, description: 'Spa + room service · UYU-0002', amount: 2160, method: 'card' as const, reservationId: 'res2', reference: 'UYU-0002', createdAt: addDays(t, -1), createdBy: 'Sistem' },
    { id: 'l22', date: t, time: '18:02', type: 'income' as const, category: 'oda_geliri' as const, description: 'Depozito / kısmi · UYU-0001', amount: 4000, method: 'card' as const, reservationId: 'res1', paymentId: 'p2', reference: 'UYU-0001', createdAt: t, createdBy: 'Elif Acar' },
    { id: 'l23', date: addDays(t, -14), time: '19:13', type: 'income' as const, category: 'oda_geliri' as const, description: 'Balayı depozito · UYU-0008', amount: 5000, method: 'card' as const, reservationId: 'res8', paymentId: 'p8', reference: 'UYU-0008', createdAt: addDays(t, -14), createdBy: 'Can Yıldız' },
    { id: 'l24', date: addDays(t, -7), time: '08:24', type: 'income' as const, category: 'oda_geliri' as const, description: 'Havale depozito · UYU-0003', amount: 3000, method: 'transfer' as const, reservationId: 'res3', paymentId: 'p5', reference: 'UYU-0003', createdAt: addDays(t, -7), createdBy: 'Sistem' },
    { id: 'l25', date: addDays(t, -4), time: '09:35', type: 'expense' as const, category: 'sigorta' as const, description: 'İşyeri sigortası prim', amount: 15000, method: 'transfer' as const, createdAt: addDays(t, -4), createdBy: 'Sistem' },
  ];

  const recurringExpenses = [
    { id: 're1', name: 'Bina kirası', category: 'kira' as const, amount: 180000, dayOfMonth: 1, active: true, notes: 'Aylık sabit' },
    { id: 're2', name: 'Elektrik (tahmini)', category: 'elektrik' as const, amount: 28000, dayOfMonth: 5, active: true },
    { id: 're3', name: 'Su (tahmini)', category: 'su' as const, amount: 6500, dayOfMonth: 5, active: true },
    { id: 're4', name: 'Doğalgaz (tahmini)', category: 'dogalgaz' as const, amount: 9000, dayOfMonth: 5, active: true },
    { id: 're5', name: 'İnternet / telefon', category: 'internet' as const, amount: 4500, dayOfMonth: 10, active: true },
    { id: 're6', name: 'İşyeri sigortası', category: 'sigorta' as const, amount: 15000, dayOfMonth: 15, active: true },
    { id: 're7', name: 'Yazılım abonelikleri (PMS/POS)', category: 'yazilim' as const, amount: 3500, dayOfMonth: 1, active: true },
  ];

  return {
    rooms,
    guests,
    reservations,
    payments,
    staff,
    tasks,
    activity,
    settings: {
      name: 'UYU ROOM HOTEL',
      address: 'Kordonboyu Cad. No:42, Alsancak, İzmir',
      phone: '+90 232 555 0100',
      email: 'info@uyuroom.com',
      currency: 'TRY',
      taxRate: 10,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      stars: 5,
      logo: 'UYU',
    },
    currentUserId: 's1',
    reservationSeq: 10,
    ledger,
    recurringExpenses,
    staffDebts: [],
    staffDebtPayments: [],
    invoices: [],
    archive: [],
  };
}
