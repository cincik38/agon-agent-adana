import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BedDouble,
  CalendarDays,
  Users,
  ClipboardList,
  Wallet,
  UserCog,
  BarChart3,
  Settings,
  Menu,
  X,
  Hotel,
  Sparkles,
  Calculator,
  FileText,
  Bell,
  CheckCircle2,
  AlertCircle,
  Info,
  ShieldCheck,
  LogIn,
  LogOut,
  Wrench,
  CreditCard,
  ChevronRight,
  AlertTriangle,
  History,
  Coffee,
  ShoppingBag,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { balanceDue } from '../lib/calculations';
import { cn, formatCurrency, formatDateTime, todayISO } from '../lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import ChatWidget from './ChatWidget';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rooms', label: 'Odalar', icon: BedDouble },
  { to: '/reservations', label: 'Rezervasyonlar', icon: CalendarDays },
  { to: '/calendar', label: 'Takvim / Doluluk', icon: ClipboardList },
  { to: '/guests', label: 'Misafirler', icon: Users },
  { to: '/front-desk', label: 'Resepsiyon', icon: Hotel },
  { to: '/housekeeping', label: 'Kat Hizmetleri', icon: Sparkles },
  { to: '/maintenance', label: 'Arıza & Teknik İşler', icon: Wrench },
  { to: '/payments', label: 'Ödemeler', icon: Wallet },
  { to: '/invoices', label: 'Faturalar', icon: FileText },
  { to: '/accounting', label: 'Finansal Muhasebe', icon: Calculator },
  { to: '/menu', label: 'Menü / Ürünler', icon: Coffee },
  { to: '/orders', label: 'Oda Servisi Siparişleri', icon: ShoppingBag },
  { to: '/settings', label: 'Ayarlar', icon: Settings },
];
const managerOnlyNav = [
  { to: '/staff', label: 'Personel', icon: UserCog },
  { to: '/reports', label: 'Raporlar', icon: BarChart3 },
  { to: '/activity', label: 'İşlem Kayıtları', icon: History },
];

