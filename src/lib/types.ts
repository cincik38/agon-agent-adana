export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'out_of_order';
export type RoomType = 'standard' | 'deluxe' | 'suite' | 'presidential' | 'family' | 'economy';
export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'online' | 'other';
export type HousekeepingStatus = 'clean' | 'dirty' | 'in_progress' | 'inspected' | 'do_not_disturb';
export type StaffRole = 'admin' | 'manager' | 'receptionist' | 'housekeeping' | 'accountant' | 'concierge';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export type LedgerType = 'income' | 'expense';
export type LedgerCategory =
  | 'oda_geliri'
  | 'ekstra_gelir'
  | 'yiyecek_icecek'
  | 'spa'
  | 'diger_gelir'
  | 'personel_maas'
  | 'sgk_vergi'
  | 'elektrik'
  | 'su'
  | 'dogalgaz'
  | 'internet'
  | 'kira'
  | 'bakim_onarim'
  | 'temizlik_malzeme'
  | 'market_gida'
  | 'pazarlama'
  | 'sigorta'
  | 'vergi_harc'
  | 'ulasim'
  | 'yazilim'
  | 'diger_gider';

export interface Room {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  status: RoomStatus;
  housekeeping: HousekeepingStatus;
  capacity: number;
  beds: string;
  pricePerNight: number;
  amenities: string[];
  description: string;
  lastCleaned?: string;
  deletedAt?: string;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber: string;
  nationality: string;
  address: string;
  notes: string;
  vip: boolean;
  /** Kara liste — bu misafirle yeni rezervasyon yaparken uyari gosterilir */
  blacklisted?: boolean;
  blacklistReason?: string;
  createdAt: string;
  totalStays: number;
  totalSpent: number;
  deletedAt?: string;
}

/** Odada kalan ek misafir (ana misafir hariç) */
export interface StayCompanion {
  id: string;
  guestId: string;
  /** Oda kapasitesi üstü ekstra kişi */
  isExtra?: boolean;
  isChild?: boolean;
  relation?: string;
  addedAt: string;
}

export interface Reservation {
  id: string;
  code: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  /** Giris saati (opsiyonel) — HH:mm */
  checkInTime?: string;
  /** Cikis saati — HH:mm, varsayilan 11:00 */
  checkOutTime?: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  nightlyRate: number;
  extras: ExtraCharge[];
  /** Oda arkadaşları / yan misafirler */
  companions?: StayCompanion[];
  discount: number;
  taxRate: number;
  deposit: number;
  notes: string;
  source: string;
  createdAt: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  specialRequests: string;
  deletedAt?: string;
  /**
   * Kalici silme "mezar tasi" isareti. deletedAt zaten (soft-delete/arsiv)
   * icin kullaniliyor ve senkron/merge sirasinda GUVENILIR sekilde
   * korunuyor. Kaydi DIZIDEN TAMAMEN CIKARMAK (array.filter) merge
   * mantigiyla uyumsuz — baska bir cihazdaki/henuz senkron olmamis kopya
   * onu "eksik" sanip geri getiriyordu (hayalet rezervasyon sorunu). Bu
   * yuzden kalici silme de ayni saglam desen ile, obje SILINMEDEN,
   * sadece bu bayrak set edilerek yapilir — boylece her yerde (ghost
   * listesi dahil) kalici ve guvenilir sekilde gizlenir.
   */
  purged?: boolean;
}

export interface ExtraCharge {
  id: string;
  name: string;
  amount: number;
  quantity: number;
  date: string;
  category: string;
}

export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  note: string;
  receivedBy: string;
  receivedByStaffId?: string;
  deletedAt?: string;
}

export type InvoiceStatus = 'pending' | 'issued' | 'cancelled';
export type InvoiceTrigger = 'checkin' | 'payment' | 'checkout' | 'manual';

/** Maliye / e-fatura takip kaydı */
export interface Invoice {
  id: string;
  reservationId: string;
  paymentId?: string;
  trigger: InvoiceTrigger;
  amount: number;
  status: InvoiceStatus;
  /** Faturayı kesmekle yükümlü personel */
  responsibleStaffId: string;
  responsibleName: string;
  createdAt: string;
  dueAt: string;
  issuedAt?: string;
  invoiceNumber?: string;
  /** Yüklenen fatura dosyası adı */
  fileName?: string;
  fileMime?: string;
  /** base64 data URL (yerel arşiv) */
  fileData?: string;
  /** Opsiyonel Google Drive / harici link */
  driveUrl?: string;
  notes?: string;
  deletedAt?: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  /** Birden fazla gorev/rol atanabilir (orn: hem resepsiyon hem vale) */
  roles?: StaffRole[];
  active: boolean;
  shift: string;
  department: string;
  hiredAt: string;
  username?: string;
  password?: string;
  /** Aylık brüt maaş (TRY) */
  salary?: number;
  deletedAt?: string;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  assignedTo?: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: string;
  notes: string;
  createdAt: string;
  completedAt?: string;
  deletedAt?: string;
}

