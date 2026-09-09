import { useMemo, useState } from 'react';
import {
  Download,
  Plus,
  Search,
  Trash2,
  Wallet,
  TrendingDown,
  TrendingUp,
  Users,
  Repeat,
  Calculator,
  Clock,
  CalendarRange,
  Copy,
  Activity,
  Banknote,
  X,
  HandCoins,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useStore } from '../lib/store';
import type { LedgerCategory, LedgerEntry, LedgerType, PaymentMethod, StaffDebt } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Textarea,
} from '../components/ui';
import {
  addDays,
  downloadCSV,
  EXPENSE_CATEGORIES,
  formatCurrency,
  formatDate,
  INCOME_CATEGORIES,
  LEDGER_CATEGORY_LABELS,
  todayISO,
  cn,
  entryTime,
  entryStamp,
  currentHotelDayAnchor,
  capStampAtNow,
} from '../lib/utils';

type Tab = 'defter' | 'saatlik' | 'kasa' | 'maas' | 'borc' | 'sabit' | 'analiz';
type KpiFocus = 'income' | 'expense' | 'net' | 'count' | null;

const METHOD_OPTS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Nakit' },
  { value: 'card', label: 'Kart' },
  { value: 'transfer', label: 'Havale/EFT' },
  { value: 'online', label: 'Online' },
  { value: 'salary', label: 'Maaş' },
  { value: 'auto', label: 'Otomatik' },
  { value: 'other', label: 'Diğer' },
];

const ACCOUNTS = ['Ana Kasa', 'Banka TRY', 'Banka EUR', 'Online Tahsilat', 'Petty Cash'];

const HOUR_CHIPS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00');

function monthKey(d = todayISO()) {
  return d.slice(0, 7);
}

// entryTime/entryStamp artik src/lib/utils.ts icinde (Dashboard ile paylasilir)

function inDateRange(date: string, from: string, to: string) {
  const d = date.slice(0, 10);
  return d >= from && d <= to;
}

function inTimeRange(e: LedgerEntry, timeFrom: string, timeTo: string, enable: boolean) {
  if (!enable) return true;
  const t = entryTime(e);
  if (timeFrom && t < timeFrom) return false;
  if (timeTo && t > timeTo) return false;
  return true;
}

function daysInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let d = from;
  let guard = 0;
  while (d <= to && guard < 400) {
    out.push(d);
    d = addDays(d, 1);
    guard++;
  }
  return out;
}

function Req({ children }: { children: string }) {
  return (
    <span>
      {children} <span className="text-rose-500">*</span>
    </span>
  );
}