type AlertItem = {
  id: string;
  category: string;
  title: string;
  detail: string;
  to: string;
  tone: 'amber' | 'rose' | 'blue' | 'orange' | 'violet';
  icon: typeof LogIn;
};

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { state, currentUser, isManager, session, logout, toasts, dismissToast, lastSaved, ready, reportPage } = useStore();
  const navItems = isManager ? [...nav, ...managerOnlyNav] : nav;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    reportPage(location.pathname);
  }, [location.pathname, reportPage]);
  const panelRef = useRef<HTMLDivElement>(null);
  const desktopBtnRef = useRef<HTMLButtonElement>(null);
  const mobileBtnRef = useRef<HTMLButtonElement>(null);

  const alertItems = useMemo(() => {
    const t = todayISO();
    const items: AlertItem[] = [];

    // Today's / overdue arrivals
    state.reservations
      .filter((r) => !r.deletedAt && r.checkIn <= t && ['confirmed', 'pending'].includes(r.status))
      .forEach((r) => {
        const g = state.guests.find((x) => x.id === r.guestId);
        const room = state.rooms.find((x) => x.id === r.roomId);
        const overdue = r.checkIn < t;
        items.push({
          id: `arr-${r.id}`,
          category: overdue ? 'Gecikmiş geliş' : 'Bugün geliş',
          title: `${g?.firstName ?? ''} ${g?.lastName ?? ''}`.trim() || r.code,
          detail: `${r.code} · Oda ${room?.number ?? '—'} · Giriş ${r.checkIn}`,
          to: '/front-desk',
          tone: overdue ? 'rose' : 'blue',
          icon: LogIn,
        });
      });

    // Today's / overdue departures
    state.reservations
      .filter((r) => !r.deletedAt && r.status === 'checked_in' && r.checkOut <= t)
      .forEach((r) => {
        const g = state.guests.find((x) => x.id === r.guestId);
        const room = state.rooms.find((x) => x.id === r.roomId);
        const bal = balanceDue(r, state.payments);
        const overdue = r.checkOut < t;
        items.push({
          id: `dep-${r.id}`,
          category: overdue ? 'Gecikmiş çıkış' : 'Bugün ayrılış',
          title: `${g?.firstName ?? ''} ${g?.lastName ?? ''}`.trim() || r.code,
          detail: `Oda ${room?.number ?? '—'} · Çıkış ${r.checkOut}${bal > 0 ? ` · Bakiye ${formatCurrency(bal)}` : ''}`,
          to: '/front-desk',
          tone: overdue || bal > 0 ? 'rose' : 'amber',
          icon: LogOut,
        });
      });

    // In-house with unpaid balance (not departing today — still important)
    state.reservations
      .filter(
        (r) =>
          !r.deletedAt &&
          r.status === 'checked_in' &&
          r.checkOut > t &&
          balanceDue(r, state.payments) > 1
      )
      .forEach((r) => {
        const g = state.guests.find((x) => x.id === r.guestId);
        const room = state.rooms.find((x) => x.id === r.roomId);
        const bal = balanceDue(r, state.payments);
        items.push({
          id: `bal-${r.id}`,
          category: 'Açık bakiye',
          title: `${g?.firstName ?? ''} ${g?.lastName ?? ''}`.trim() || r.code,
          detail: `Oda ${room?.number ?? '—'} · Kalan ${formatCurrency(bal)}`,
          to: '/payments',
          tone: 'violet',
          icon: CreditCard,
        });
      });

    // Dirty / in-progress rooms
    state.rooms
      .filter((r) => !r.deletedAt && ['dirty', 'in_progress'].includes(r.housekeeping))
      .forEach((r) => {
        items.push({
          id: `hk-${r.id}`,
          category: r.housekeeping === 'in_progress' ? 'Temizlik devam ediyor' : 'Kirli oda',
          title: `Oda ${r.number}`,
          detail: `Kat ${r.floor} · ${r.housekeeping === 'in_progress' ? 'İşlemde' : 'Temizlik bekliyor'}`,
          to: '/housekeeping',
          tone: 'amber',
          icon: Sparkles,
        });
      });

    // Maintenance / out of order
    state.rooms
      .filter((r) => !r.deletedAt && (r.status === 'maintenance' || r.status === 'out_of_order'))
      .forEach((r) => {
        items.push({
          id: `mnt-${r.id}`,
          category: r.status === 'maintenance' ? 'Bakımda' : 'Kullanım dışı',
          title: `Oda ${r.number}`,
          detail: r.description || `Kat ${r.floor}`,
          to: '/rooms',
          tone: 'orange',
          icon: Wrench,
        });
      });

    // Open urgent/high HK tasks
    state.tasks
      .filter(
        (t) =>
          !t.deletedAt &&
          (t.status === 'open' || t.status === 'in_progress') &&
          (t.priority === 'urgent' || t.priority === 'high')
      )
      .forEach((task) => {
        const room = state.rooms.find((r) => r.id === task.roomId);
        // skip if already covered by dirty room of same room for generic clean types
        if (items.some((i) => i.id === `hk-${task.roomId}` && task.type.includes('Temizlik'))) return;
        items.push({
          id: `task-${task.id}`,
          category: task.priority === 'urgent' ? 'Acil görev' : 'Yüksek öncelik görev',
          title: task.type,
          detail: `Oda ${room?.number ?? '—'} · ${task.notes || task.status}`,
          to: '/housekeeping',
          tone: task.priority === 'urgent' ? 'rose' : 'orange',
          icon: AlertTriangle,
        });
      });

    // Pending reservations awaiting confirm
    state.reservations
      .filter((r) => !r.deletedAt && r.status === 'pending')
      .forEach((r) => {
        if (items.some((i) => i.id === `arr-${r.id}`)) return;
        const g = state.guests.find((x) => x.id === r.guestId);
        items.push({
          id: `pend-${r.id}`,
          category: 'Onay bekleyen rezervasyon',
          title: `${g?.firstName ?? ''} ${g?.lastName ?? ''}`.trim() || r.code,
          detail: `${r.code} · ${r.checkIn} → ${r.checkOut}`,
          to: '/reservations',
          tone: 'amber',
          icon: CalendarDays,
        });
      });

    // Pending invoices for current user
    const myId = state.currentUserId;
    (state.invoices || [])
      .filter((i) => !i.deletedAt && i.status === 'pending')
      .forEach((inv) => {
        const overdue = inv.dueAt < new Date().toISOString();
        const res = state.reservations.find((r) => r.id === inv.reservationId);
        items.push({
          id: `inv-${inv.id}`,
          category: overdue ? 'Gecikmis fatura' : 'Fatura bekliyor',
          title: res?.code || inv.invoiceNumber || 'Fatura',
          detail: `${inv.responsibleName} · ${inv.amount} TL · ${inv.trigger}`,
          to: '/invoices',
          tone: overdue ? 'rose' : 'amber',
          icon: FileText,
        });
      });

    return items;
  }, [state]);

  const alertCount = alertItems.length;

  // Close panel on outside click
  useEffect(() => {
    if (!alertsOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (desktopBtnRef.current?.contains(t)) return;
      if (mobileBtnRef.current?.contains(t)) return;
      setAlertsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAlertsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [alertsOpen]);

  // Close when route changes
  useEffect(() => {
    setAlertsOpen(false);
  }, [location.pathname]);

  const goAlert = (item: AlertItem) => {
    setAlertsOpen(false);
    navigate(item.to);
  };

  const pageTitle = nav.find((n) => n.to === location.pathname)?.label ?? 'PMS';

  const toneStyles: Record<AlertItem['tone'], string> = {
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
  };

  const AlertsPanel = (
    <AnimatePresence>
      {alertsOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,400px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Dikkat Gerektiren Öğeler</p>
              <p className="text-[11px] text-slate-500">
                {alertCount === 0 ? 'Şu an acil öğe yok' : `${alertCount} madde · tıklayarak ilgili sayfaya gidin`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAlertsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[min(70vh,420px)] overflow-y-auto">
            {alertCount === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <CheckCircle2 className="mb-2 text-emerald-500" size={28} />
                <p className="text-sm font-medium text-slate-700">Her şey yolunda</p>
                <p className="mt-1 text-xs text-slate-400">Bekleyen geliş, çıkış veya kritik görev yok</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alertItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => goAlert(item)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-teal-50/60"
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                            toneStyles[item.tone]
                          )}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {item.category}
                          </span>
                          <span className="mt-0.5 block text-sm font-semibold text-slate-900 truncate">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500 truncate">{item.detail}</span>
                        </span>
                        <ChevronRight size={16} className="mt-2 shrink-0 text-slate-300" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {alertCount > 0 && (
            <div className="grid grid-cols-3 gap-px border-t border-slate-100 bg-slate-100">
              <button
                type="button"
                onClick={() => {
                  setAlertsOpen(false);
                  navigate('/front-desk');
                }}
                className="bg-white px-2 py-2.5 text-center text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
              >
                Resepsiyon
              </button>
              <button
                type="button"
                onClick={() => {
                  setAlertsOpen(false);
                  navigate('/housekeeping');
                }}
                className="bg-white px-2 py-2.5 text-center text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
              >
                Kat Hizmetleri
              </button>
              <button
                type="button"
                onClick={() => {
                  setAlertsOpen(false);
                  navigate('/payments');
                }}
                className="bg-white px-2 py-2.5 text-center text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
              >
                Ödemeler
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-900">
      <ChatWidget />
      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100%-2rem,360px)] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={cn(
                'pointer-events-auto flex items-start gap-2 rounded-2xl border px-3.5 py-3 shadow-lg backdrop-blur',
                t.type === 'ok' && 'border-emerald-200 bg-emerald-50/95 text-emerald-900',
                t.type === 'err' && 'border-rose-200 bg-rose-50/95 text-rose-900',
                t.type === 'info' && 'border-sky-200 bg-sky-50/95 text-sky-900'
              )}
            >
              {t.type === 'ok' && <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
              {t.type === 'err' && <AlertCircle size={18} className="mt-0.5 shrink-0" />}
              {t.type === 'info' && <Info size={18} className="mt-0.5 shrink-0" />}
              <p className="flex-1 text-sm font-medium leading-snug">{t.text}</p>
              <button
                onClick={() => dismissToast(t.id)}
                className="rounded-lg p-1 opacity-60 hover:opacity-100"
                aria-label="Kapat"
                type="button"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-xl p-2 hover:bg-slate-100" type="button">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-teal-900 text-xs text-white">
            {state.settings.logo}
          </span>
          {pageTitle}
        </div>
        <div className="relative">
          <button
            ref={mobileBtnRef}
            type="button"
            onClick={() => setAlertsOpen((v) => !v)}
            className={cn(
              'relative rounded-xl p-2 transition',
              alertsOpen ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-100'
            )}
            aria-label="Dikkat gerektiren öğeler"
            aria-expanded={alertsOpen}
          >
            <Bell size={18} />
            {alertCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {alertCount}
              </span>
            )}
          </button>
          {AlertsPanel}
        </div>
      </div>

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/80 bg-[#0b1f1c] text-white lg:flex">
        <div className="border-b border-white/10 px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-700 text-sm font-bold shadow-lg shadow-teal-900/40">
              {state.settings.logo}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{state.settings.name}</p>
              <p className="text-[11px] text-teal-200/70">Property Management</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-white/12 text-white shadow-inner'
                    : 'text-teal-100/70 hover:bg-white/6 hover:text-white'
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-200">
            <ShieldCheck size={14} className="shrink-0" />
            <span className="leading-tight">
              {ready ? 'Çok katmanlı kayıt aktif' : 'Veriler yükleniyor...'}
              {lastSaved && (
                <span className="block text-emerald-200/60">
                  Son kayıt: {formatDateTime(lastSaved)}
                </span>
              )}
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-teal-200/50">Oturum</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              {currentUser?.name ?? session?.name}
            </p>
            <p className="truncate text-[11px] text-teal-200/60">
              {session?.username} · {currentUser?.role ?? session?.role}
            </p>
            <button
              type="button"
              onClick={() => {
                if (confirm('Oturumu kapatmak istiyor musunuz?')) logout();
              }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5 text-xs font-medium text-teal-50 hover:bg-rose-500/80"
            >
              <LogOut size={13} /> Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[#0b1f1c] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <span className="font-semibold">{state.settings.name}</span>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/10" type="button">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                      isActive ? 'bg-white/12 text-white' : 'text-teal-100/70'
                    )
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-white/10 p-4 space-y-2">
              <p className="text-xs text-teal-100/80">
                {currentUser?.name ?? session?.name}
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-rose-500/80"
              >
                <LogOut size={14} /> Çıkış
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-2 hidden items-center justify-between lg:flex">
            <div className="text-xs text-slate-500">
              Hoş geldiniz, <span className="font-medium text-slate-700">{currentUser?.name}</span>
            </div>
            <div className="relative flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Veriler korunuyor
              </span>

              <button
                ref={desktopBtnRef}
                type="button"
                onClick={() => setAlertsOpen((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition',
                  alertCount > 0
                    ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 ring-1 ring-amber-200/80'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100',
                  alertsOpen && 'ring-2 ring-amber-300'
                )}
                aria-expanded={alertsOpen}
                aria-haspopup="dialog"
              >
                <Bell size={13} />
                {alertCount > 0 ? `${alertCount} dikkat gerektiren öğe` : 'Uyarı yok'}
              </button>

              {AlertsPanel}
            </div>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