export interface ActivityLog {
  id: string;
  type: string;
  message: string;
  user: string;
  timestamp: string;
  relatedId?: string;
}

export interface HotelSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  taxRate: number;
  checkInTime: string;
  checkOutTime: string;
  stars: number;
  logo: string;
  /** Misafirin gordugu sipariş/oda servisi sayfasi ust banner slaytlari */
  orderPageBanners?: string[];
}

export interface ArchiveEntry {
  id: string;
  entity: string;
  data: unknown;
  deletedAt: string;
  deletedBy: string;
}

/** Muhasebe defteri satırı (Excel satırı) */
export interface LedgerEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm — saatlik filtre ve kasa akışı için */
  time?: string;
  type: LedgerType;
  category: LedgerCategory;
  description: string;
  amount: number;
  method: PaymentMethod | 'salary' | 'auto';
  reference?: string;
  staffId?: string;
  reservationId?: string;
  paymentId?: string;
  notes?: string;
  /** Karşı taraf / tedarikçi / misafir */
  counterparty?: string;
  /** Kasa / banka hesabı etiketi */
  account?: string;
  /** KDV oranı % */
  vatRate?: number;
  tags?: string[];
  createdAt: string;
  createdBy?: string;
  deletedAt?: string;
}

/** Tekrarlayan zorunlu gider şablonu */
export interface RecurringExpense {
  id: string;
  name: string;
  category: LedgerCategory;
  amount: number;
  dayOfMonth: number;
  active: boolean;
  notes?: string;
  lastGenerated?: string;
  deletedAt?: string;
}

/** Personele borç / avans kaydı */
export interface StaffDebt {
  id: string;
  staffId: string;
  description: string;
  /** Orijinal borç tutarı */
  amount: number;
  /** Kalan borç */
  remaining: number;
  date: string;
  status: 'open' | 'partial' | 'paid';
  notes?: string;
  createdAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface StaffDebtPayment {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  time?: string;
  method: string;
  note?: string;
  ledgerId?: string;
  createdAt: string;
  createdBy?: string;
}

/** Ariza / bakim / teknik is kaydi */
export interface MaintenanceIssue {
  id: string;
  roomId?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string;
  createdAt: string;
  createdBy?: string;
  completedAt?: string;
  notes?: string;
  deletedAt?: string;
}

/** Restoran / kafe menu urunu */
export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
  description?: string;
  /** Kucuk boyutlu base64 gorsel (data URL) */
  imageUrl?: string;
  /** undefined/null = stok takibi yok (sinirsiz). Sadece panelde gorunur, misafire gosterilmez. */
  stock?: number;
  deletedAt?: string;
}

export interface CafeOrderLine {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
}

export type CafeOrderStatus = 'pending' | 'delivered' | 'cancelled';

/** Misafirin oda servisi / kafe siparisi */
export interface CafeOrder {
  id: string;
  reservationId: string;
  guestId: string;
  roomId?: string;
  items: CafeOrderLine[];
  total: number;
  status: CafeOrderStatus;
  note?: string;
  /** Bos ise misafir kendisi verdi; doluysa hangi personel telefonla girdi */
  placedBy?: string;
  createdAt: string;
  deliveredAt?: string;
  deletedAt?: string;
}

export interface AppState {
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  payments: Payment[];
  staff: Staff[];
  tasks: HousekeepingTask[];
  activity: ActivityLog[];
  settings: HotelSettings;
  currentUserId: string;
  reservationSeq: number;
  ledger: LedgerEntry[];
  recurringExpenses: RecurringExpense[];
  staffDebts: StaffDebt[];
  staffDebtPayments: StaffDebtPayment[];
  invoices: Invoice[];
  archive?: ArchiveEntry[];
  maintenanceIssues?: MaintenanceIssue[];
  menuItems?: MenuItem[];
  cafeOrders?: CafeOrder[];
}