export default function Accounting() {
  const {
    state,
    addLedgerEntry,
    updateLedgerEntry,
    deleteLedgerEntry,
    addRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    generatePayroll,
    payStaffSalary,
    postRecurringExpense,
    generateRecurringForMonth,
    addStaffDebt,
    payStaffDebt,
    deleteStaffDebt,
    currentUser,
    isManager,
    pushToast,
  } = useStore();

  const [tab, setTab] = useState<Tab>('defter');
  const [kpiFocus, setKpiFocus] = useState<KpiFocus>(null);

  const [from, setFrom] = useState(() => monthKey() + '-01');
  const [to, setTo] = useState(todayISO());
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [timeFrom, setTimeFrom] = useState('00:00');
  const [timeTo, setTimeTo] = useState('23:59');
  const [typeFilter, setTypeFilter] = useState<'all' | LedgerType>('all');
  const [catFilter, setCatFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'amount_desc' | 'amount_asc'>('newest');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedDay, setSelectedDay] = useState(todayISO());
  const [dayCloseMode, setDayCloseMode] = useState(false);
  const [dayCloseAnchor, setDayCloseAnchor] = useState(todayISO());
  const [compare, setCompare] = useState(false);

  const [entryOpen, setEntryOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [recOpen, setRecOpen] = useState(false);
  const [editRecId, setEditRecId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LedgerEntry | null>(null);

  // Payroll selection
  const [payrollSel, setPayrollSel] = useState<Record<string, boolean>>({});
  const [payrollMonth, setPayrollMonth] = useState(monthKey());

  // Debts
  const [debtOpen, setDebtOpen] = useState(false);
  const [debtPayOpen, setDebtPayOpen] = useState<StaffDebt | null>(null);
  const [debtForm, setDebtForm] = useState({
    staffId: '',
    description: '',
    amount: 0,
    date: todayISO(),
    notes: '',
  });
  const [debtPayForm, setDebtPayForm] = useState({ amount: 0, date: todayISO(), method: 'cash', note: '' });

  const [form, setForm] = useState({
    date: todayISO(),
    time: '12:00',
    type: 'expense' as LedgerType,
    category: 'diger_gider' as LedgerCategory,
    description: '',
    amount: 0,
    method: 'transfer' as PaymentMethod | 'salary' | 'auto',
    notes: '',
    staffId: '',
    counterparty: '',
    account: 'Ana Kasa',
    vatRate: 0,
    tags: '',
  });

  const [recForm, setRecForm] = useState({
    name: '',
    category: 'kira' as LedgerCategory,
    amount: 0,
    dayOfMonth: 1,
    active: true,
    notes: '',
  });

  const applyPreset = (preset: string) => {
    const t = todayISO();
    setTimeEnabled(false);
    setDayCloseMode(false);
    if (preset === 'hotelDay') {
      setDayCloseMode(true);
      setDayCloseAnchor(currentHotelDayAnchor());
    } else if (preset === 'today') {
      setFrom(t); setTo(t); setSelectedDay(t);
      setTimeEnabled(true); setTimeFrom('00:00'); setTimeTo('23:59');
    } else if (preset === 'yesterday') {
      const y = addDays(t, -1);
      setFrom(y); setTo(y); setSelectedDay(y);
    } else if (preset === 'week') {
      const d = new Date(t + 'T12:00:00');
      const day = (d.getDay() + 6) % 7;
      setFrom(addDays(t, -day)); setTo(t);
    } else if (preset === '7d') {
      setFrom(addDays(t, -6)); setTo(t);
    } else if (preset === 'month') {
      setFrom(monthKey(t) + '-01'); setTo(t);
    } else if (preset === 'lastMonth') {
      const firstThis = monthKey(t) + '-01';
      const lastPrev = addDays(firstThis, -1);
      setFrom(monthKey(lastPrev) + '-01'); setTo(lastPrev);
    } else if (preset === 'shift_morning') {
      setFrom(t); setTo(t); setSelectedDay(t);
      setTimeEnabled(true); setTimeFrom('08:00'); setTimeTo('16:00');
    } else if (preset === 'shift_evening') {
      setFrom(t); setTo(t); setSelectedDay(t);
      setTimeEnabled(true); setTimeFrom('16:00'); setTimeTo('23:59');
    } else if (preset === 'shift_night') {
      setFrom(t); setTo(t); setSelectedDay(t);
      setTimeEnabled(true); setTimeFrom('00:00'); setTimeTo('08:00');
    }
  };

  const setHourChip = (which: 'from' | 'to', hourLabel: string) => {
    setTimeEnabled(true);
    if (which === 'from') setTimeFrom(hourLabel);
    else {
      // end of hour = HH:59
      const h = hourLabel.slice(0, 2);
      setTimeTo(`${h}:59`);
    }
  };

  const allActive = useMemo(
    () => (state.ledger || []).filter((e) => !e.deletedAt),
    [state.ledger]
  );

  const baseFiltered = useMemo(() => {
    let rows: LedgerEntry[];
    if (dayCloseMode) {
      // Otel gun donumu: bir onceki gunun 07:00'inden bugunun 07:00'ine kadar —
      // tarih ve saat aralik filtrelerinden bagimsiz, tek bir zaman damgasi araligi.
      // Otel gun donumu: bir onceki gunun 07:00'inden bu gunun 07:00'ine kadar —
      // eger bu araligin bitisi (toStamp) henuz gelmemis bir gelecekse (yani
      // icinde bulundugumuz acik gun donumune bakiyorsak), "su ana kadar"
      // gosterilir, gelecekteki teorik kapanisa kadar degil.
      const toStamp = capStampAtNow(`${dayCloseAnchor}T07:00`);
      const fromStamp = `${addDays(dayCloseAnchor, -1)}T07:00`;
      rows = allActive.filter((e) => {
        const stamp = entryStamp(e);
        return stamp >= fromStamp && stamp < toStamp;
      });
    } else {
      rows = allActive.filter((e) => inDateRange(e.date, from, to));
      rows = rows.filter((e) => inTimeRange(e, timeFrom, timeTo, timeEnabled));
    }
    if (typeFilter !== 'all') rows = rows.filter((e) => e.type === typeFilter);
    if (catFilter !== 'all') rows = rows.filter((e) => e.category === catFilter);
    if (methodFilter !== 'all') rows = rows.filter((e) => e.method === methodFilter);
    if (accountFilter !== 'all') rows = rows.filter((e) => (e.account || 'Ana Kasa') === accountFilter);
    const minA = minAmount === '' ? null : Number(minAmount);
    const maxA = maxAmount === '' ? null : Number(maxAmount);
    if (minA != null && !Number.isNaN(minA)) rows = rows.filter((e) => e.amount >= minA);
    if (maxA != null && !Number.isNaN(maxA)) rows = rows.filter((e) => e.amount <= maxA);
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter(
        (e) =>
          e.description.toLowerCase().includes(s) ||
          (e.reference || '').toLowerCase().includes(s) ||
          (e.counterparty || '').toLowerCase().includes(s) ||
          (e.notes || '').toLowerCase().includes(s) ||
          (e.tags || []).some((tg) => tg.toLowerCase().includes(s)) ||
          (LEDGER_CATEGORY_LABELS[e.category] || '').toLowerCase().includes(s)
      );
    }
    return rows;
  }, [allActive, from, to, timeEnabled, timeFrom, timeTo, typeFilter, catFilter, methodFilter, accountFilter, minAmount, maxAmount, q, dayCloseMode, dayCloseAnchor]);

  // KPI click narrows the list further
  const filtered = useMemo(() => {
    let rows = baseFiltered;
    if (kpiFocus === 'income') rows = rows.filter((e) => e.type === 'income');
    if (kpiFocus === 'expense') rows = rows.filter((e) => e.type === 'expense');
    // net/count show all baseFiltered
    rows = [...rows].sort((a, b) => {
      if (sort === 'newest') return entryStamp(b).localeCompare(entryStamp(a));
      if (sort === 'oldest') return entryStamp(a).localeCompare(entryStamp(b));
      if (sort === 'amount_desc') return b.amount - a.amount;
      return a.amount - b.amount;
    });
    return rows;
  }, [baseFiltered, kpiFocus, sort]);

  const prevRange = useMemo(() => {
    const days = daysInRange(from, to).length || 1;
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(days - 1));
    return { prevFrom, prevTo };
  }, [from, to]);

  const prevFiltered = useMemo(() => {
    if (!compare) return [] as LedgerEntry[];
    return allActive
      .filter((e) => inDateRange(e.date, prevRange.prevFrom, prevRange.prevTo))
      .filter((e) => inTimeRange(e, timeFrom, timeTo, timeEnabled));
  }, [allActive, prevRange, compare, timeEnabled, timeFrom, timeTo]);

  const sumSide = (rows: LedgerEntry[], type: LedgerType) =>
    rows.filter((e) => e.type === type).reduce((s, e) => s + e.amount, 0);

  const totals = useMemo(() => {
    const rows = baseFiltered;
    const income = sumSide(rows, 'income');
    const expense = sumSide(rows, 'expense');
    const roomInc = rows
      .filter((e) => e.type === 'income' && ['oda_geliri', 'ekstra_gelir'].includes(e.category))
      .reduce((s, e) => s + e.amount, 0);
    const payroll = rows
      .filter((e) => e.category === 'personel_maas' || e.category === 'sgk_vergi')
      .reduce((s, e) => s + e.amount, 0);
    const cash = rows
      .filter((e) => e.method === 'cash')
      .reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0);
    return {
      income,
      expense,
      net: income - expense,
      roomInc,
      payroll,
      count: rows.length,
      cash,
      avgTicket: rows.length ? Math.round((income + expense) / rows.length) : 0,
    };
  }, [baseFiltered]);

  const prevTotals = useMemo(() => {
    const income = sumSide(prevFiltered, 'income');
    const expense = sumSide(prevFiltered, 'expense');
    return { income, expense, net: income - expense, count: prevFiltered.length };
  }, [prevFiltered]);

  const openingBalance = useMemo(() => {
    return allActive
      .filter((e) => e.date.slice(0, 10) < from)
      .reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0);
  }, [allActive, from]);

  const withBalance = useMemo(() => {
    const asc = [...filtered].sort((a, b) => entryStamp(a).localeCompare(entryStamp(b)));
    let bal = openingBalance;
    const rows = asc.map((e) => {
      bal += e.type === 'income' ? e.amount : -e.amount;
      return { ...e, balance: bal };
    });
    return sort === 'oldest' ? rows : rows.reverse();
  }, [filtered, openingBalance, sort]);

  const closingBalance =
    withBalance.length > 0
      ? sort === 'oldest'
        ? withBalance[withBalance.length - 1].balance
        : withBalance[0].balance
      : openingBalance;

  const focusDay = from === to ? from : selectedDay;
  const dayEntries = useMemo(() => {
    return allActive
      .filter((e) => e.date.slice(0, 10) === focusDay)
      .filter((e) => inTimeRange(e, timeFrom, timeTo, timeEnabled))
      .sort((a, b) => entryTime(a).localeCompare(entryTime(b)));
  }, [allActive, focusDay, timeEnabled, timeFrom, timeTo]);

  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      h, income: 0, expense: 0, count: 0, net: 0,
    }));
    dayEntries.forEach((e) => {
      const h = Math.min(23, parseInt(entryTime(e).slice(0, 2), 10) || 0);
      buckets[h].count += 1;
      if (e.type === 'income') buckets[h].income += e.amount;
      else buckets[h].expense += e.amount;
      buckets[h].net = buckets[h].income - buckets[h].expense;
    });
    return buckets;
  }, [dayEntries]);
  const maxHourly = Math.max(1, ...hourly.map((b) => b.income + b.expense));

  const dailySeries = useMemo(() => {
    return daysInRange(from, to).map((d) => {
      const rows = baseFiltered.filter((e) => e.date.slice(0, 10) === d);
      const income = sumSide(rows, 'income');
      const expense = sumSide(rows, 'expense');
      return { d, income, expense, net: income - expense, count: rows.length };
    });
  }, [from, to, baseFiltered]);
  const maxDaily = Math.max(1, ...dailySeries.map((d) => Math.max(d.income, d.expense, 1)));

  const byCategory = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    baseFiltered.forEach((e) => {
      if (!map[e.category]) map[e.category] = { income: 0, expense: 0 };
      if (e.type === 'income') map[e.category].income += e.amount;
      else map[e.category].expense += e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1].income + b[1].expense - (a[1].income + a[1].expense));
  }, [baseFiltered]);

  const byMethod = useMemo(() => {
    const map: Record<string, number> = {};
    baseFiltered.forEach((e) => {
      const k = e.method || 'other';
      map[k] = (map[k] || 0) + (e.type === 'income' ? e.amount : -e.amount);
    });
    return Object.entries(map).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [baseFiltered]);

  const byAccount = useMemo(() => {
    const map: Record<string, { in: number; out: number }> = {};
    baseFiltered.forEach((e) => {
      const a = e.account || 'Ana Kasa';
      if (!map[a]) map[a] = { in: 0, out: 0 };
      if (e.type === 'income') map[a].in += e.amount;
      else map[a].out += e.amount;
    });
    return Object.entries(map);
  }, [baseFiltered]);

  const staffList = state.staff.filter((s) => !s.deletedAt);
  const activeStaffPaid = staffList.filter((s) => s.active && (s.salary || 0) > 0);
  const recurring = (state.recurringExpenses || []).filter((r) => !r.deletedAt);
  const debts = (state.staffDebts || []).filter((d) => !d.deletedAt);
  const openDebts = debts.filter((d) => d.status !== 'paid' && d.remaining > 0);
  const debtTotal = openDebts.reduce((s, d) => s + d.remaining, 0);

  const clickKpi = (focus: KpiFocus) => {
    if (kpiFocus === focus) {
      setKpiFocus(null);
      return;
    }
    setKpiFocus(focus);
    setTab('defter');
    if (focus === 'income') setTypeFilter('income');
    else if (focus === 'expense') setTypeFilter('expense');
    else setTypeFilter('all');
  };

  const openCreate = (type: LedgerType = 'expense') => {
    const n = new Date();
    setEditId(null);
    setFormError('');
    setForm({
      date: from === to ? from : todayISO(),
      time: `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`,
      type,
      category: type === 'income' ? 'oda_geliri' : 'diger_gider',
      description: '',
      amount: 0,
      method: type === 'income' ? 'card' : 'transfer',
      notes: '',
      staffId: '',
      counterparty: '',
      account: 'Ana Kasa',
      vatRate: type === 'income' ? 10 : 0,
      tags: '',
    });
    setEntryOpen(true);
  };

  const openEdit = (e: LedgerEntry) => {
    setEditId(e.id);
    setFormError('');
    setForm({
      date: e.date.slice(0, 10),
      time: entryTime(e),
      type: e.type,
      category: e.category,
      description: e.description,
      amount: e.amount,
      method: e.method,
      notes: e.notes || '',
      staffId: e.staffId || '',
      counterparty: e.counterparty || '',
      account: e.account || 'Ana Kasa',
      vatRate: e.vatRate || 0,
      tags: (e.tags || []).join(', '),
    });
    setEntryOpen(true);
  };

  const saveEntry = () => {
    const missing: string[] = [];
    if (!form.date) missing.push('Tarih');
    if (!form.time) missing.push('Saat');
    if (!form.description.trim()) missing.push('Açıklama');
    if (!form.amount || form.amount <= 0) missing.push('Tutar');
    if (!form.category) missing.push('Kategori');
    if (!form.method) missing.push('Ödeme yöntemi');
    if (missing.length) {
      setFormError(`Zorunlu alanlar: ${missing.join(', ')}`);
      return;
    }
    setFormError('');
    const payload = {
      date: form.date,
      time: form.time,
      type: form.type,
      category: form.category,
      description: form.description.trim(),
      amount: Number(form.amount),
      method: form.method,
      notes: form.notes,
      staffId: form.staffId || undefined,
      counterparty: form.counterparty || undefined,
      account: form.account || undefined,
      vatRate: form.vatRate || undefined,
      tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean),
      createdBy: currentUser?.name,
    };
    if (editId) updateLedgerEntry(editId, payload);
    else addLedgerEntry(payload);
    setEntryOpen(false);
  };

  const duplicateEntry = (e: LedgerEntry) => {
    addLedgerEntry({
      date: todayISO(),
      time: entryTime(e),
      type: e.type,
      category: e.category,
      description: e.description + ' (kopya)',
      amount: e.amount,
      method: e.method,
      notes: e.notes,
      staffId: e.staffId,
      counterparty: e.counterparty,
      account: e.account,
      vatRate: e.vatRate,
      tags: e.tags,
      createdBy: currentUser?.name,
    });
  };

  const exportLedger = () => {
    downloadCSV(
      `uyu-muhasebe-${from}_${to}.csv`,
      filtered.map((e) => ({
        Tarih: e.date.slice(0, 10),
        Saat: entryTime(e),
        Tip: e.type === 'income' ? 'Gelir' : 'Gider',
        Kategori: LEDGER_CATEGORY_LABELS[e.category] || e.category,
        Aciklama: e.description,
        Tutar: e.amount,
        Yontem: METHOD_OPTS.find((m) => m.value === e.method)?.label || e.method,
        Hesap: e.account || '',
        KarsiTaraf: e.counterparty || '',
        Referans: e.reference || '',
        Not: e.notes || '',
      }))
    );
  };

  const selectedPayrollIds = activeStaffPaid.filter((s) => payrollSel[s.id]).map((s) => s.id);
  const selectedPayrollTotal = activeStaffPaid
    .filter((s) => payrollSel[s.id])
    .reduce((sum, s) => sum + (s.salary || 0), 0);

  const toggleAllPayroll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    activeStaffPaid.forEach((s) => {
      const already = allActive.some(
        (e) => e.staffId === s.id && e.category === 'personel_maas' && e.date.startsWith(payrollMonth) && e.method === 'salary'
      );
      next[s.id] = on && !already;
    });
    setPayrollSel(next);
  };

  const catsForType = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const kpiHint = kpiFocus
    ? `Filtre aktif: ${kpiFocus === 'income' ? 'Gelirler' : kpiFocus === 'expense' ? 'Giderler' : kpiFocus === 'net' ? 'Net hareketler' : 'Tüm hareketler'} — tekrar tıkla kaldır`
    : 'Karta tıklayarak ilgili kayıtları aç';

  return (
    <div>
      <PageHeader
        title="Finansal Muhasebe"
        subtitle={`Tarih+saat filtre · seçmeli bordro · personel borçları · ${state.settings.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportLedger}><Download size={16} /> CSV</Button>
            <Button variant="outline" onClick={() => openCreate('income')}><TrendingUp size={16} /> Gelir</Button>
            <Button onClick={() => openCreate('expense')}><Plus size={16} /> Gider / Kayıt</Button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {([
          ['defter', 'Defter'],
          ['saatlik', 'Saatlik Akış'],
          ['kasa', 'Kasa / Hesap'],
          ['maas', 'Maaşlar'],
          ['borc', 'Personel Borçları'],
          ['sabit', 'Zorunlu Giderler'],
          ['analiz', 'Analiz'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
              tab === k ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* FILTER PANEL */}
      <Card className="mb-4 overflow-hidden border-teal-100">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-900">
            <CalendarRange size={16} /> Tarih & Saat
            <Badge color="teal">{filtered.length} kayıt</Badge>
            {kpiFocus && <Badge color="amber">KPI: {kpiFocus}</Badge>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset('hotelDay')}
              className={cn(
                'rounded-lg px-2 py-1 text-[11px] font-semibold ring-1',
                dayCloseMode
                  ? 'bg-teal-700 text-white ring-teal-700'
                  : 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100'
              )}
              title="Otel gün dönümü: bir önceki günün 07:00'inden bugünün 07:00'ine kadar"
            >
              🌅 07:00–07:00 Gün Dönümü
            </button>
            {([
              ['today', 'Bugün'],
              ['yesterday', 'Dün'],
              ['shift_morning', '08–16'],
              ['shift_evening', '16–00'],
              ['shift_night', '00–08'],
              ['7d', '7 Gün'],
              ['month', 'Bu Ay'],
            ] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => applyPreset(k)}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-teal-50 hover:text-teal-800">
                {label}
              </button>
            ))}
            <button type="button" onClick={() => setShowFilters((v) => !v)}
              className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
              {showFilters ? 'Gizle' : 'Detay'}
            </button>
          </div>
        </div>

        {dayCloseMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/60 px-4 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-900">
              <span>
                Gün dönümü: {formatDate(addDays(dayCloseAnchor, -1))} 07:00 →{' '}
                {dayCloseAnchor === currentHotelDayAnchor() ? 'Şimdi' : `${formatDate(dayCloseAnchor)} 07:00`}
              </span>
              <input
                type="date"
                value={dayCloseAnchor}
                max={currentHotelDayAnchor()}
                onChange={(e) => {
                  if (!e.target.value) return;
                  // ONEMLI: hangi tarihe atlarsak atlayalım, o tarihin
                  // 07:00–07:00 gun donumu penceresi otomatik uygulanır —
                  // tek tek "Onceki Gun" tiklamaya gerek kalmadan.
                  setDayCloseAnchor(e.target.value > currentHotelDayAnchor() ? currentHotelDayAnchor() : e.target.value);
                }}
                className="h-8 cursor-pointer rounded-lg border border-amber-200 bg-white px-2 text-xs font-semibold text-amber-900"
                title="Herhangi bir tarihe doğrudan atla — o günün gun donumu penceresi gösterilir"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDayCloseAnchor((d) => addDays(d, -1))}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                ← Önceki Gün
              </button>
              <button
                type="button"
                onClick={() => setDayCloseAnchor(currentHotelDayAnchor())}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                Bugün
              </button>
              <button
                type="button"
                onClick={() => setDayCloseAnchor((d) => addDays(d, 1))}
                disabled={dayCloseAnchor >= currentHotelDayAnchor()}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-40"
              >
                Sonraki Gün →
              </button>
              <button
                type="button"
                onClick={() => setDayCloseMode(false)}
                className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white"
              >
                Modu Kapat
              </button>
            </div>
          </div>
        )}

        {showFilters && (
          <div className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Başlangıç tarihi</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Bitiş tarihi</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block space-y-1.5">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input type="checkbox" checked={timeEnabled} onChange={(e) => setTimeEnabled(e.target.checked)} />
                  Saat aralığı
                </span>
                <div className="flex gap-2">
                  <input type="time" value={timeFrom} disabled={!timeEnabled}
                    onChange={(e) => { setTimeEnabled(true); setTimeFrom(e.target.value); }}
                    className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 px-2 text-sm disabled:opacity-40" />
                  <input type="time" value={timeTo} disabled={!timeEnabled}
                    onChange={(e) => { setTimeEnabled(true); setTimeTo(e.target.value); }}
                    className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 px-2 text-sm disabled:opacity-40" />
                </div>
              </label>
              <label className="flex items-end gap-2 pb-2 text-xs font-medium text-slate-600">
                <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                Önceki dönemle karşılaştır
              </label>
            </div>

            {/* Clickable hour chips */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">
                Saate tıklayarak seçin — sol tık başlangıç, sağ tık bitiş (veya aşağıdaki chip’ler)
              </p>
              <div className="flex flex-wrap gap-1">
                {HOUR_CHIPS.map((h) => {
                  const activeFrom = timeEnabled && timeFrom.startsWith(h.slice(0, 2));
                  const activeTo = timeEnabled && timeTo.startsWith(h.slice(0, 2));
                  const inBand =
                    timeEnabled &&
                    h >= timeFrom.slice(0, 2) + ':00' &&
                    h <= timeTo.slice(0, 2) + ':00';
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHourChip('from', h)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setHourChip('to', h);
                      }}
                      onDoubleClick={() => {
                        setTimeEnabled(true);
                        setTimeFrom(h);
                        setTimeTo(h.slice(0, 2) + ':59');
                      }}
                      className={cn(
                        'rounded-md px-1.5 py-1 text-[10px] font-bold tabular-nums transition',
                        activeFrom
                          ? 'bg-teal-700 text-white'
                          : activeTo
                            ? 'bg-rose-600 text-white'
                            : inBand
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      )}
                      title="Tık: başlangıç · Çift tık: sadece bu saat · Sağ tık: bitiş"
                    >
                      {h.slice(0, 2)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Tık = başlangıç saati · Çift tık = yalnızca o saat · Sağ tık = bitiş saati
                {timeEnabled && (
                  <span className="ml-2 font-semibold text-teal-700">
                    Seçili: {timeFrom} – {timeTo}
                  </span>
                )}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
                <option value="all">Tüm tipler</option>
                <option value="income">Gelir</option>
                <option value="expense">Gider</option>
              </Select>
              <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="all">Tüm kategoriler</option>
                {Object.entries(LEDGER_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
              <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                <option value="all">Tüm yöntemler</option>
                {METHOD_OPTS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
              <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                <option value="all">Tüm hesaplar</option>
                {ACCOUNTS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
              <input placeholder="Min ₺" type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input placeholder="Max ₺" type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara..."
                  className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-teal-500" />
              </div>
              <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="sm:w-40">
                <option value="newest">Yeni → Eski</option>
                <option value="oldest">Eski → Yeni</option>
                <option value="amount_desc">Tutar ↓</option>
                <option value="amount_asc">Tutar ↑</option>
              </Select>
            </div>
          </div>
        )}
      </Card>

      {/* Clickable KPIs */}
      <p className="mb-2 text-[11px] text-slate-500">{kpiHint}</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => clickKpi('income')} className="text-left">
          <StatCard
            label="Toplam Gelir"
            value={formatCurrency(totals.income)}
            hint={`Oda/ekstra: ${formatCurrency(totals.roomInc)} · tıkla listele`}
            icon={<TrendingUp size={20} />}
            tone="emerald"
            className={kpiFocus === 'income' ? 'ring-2 ring-emerald-400' : ''}
          />
        </button>
        <button type="button" onClick={() => clickKpi('expense')} className="text-left">
          <StatCard
            label="Toplam Gider"
            value={formatCurrency(totals.expense)}
            hint={`Maaş+SGK: ${formatCurrency(totals.payroll)} · tıkla listele`}
            icon={<TrendingDown size={20} />}
            tone="rose"
            className={kpiFocus === 'expense' ? 'ring-2 ring-rose-400' : ''}
          />
        </button>
        <button type="button" onClick={() => clickKpi('net')} className="text-left">
          <StatCard
            label="Net"
            value={formatCurrency(totals.net)}
            hint={`Açılış ${formatCurrency(openingBalance)} → Kapanış ${formatCurrency(closingBalance)}`}
            icon={<Wallet size={20} />}
            tone={totals.net >= 0 ? 'teal' : 'amber'}
            className={kpiFocus === 'net' ? 'ring-2 ring-teal-400' : ''}
          />
        </button>
        <button type="button" onClick={() => { clickKpi('count'); setTab(openDebts.length ? 'borc' : 'defter'); }} className="text-left">
          <StatCard
            label="Hareket / Borç"
            value={`${totals.count}`}
            hint={`Ort. ${formatCurrency(totals.avgTicket)} · Açık personel borcu ${formatCurrency(debtTotal)}`}
            icon={<Activity size={20} />}
            tone="violet"
            className={kpiFocus === 'count' ? 'ring-2 ring-violet-400' : ''}
          />
        </button>
      </div>

      {kpiFocus && tab === 'defter' && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>
            KPI filtresi: <strong>{kpiFocus === 'income' ? 'Sadece gelirler' : kpiFocus === 'expense' ? 'Sadece giderler' : 'Tüm hareketler'}</strong>
            {' '}({filtered.length} satır)
          </span>
          <button type="button" className="font-semibold underline" onClick={() => { setKpiFocus(null); setTypeFilter('all'); }}>
            Filtreyi kaldır
          </button>
        </div>
      )}

      {/* DEFTER */}
      {tab === 'defter' && (
        <Card className="overflow-hidden">
          {withBalance.length === 0 ? (
            <EmptyState title="Kayıt yok" desc="Filtreleri genişletin veya gelir/gider ekleyin." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1220px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Tarih / Saat</th>
                    <th className="px-3 py-3">Tip</th>
                    <th className="px-3 py-3">Kategori</th>
                    <th className="px-3 py-3">Açıklama</th>
                    <th className="px-3 py-3">Yöntem</th>
                    <th className="px-3 py-3">Personel</th>
                    <th className="px-3 py-3">Hesap</th>
                    <th className="px-3 py-3 text-right">Gelir</th>
                    <th className="px-3 py-3 text-right">Gider</th>
                    <th className="px-3 py-3 text-right">Bakiye</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {withBalance.map((e) => (
                    <tr key={e.id} className="hover:bg-teal-50/30">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <p className="text-xs font-semibold">{formatDate(e.date)}</p>
                        <p className="flex items-center gap-1 text-[11px] tabular-nums text-teal-700">
                          <Clock size={11} /> {entryTime(e)}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge color={e.type === 'income' ? 'emerald' : 'rose'}>
                          {e.type === 'income' ? 'Gelir' : 'Gider'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{LEDGER_CATEGORY_LABELS[e.category]}</td>
                      <td className="max-w-[220px] px-3 py-2.5 overflow-hidden">
                        <button type="button" className="block w-full text-left" onClick={() => setDetail(e)}>
                          <p className="truncate font-medium hover:text-teal-800">{e.description}</p>
                          {(e.counterparty || e.reference) && (
                            <p className="truncate text-[11px] text-slate-400">
                              {e.reference ? e.reference : ''}{e.reference && e.counterparty ? ' · ' : ''}{e.counterparty || ''}
                            </p>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {state.staff.find((s) => s.id === e.staffId)?.name || e.createdBy || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {METHOD_OPTS.find((m) => m.value === e.method)?.label || e.method}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{e.account || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                        {e.type === 'income' ? formatCurrency(e.amount) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-rose-600">
                        {e.type === 'expense' ? formatCurrency(e.amount) : '—'}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right font-bold', e.balance >= 0 ? 'text-slate-800' : 'text-rose-700')}>
                        {formatCurrency(e.balance)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-0.5">
                          <button type="button" onClick={() => duplicateEntry(e)} className="rounded-lg p-1.5 text-slate-400 hover:text-teal-700"><Copy size={14} /></button>
                          <button type="button" onClick={() => openEdit(e)} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-teal-700">Düzenle</button>
                          {isManager && (
                            <button type="button" onClick={() => { if (confirm('Arşivlensin mi?')) deleteLedgerEntry(e.id); }} className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 bg-slate-50 font-semibold">
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-slate-600">Toplam · Kapanış {formatCurrency(closingBalance)}</td>
                    <td className="px-3 py-3 text-right text-emerald-700">{formatCurrency(sumSide(filtered, 'income'))}</td>
                    <td className="px-3 py-3 text-right text-rose-600">{formatCurrency(sumSide(filtered, 'expense'))}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(sumSide(filtered, 'income') - sumSide(filtered, 'expense'))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* SAATLIK */}
      {tab === 'saatlik' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h3 className="font-semibold flex items-center gap-2"><Clock size={18} className="text-teal-700" /> Saatlik akış</h3>
              <input type="date" value={focusDay} onChange={(e) => { setSelectedDay(e.target.value); setFrom(e.target.value); setTo(e.target.value); }}
                className="h-9 cursor-pointer rounded-xl border border-slate-200 px-2 text-sm" />
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {hourly.map((b) => (
                <button
                  key={b.h}
                  type="button"
                  onClick={() => {
                    const lab = String(b.h).padStart(2, '0') + ':00';
                    setTimeEnabled(true);
                    setTimeFrom(lab);
                    setTimeTo(String(b.h).padStart(2, '0') + ':59');
                    setFrom(focusDay);
                    setTo(focusDay);
                    setTab('defter');
                  }}
                  className={cn(
                    'min-w-[2rem] flex-1 rounded-lg px-1 py-2 text-center transition hover:ring-2 hover:ring-teal-300',
                    b.count ? 'bg-slate-50' : 'bg-white'
                  )}
                  title="Bu saatin kayıtlarını aç"
                >
                  <div className="mx-auto flex h-16 items-end justify-center gap-0.5">
                    <div className="w-2 rounded-t bg-emerald-400" style={{ height: `${(b.income / maxHourly) * 100}%` }} />
                    <div className="w-2 rounded-t bg-rose-400" style={{ height: `${(b.expense / maxHourly) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] font-bold text-slate-500">{b.h}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">Saat sütununa tıklayınca o saatin fişleri defterde açılır.</p>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">Günün fişleri</h3>
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {dayEntries.map((e) => (
                <button key={e.id} type="button" onClick={() => setDetail(e)}
                  className="flex w-full items-start gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left hover:bg-teal-50/40">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold">{entryTime(e)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.description}</span>
                  <span className={cn('text-sm font-bold', e.type === 'income' ? 'text-emerald-700' : 'text-rose-600')}>
                    {e.type === 'income' ? '+' : '−'}{formatCurrency(e.amount)}
                  </span>
                </button>
              ))}
              {dayEntries.length === 0 && <p className="text-sm text-slate-400">Hareket yok</p>}
            </div>
          </Card>
        </div>
      )}

      {/* KASA */}
      {tab === 'kasa' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {byAccount.map(([name, v]) => (
            <button key={name} type="button" className="text-left" onClick={() => { setAccountFilter(name); setTab('defter'); setKpiFocus(null); }}>
              <Card className="p-4 transition hover:border-teal-300 hover:shadow-md">
                <p className="text-xs uppercase text-slate-400">{name}</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(v.in - v.out)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="text-emerald-700">+{formatCurrency(v.in)}</span>
                  {' / '}
                  <span className="text-rose-600">−{formatCurrency(v.out)}</span>
                </p>
                <p className="mt-2 text-[11px] font-semibold text-teal-700">Kayıtları aç →</p>
              </Card>
            </button>
          ))}
          {byMethod.map(([m, amt]) => (
            <button key={m} type="button" className="text-left" onClick={() => { setMethodFilter(m); setTab('defter'); }}>
              <Card className="p-4 transition hover:border-teal-300">
                <p className="text-xs text-slate-400">{METHOD_OPTS.find((x) => x.value === m)?.label || m}</p>
                <p className={cn('mt-1 text-lg font-bold', amt >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{formatCurrency(amt)}</p>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* MAAS - selective */}
      {tab === 'maas' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><Users size={18} className="text-teal-700" /> Seçmeli maaş ödemesi</h3>
                <p className="text-xs text-slate-500">İstediğiniz personeli işaretleyin — toplu veya tek tek ödeyin</p>
              </div>
              <input type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)}
                className="h-9 cursor-pointer rounded-xl border border-slate-200 px-2 text-sm" />
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleAllPayroll(true)}>Tümünü seç</Button>
              <Button size="sm" variant="ghost" onClick={() => toggleAllPayroll(false)}>Seçimi temizle</Button>
              <Button
                size="sm"
                disabled={!selectedPayrollIds.length}
                onClick={() => generatePayroll(payrollMonth, selectedPayrollIds)}
              >
                <CheckSquare size={14} /> Seçilenleri öde ({selectedPayrollIds.length})
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="pb-2 w-10"></th>
                    <th className="pb-2">Personel</th>
                    <th className="pb-2">Departman</th>
                    <th className="pb-2 text-right">Maaş</th>
                    <th className="pb-2 text-right">Durum</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeStaffPaid.map((s) => {
                    const paid = allActive.find(
                      (e) => e.staffId === s.id && e.category === 'personel_maas' && e.date.startsWith(payrollMonth) && e.method === 'salary'
                    );
                    return (
                      <tr key={s.id} className={paid ? 'opacity-60' : ''}>
                        <td className="py-2.5">
                          <button
                            type="button"
                            disabled={!!paid}
                            onClick={() => setPayrollSel((p) => ({ ...p, [s.id]: !p[s.id] }))}
                            className="text-teal-700 disabled:text-slate-300"
                          >
                            {payrollSel[s.id] ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
                        <td className="py-2.5 font-medium">{s.name}</td>
                        <td className="py-2.5 text-xs text-slate-500">{s.department}</td>
                        <td className="py-2.5 text-right font-semibold">{formatCurrency(s.salary || 0)}</td>
                        <td className="py-2.5 text-right">
                          {paid ? <Badge color="emerald">Ödendi</Badge> : <Badge color="amber">Bekliyor</Badge>}
                        </td>
                        <td className="py-2.5 text-right">
                          {!paid && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const r = payStaffSalary(s.id, payrollMonth);
                                if (typeof r === 'object' && 'error' in r) pushToast('err', r.error);
                              }}
                            >
                              Sadece bunu öde
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Seçili toplam: <strong>{formatCurrency(selectedPayrollTotal)}</strong>
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="mb-2 font-semibold">Not</h3>
            <p className="text-xs leading-relaxed text-slate-500">
              Eskiden bordro tüm personeli birden işliyordu. Artık yalnızca işaretlediğiniz kişiler
              veya satırdaki “Sadece bunu öde” ile tek personel ödenir. Aynı ay için çift maaş engellenir.
            </p>
          </Card>
        </div>
      )}

      {/* BORC */}
      {tab === 'borc' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><HandCoins size={18} className="text-teal-700" /> Personele borçlar</h3>
                <p className="text-xs text-slate-500">Avans, eksik ödeme vb. — ödendikçe kalan düşer</p>
              </div>
              <Button onClick={() => {
                setDebtForm({ staffId: staffList[0]?.id || '', description: '', amount: 0, date: todayISO(), notes: '' });
                setDebtOpen(true);
              }}>
                <Plus size={16} /> Borç ekle
              </Button>
            </div>
            {debts.length === 0 ? (
              <EmptyState title="Borç kaydı yok" desc="Personele avans veya borç ekleyin." />
            ) : (
              <div className="space-y-2">
                {debts.map((d) => {
                  const st = staffList.find((s) => s.id === d.staffId);
                  const pct = d.amount > 0 ? Math.round(((d.amount - d.remaining) / d.amount) * 100) : 0;
                  return (
                    <div key={d.id} className="rounded-2xl border border-slate-100 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{st?.name || 'Personel'} — {d.description}</p>
                          <p className="text-xs text-slate-500">{formatDate(d.date)} · {d.notes || '—'}</p>
                        </div>
                        <Badge color={d.status === 'paid' ? 'emerald' : d.status === 'partial' ? 'amber' : 'rose'}>
                          {d.status === 'paid' ? 'Kapandı' : d.status === 'partial' ? 'Kısmi' : 'Açık'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <p className="text-xs text-slate-400">Kalan / Toplam</p>
                          <p className="text-lg font-bold text-rose-700">
                            {formatCurrency(d.remaining)} <span className="text-sm font-normal text-slate-400">/ {formatCurrency(d.amount)}</span>
                          </p>
                          <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {d.remaining > 0 && (
                            <Button size="sm" onClick={() => {
                              setDebtPayOpen(d);
                              setDebtPayForm({ amount: d.remaining, date: todayISO(), method: 'cash', note: '' });
                            }}>
                              Ödeme al
                            </Button>
                          )}
                          {isManager && (
                            <Button size="sm" variant="ghost" onClick={() => { if (confirm('Arşivlensin mi?')) deleteStaffDebt(d.id); }}>
                              Sil
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="mb-2 font-semibold">Açık borç toplamı</h3>
            <p className="text-3xl font-bold text-rose-700">{formatCurrency(debtTotal)}</p>
            <p className="mt-1 text-xs text-slate-500">{openDebts.length} açık kayıt</p>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
              Ödeme alındığında tutar personel gideri olarak deftere işlenir ve kalan borç otomatik düşer.
            </p>
          </Card>
        </div>
      )}

      {/* SABIT - individual post */}
      {tab === 'sabit' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><Repeat size={18} className="text-teal-700" /> Zorunlu gider şablonları</h3>
                <p className="text-xs text-slate-500">Her satırı tek tek bu aya ekleyin — toplu da mümkün</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)}
                  className="h-9 cursor-pointer rounded-xl border border-slate-200 px-2 text-sm" />
                <Button variant="outline" onClick={() => generateRecurringForMonth(payrollMonth)}>Tüm aktifleri işle</Button>
                <Button onClick={() => {
                  setEditRecId(null);
                  setRecForm({ name: '', category: 'kira', amount: 0, dayOfMonth: 1, active: true, notes: '' });
                  setRecOpen(true);
                }}><Plus size={16} /> Şablon</Button>
              </div>
            </div>
            <div className="space-y-2">
              {recurring.map((r) => {
                const posted = allActive.some(
                  (e) => e.reference === r.id && e.date.startsWith(payrollMonth) && e.type === 'expense'
                );
                return (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 px-4 py-3">
                    <div>
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-xs text-slate-500">
                        {LEDGER_CATEGORY_LABELS[r.category]} · Ayın {r.dayOfMonth}. günü
                        {posted && <span className="ml-2 text-emerald-600">· {payrollMonth} işlendi</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-rose-700">{formatCurrency(r.amount)}</span>
                      <Button
                        size="sm"
                        disabled={posted}
                        onClick={() => {
                          const res = postRecurringExpense(r.id, payrollMonth);
                          if (typeof res === 'object' && 'error' in res) pushToast('err', res.error);
                        }}
                      >
                        Bu aya ekle
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditRecId(r.id);
                        setRecForm({
                          name: r.name,
                          category: r.category,
                          amount: r.amount,
                          dayOfMonth: r.dayOfMonth,
                          active: r.active,
                          notes: r.notes || '',
                        });
                        setRecOpen(true);
                      }}>Düzenle</Button>
                      {isManager && (
                        <button type="button" onClick={() => deleteRecurringExpense(r.id)} className="rounded-lg p-2 text-slate-400 hover:text-rose-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-2 font-semibold">Aylık şablon toplamı</h3>
            <p className="text-3xl font-bold text-rose-700">
              {formatCurrency(recurring.filter((r) => r.active).reduce((s, r) => s + r.amount, 0))}
            </p>
          </Card>
        </div>
      )}

      {/* ANALIZ */}
      {tab === 'analiz' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">Günlük trend</h3>
            <div className="flex h-36 items-end gap-0.5">
              {dailySeries.map((d) => (
                <button
                  key={d.d}
                  type="button"
                  title={d.d}
                  onClick={() => { setFrom(d.d); setTo(d.d); setSelectedDay(d.d); setTab('saatlik'); }}
                  className="flex min-w-[14px] flex-1 flex-col justify-end gap-0.5"
                >
                  <div className="w-full rounded-t bg-emerald-400" style={{ height: `${(d.income / maxDaily) * 100}%` }} />
                  <div className="w-full rounded-b bg-rose-400" style={{ height: `${(d.expense / maxDaily) * 100}%` }} />
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Güne tıklayınca saatlik akışa gider</p>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-3 font-semibold">Kategori</h3>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {byCategory.map(([cat, v]) => (
                  <button
                    key={cat}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left text-sm hover:bg-teal-50"
                    onClick={() => { setCatFilter(cat); setTab('defter'); }}
                  >
                    <span>{LEDGER_CATEGORY_LABELS[cat]}</span>
                    <span className="tabular-nums text-slate-600">
                      {v.income > 0 && <span className="text-emerald-700">+{formatCurrency(v.income)} </span>}
                      {v.expense > 0 && <span className="text-rose-600">−{formatCurrency(v.expense)}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="mb-3 font-semibold">Özet</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><dt>Gelir</dt><dd className="font-bold text-emerald-700">{formatCurrency(totals.income)}</dd></div>
                <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><dt>Gider</dt><dd className="font-bold text-rose-600">{formatCurrency(totals.expense)}</dd></div>
                <div className="flex justify-between rounded-xl bg-slate-900 px-3 py-2 text-white"><dt>Net</dt><dd className="font-bold">{formatCurrency(totals.net)}</dd></div>
                <div className="flex justify-between rounded-xl bg-amber-50 px-3 py-2"><dt>Açık personel borcu</dt><dd className="font-bold text-amber-800">{formatCurrency(debtTotal)}</dd></div>
              </dl>
            </Card>
          </div>
        </div>
      )}

      {/* ENTRY MODAL */}
      <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title={editId ? 'Kayıt Düzenle' : 'Yeni Muhasebe Kaydı'} wide>
        <div className="space-y-3">
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="text-rose-500">*</span> ile işaretli alanlar zorunludur.
          </p>
          {formError && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">Tip <span className="text-rose-500">*</span></span>
              <select value={form.type} onChange={(e) => {
                const type = e.target.value as LedgerType;
                setForm((f) => ({ ...f, type, category: type === 'income' ? 'oda_geliri' : 'diger_gider' }));
              }} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
                <option value="income">Gelir</option>
                <option value="expense">Gider</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Tarih <span className="text-rose-500">*</span></span>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Saat <span className="text-rose-500">*</span></span>
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
            </div>
            {/* quick hour chips in form */}
            <div className="sm:col-span-2">
              <p className="mb-1 text-[11px] text-slate-500">Hızlı saat seç (tıkla)</p>
              <div className="flex flex-wrap gap-1">
                {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','20:00','22:00'].map((h) => (
                  <button key={h} type="button" onClick={() => setForm({ ...form, time: h })}
                    className={cn('rounded-md px-2 py-1 text-[11px] font-bold', form.time === h ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">Kategori <span className="text-rose-500">*</span></span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as LedgerCategory })}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
                {catsForType.map((c) => (
                  <option key={c} value={c}>{LEDGER_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">Tutar (₺) <span className="text-rose-500">*</span></span>
              <input type="number" min={0} value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: +e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="0" />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Açıklama <span className="text-rose-500">*</span></span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Örn: Market alışverişi / Oda tahsilatı" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">Ödeme yöntemi <span className="text-rose-500">*</span></span>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as typeof form.method })}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
                {METHOD_OPTS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
            <Select label="Hesap / Kasa" value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}>
              {ACCOUNTS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
            <Input label="Karşı taraf" value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} placeholder="Opsiyonel" />
            <Input label="KDV %" type="number" value={form.vatRate || ''} onChange={(e) => setForm({ ...form, vatRate: +e.target.value })} />
            {form.category === 'personel_maas' && (
              <Select label="Personel" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
                <option value="">Seçilmedi</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            )}
            <Textarea label="Not (opsiyonel)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="sm:col-span-2" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEntryOpen(false)}>İptal</Button>
            <Button onClick={saveEntry}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      {/* Debt create */}
      <Modal open={debtOpen} onClose={() => setDebtOpen(false)} title="Personele borç ekle">
        <div className="space-y-3">
          <p className="text-xs text-slate-500"><span className="text-rose-500">*</span> zorunlu alanlar</p>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Personel <span className="text-rose-500">*</span></span>
            <select value={debtForm.staffId} onChange={(e) => setDebtForm({ ...debtForm, staffId: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
              <option value="">Seçin...</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Açıklama <span className="text-rose-500">*</span></span>
            <input value={debtForm.description} onChange={(e) => setDebtForm({ ...debtForm, description: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Avans, eksik maaş..." />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Tutar <span className="text-rose-500">*</span></span>
            <input type="number" value={debtForm.amount || ''} onChange={(e) => setDebtForm({ ...debtForm, amount: +e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Tarih <span className="text-rose-500">*</span></span>
            <input type="date" value={debtForm.date} onChange={(e) => setDebtForm({ ...debtForm, date: e.target.value })}
              className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <Textarea label="Not" value={debtForm.notes} onChange={(e) => setDebtForm({ ...debtForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDebtOpen(false)}>İptal</Button>
            <Button onClick={() => {
              if (!debtForm.staffId || !debtForm.description.trim() || !debtForm.amount) {
                pushToast('err', 'Personel, açıklama ve tutar zorunlu');
                return;
              }
              addStaffDebt({
                staffId: debtForm.staffId,
                description: debtForm.description.trim(),
                amount: debtForm.amount,
                date: debtForm.date,
                notes: debtForm.notes,
                createdBy: currentUser?.name,
              });
              setDebtOpen(false);
            }}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      {/* Debt pay */}
      <Modal open={!!debtPayOpen} onClose={() => setDebtPayOpen(null)} title="Borç ödemesi">
        {debtPayOpen && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Kalan: <strong className="text-rose-700">{formatCurrency(debtPayOpen.remaining)}</strong>
            </p>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">Ödeme tutarı <span className="text-rose-500">*</span></span>
              <input type="number" value={debtPayForm.amount || ''} onChange={(e) => setDebtPayForm({ ...debtPayForm, amount: +e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">Tarih <span className="text-rose-500">*</span></span>
              <input type="date" value={debtPayForm.date} onChange={(e) => setDebtPayForm({ ...debtPayForm, date: e.target.value })}
                className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
            <Select label="Yöntem" value={debtPayForm.method} onChange={(e) => setDebtPayForm({ ...debtPayForm, method: e.target.value })}>
              {METHOD_OPTS.filter((m) => !['salary', 'auto'].includes(m.value)).map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDebtPayOpen(null)}>İptal</Button>
              <Button onClick={() => {
                const r = payStaffDebt(debtPayOpen.id, debtPayForm.amount, {
                  date: debtPayForm.date,
                  method: debtPayForm.method,
                  note: debtPayForm.note,
                });
                if (typeof r === 'object' && 'error' in r) pushToast('err', r.error);
                else setDebtPayOpen(null);
              }}>Ödemeyi kaydet</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Recurring modal */}
      <Modal open={recOpen} onClose={() => setRecOpen(false)} title={editRecId ? 'Şablon düzenle' : 'Zorunlu gider şablonu'}>
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Ad <span className="text-rose-500">*</span></span>
            <input value={recForm.name} onChange={(e) => setRecForm({ ...recForm, name: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <Select label="Kategori" value={recForm.category} onChange={(e) => setRecForm({ ...recForm, category: e.target.value as LedgerCategory })}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{LEDGER_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Tutar <span className="text-rose-500">*</span></span>
            <input type="number" value={recForm.amount || ''} onChange={(e) => setRecForm({ ...recForm, amount: +e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <Input label="Ayın günü" type="number" min={1} max={28} value={recForm.dayOfMonth}
            onChange={(e) => setRecForm({ ...recForm, dayOfMonth: +e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRecOpen(false)}>İptal</Button>
            <Button onClick={() => {
              if (!recForm.name.trim() || !recForm.amount) {
                pushToast('err', 'Ad ve tutar zorunlu');
                return;
              }
              if (editRecId) updateRecurringExpense(editRecId, recForm);
              else addRecurringExpense(recForm);
              setRecOpen(false);
            }}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Fiş detayı">
        {detail && (
          <div className="space-y-3 text-sm">
            <Badge color={detail.type === 'income' ? 'emerald' : 'rose'}>{detail.type === 'income' ? 'Gelir' : 'Gider'}</Badge>
            <p className="text-lg font-bold">{detail.description}</p>
            <p className={cn('text-2xl font-black', detail.type === 'income' ? 'text-emerald-700' : 'text-rose-600')}>
              {formatCurrency(detail.amount)}
            </p>
            <p className="text-xs text-slate-500">{formatDate(detail.date)} · {entryTime(detail)} · {LEDGER_CATEGORY_LABELS[detail.category]}</p>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <p>Personel: <span className="font-medium text-slate-800">{state.staff.find((s) => s.id === detail.staffId)?.name || detail.createdBy || '—'}</span></p>
              {detail.counterparty && <p>Misafir: <span className="font-medium text-slate-800">{detail.counterparty}</span></p>}
              {detail.reference && <p>Rezervasyon: <span className="font-medium text-slate-800">{detail.reference}</span></p>}
              <p>Yöntem: <span className="font-medium text-slate-800">{detail.method}</span></p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setDetail(null); openEdit(detail); }}>Düzenle</Button>
              <Button size="sm" variant="outline" onClick={() => duplicateEntry(detail)}>Kopyala</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
