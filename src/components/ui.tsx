import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5',
        onClick && 'cursor-pointer transition hover:shadow-md hover:border-teal-200',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: 'bg-teal-700 text-white hover:bg-teal-800 shadow-sm shadow-teal-900/20',
    secondary: 'bg-slate-900 text-white hover:bg-slate-800',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
    md: 'h-10 px-4 text-sm rounded-xl gap-2',
    lg: 'h-12 px-6 text-base rounded-xl gap-2',
  };
  return (
    <button
      type={props.type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  // ONEMLI: type="number" alanlarda deger 0 iken kullanici "0"ı silemiyor
  // gibi hissediyordu — kontrollu input her render'da deger 0'a geri
  // "yapışıyor", bu da 0'ın yanına yazınca "01" gibi sacma bir sonuc
  // doğuruyordu. Çozum: sayi alaninda deger tam olarak 0 ise input'u BOŞ
  // göster — kullanici rahatca yeni bir rakam yazabilir, onChange yine
  // normal şekilde çalışır (parent tarafında +e.target.value zaten boş
  // string'i 0'a çevirir). Tüm uygulamadaki sayi kutuları bu ortak
  // bileşeni kullandığı için tek bu düzeltme yeterli.
  const displayValue =
    props.type === 'number' && (props.value === 0 || props.value === '0')
      ? ''
      : props.value;
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-xs font-medium text-slate-600">{label}</span>}
      <input
        className={cn(
          'w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20',
          error && 'border-rose-400',
          className
        )}
        {...props}
        value={displayValue}
      />
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export function Select({
  className,
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-xs font-medium text-slate-600">{label}</span>}
      <select
        className={cn(
          'w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Textarea({
  className,
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-xs font-medium text-slate-600">{label}</span>}
      <textarea
        className={cn(
          'w-full min-h-[88px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20',
          className
        )}
        {...props}
      />
    </label>
  );
}

export function Badge({
  children,
  color = 'slate',
}: {
  children: ReactNode;
  color?: 'slate' | 'teal' | 'emerald' | 'amber' | 'rose' | 'blue' | 'violet' | 'orange';
}) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    teal: 'bg-teal-50 text-teal-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    rose: 'bg-rose-50 text-rose-800',
    blue: 'bg-blue-50 text-blue-800',
    violet: 'bg-violet-50 text-violet-800',
    orange: 'bg-orange-50 text-orange-800',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold', colors[color])}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className={cn(
              'relative z-10 w-full max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl',
              wide ? 'max-w-3xl' : 'max-w-lg'
            )}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 text-2xl">∅</div>
      <p className="font-medium text-slate-700">{title}</p>
      {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'teal',
  to,
  onClick,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  tone?: 'teal' | 'blue' | 'amber' | 'rose' | 'violet' | 'emerald';
  to?: string;
  onClick?: () => void;
  className?: string;
}) {
  const tones = {
    teal: 'from-teal-600 to-teal-800',
    blue: 'from-blue-600 to-indigo-700',
    amber: 'from-amber-500 to-orange-600',
    rose: 'from-rose-500 to-rose-700',
    violet: 'from-violet-600 to-purple-700',
    emerald: 'from-emerald-500 to-teal-700',
  };
  const clickable = Boolean(to || onClick);
  const inner = (
    <div className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
          {clickable && (
            <p className="mt-2 text-[11px] font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100">
              Detaya git →
            </p>
          )}
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg', tones[tone])}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={cn("group block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40", className)}
      >
        {inner}
      </Link>
    );
  }

  return (
    <Card className={cn('group overflow-hidden', clickable && 'cursor-pointer', className)} onClick={onClick}>
      {inner}
    </Card>
  );
}

export function statusColor(kind: string): 'slate' | 'teal' | 'emerald' | 'amber' | 'rose' | 'blue' | 'violet' | 'orange' {
  const map: Record<string, 'slate' | 'teal' | 'emerald' | 'amber' | 'rose' | 'blue' | 'violet' | 'orange'> = {
    available: 'emerald',
    occupied: 'blue',
    cleaning: 'amber',
    maintenance: 'orange',
    out_of_order: 'rose',
    pending: 'amber',
    confirmed: 'teal',
    checked_in: 'blue',
    checked_out: 'slate',
    cancelled: 'rose',
    no_show: 'rose',
    unpaid: 'rose',
    partial: 'amber',
    paid: 'emerald',
    refunded: 'violet',
    clean: 'emerald',
    dirty: 'rose',
    in_progress: 'amber',
    inspected: 'teal',
    do_not_disturb: 'violet',
    open: 'amber',
    done: 'emerald',
    high: 'orange',
    urgent: 'rose',
    medium: 'amber',
    low: 'slate',
  };
  return map[kind] ?? 'slate';
}
