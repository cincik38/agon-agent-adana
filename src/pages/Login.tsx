import { useState, type FormEvent } from 'react';
import { Hotel, Lock, User, Eye, EyeOff, Shield } from 'lucide-react';
import { authenticate } from '../lib/auth';
import { useStore } from '../lib/store';
import { Button, Input } from '../components/ui';

export default function Login() {
  const { state, login } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = authenticate(username, password, state.staff);
    window.setTimeout(() => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      login(result.session);
    }, 280);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#071614] px-4 py-10">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-teal-600/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-800 text-lg font-black text-white shadow-2xl shadow-teal-900/50">
            UYU
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">UYU ROOM HOTEL</h1>
          <p className="mt-1 text-sm text-teal-200/70">Property Management System · Personel Girişi</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-8"
        >
          <div className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-600">
            <Shield size={16} className="text-teal-700" />
            Yetkili personel erişimi
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="relative">
              <User size={16} className="pointer-events-none absolute left-3 top-[38px] text-slate-400" />
              <Input
                label="Kullanıcı adı"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="pl-9"
                placeholder="Kullanıcı adınız"
                required
              />
            </div>
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3 top-[38px] text-slate-400" />
              <Input
                label="Şifre"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="pl-9 pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-[34px] rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type="submit" className="mt-6 w-full" size="lg" disabled={loading}>
            <Hotel size={18} />
            {loading ? 'Giriş yapılıyor...' : 'Panele Giriş'}
          </Button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
            Bu panel yalnızca otel personeline açıktır. Oturum tarayıcınızda güvenli şekilde saklanır.
          </p>
        </form>

        <p className="mt-6 text-center text-[11px] text-teal-200/40">
          © {new Date().getFullYear()} UYU ROOM HOTEL · PMS
        </p>
      </div>
    </div>
  );
}
