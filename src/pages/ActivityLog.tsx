import { useMemo, useState } from 'react';
import { ShieldAlert, History } from 'lucide-react';
import { useStore } from '../lib/store';
import { Button, Card, Input, PageHeader, Select } from '../components/ui';
import { downloadCSV, formatDateTime, todayISO } from '../lib/utils';

const TYPE_LABELS: Record<string, string> = {
  reservation: 'Rezervasyon',
  guest: 'Misafir',
  staff: 'Personel',
  room: 'Oda',
  checkin: 'Check-in',
  checkout: 'Check-out',
  ledger: 'Muhasebe',
  invoice: 'Fatura',
  task: 'Görev',
  payment: 'Ödeme',
};

export default function ActivityLogPage() {
  const { state, isManager } = useStore();
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const users = useMemo(
    () => Array.from(new Set(state.activity.map((a) => a.user))).sort(),
    [state.activity]
  );
  const types = useMemo(
    () => Array.from(new Set(state.activity.map((a) => a.type))).sort(),
    [state.activity]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return state.activity.filter((a) => {
      if (s && !a.message.toLowerCase().includes(s) && !a.user.toLowerCase().includes(s)) return false;
      if (typeFilter && a.type !== typeFilter) return false;
      if (userFilter && a.user !== userFilter) return false;
      const day = a.timestamp.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [state.activity, q, typeFilter, userFilter, from, to]);

  const exportCSV = () => {
    downloadCSV(
      `islem-kayitlari-${todayISO()}.csv`,
      filtered.map((a) => ({
        Zaman: formatDateTime(a.timestamp),
        Personel: a.user,
        Tur: TYPE_LABELS[a.type] || a.type,
        Aciklama: a.message,
      }))
    );
  };

  if (!isManager) {
    return (
      <div className="p-6">
        <PageHeader title="İşlem Kayıtları" subtitle="Yetkisiz erişim" />
        <Card className="mt-4 flex items-center gap-3 p-6 text-slate-600">
          <ShieldAlert className="text-rose-500" />
          <p>Bu sayfayı görüntülemek için Yönetici veya Müdür yetkisi gerekiyor.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="İşlem Kayıtları"
        subtitle="Sistemde kim, ne zaman, ne yaptı — tüm hareketler anlık kaydedilir"
        actions={
          <Button variant="secondary" onClick={exportCSV}>
            CSV indir
          </Button>
        }
      />

      <Card className="mt-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            label="Ara"
            placeholder="Açıklama veya personel..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select label="Tür" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Tümü</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] || t}
              </option>
            ))}
          </Select>
          <Select label="Personel" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">Tümü</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
          <Input label="Başlangıç" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Bitiş" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Zaman</th>
                <th className="px-4 py-3">Personel</th>
                <th className="px-4 py-3">Tür</th>
                <th className="px-4 py-3">Açıklama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-teal-50/30">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                    {formatDateTime(a.timestamp)}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{a.user}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {TYPE_LABELS[a.type] || a.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{a.message}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    <History className="mx-auto mb-2" size={28} />
                    Kayıt bulunamadı
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-2 text-xs text-slate-400">
        Son {state.activity.length} işlem gösteriliyor · yalnızca en güncel 300 kayıt saklanır.
      </p>
    </div>
  );
}
