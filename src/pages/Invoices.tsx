import { useMemo, useRef, useState } from 'react';
import {
  FileText,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Search,
  Clock,
  Calculator,
} from 'lucide-react';
import { useStore } from '../lib/store';
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
import { formatCurrency, formatDate, formatDateTime, todayISO, cn } from '../lib/utils';
import type { Invoice } from '../lib/types';

function fileToDataUrl(file: File): Promise<{ data: string; mime: string; name: string }> {
  return new Promise((resolve, reject) => {
    if (file.size > 3.5 * 1024 * 1024) {
      reject(new Error('Dosya 3.5MB ustu. Google Drive linki kullanin.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ data: String(reader.result || ''), mime: file.type || 'application/octet-stream', name: file.name });
    reader.onerror = () => reject(new Error('Dosya okunamadi'));
    reader.readAsDataURL(file);
  });
}

export default function Invoices() {
  const { state, issueInvoice, cancelInvoice, createManualInvoice, currentUser, session, pushToast } =
    useStore();
  const myId = session?.staffId || state.currentUserId;
  const [tab, setTab] = useState<'mine' | 'all' | 'archive'>('mine');
  const [q, setQ] = useState('');
  const [issueOpen, setIssueOpen] = useState<Invoice | null>(null);
  const [form, setForm] = useState({
    invoiceNumber: '',
    driveUrl: '',
    notes: '',
    fileName: '',
    fileMime: '',
    fileData: '',
  });
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Personelin başka siteye gitmeden hızlıca KDV hesaplayabilmesi için:
  // girilen tutar KDV DAHIL toplam kabul edilir, seçilen orana göre matrah
  // ve KDV tutarı geriye doğru çıkarılır (matrah = toplam / (1 + oran/100)).
  const [kdvAmount, setKdvAmount] = useState<number>(0);
  const [kdvRate, setKdvRate] = useState<number>(20);
  const kdvCalc = useMemo(() => {
    const gross = kdvAmount || 0;
    const base = gross / (1 + kdvRate / 100);
    const vat = gross - base;
    return { base, vat, gross };
  }, [kdvAmount, kdvRate]);

  const invoices = useMemo(() => {
    let rows = (state.invoices || []).filter((i) => !i.deletedAt);
    if (tab === 'mine') rows = rows.filter((i) => i.responsibleStaffId === myId && i.status === 'pending');
    if (tab === 'all') rows = rows.filter((i) => i.status === 'pending');
    if (tab === 'archive') rows = rows.filter((i) => i.status === 'issued' || i.status === 'cancelled');
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter((i) => {
        const res = state.reservations.find((r) => r.id === i.reservationId);
        const g = state.guests.find((x) => x.id === res?.guestId);
        return (
          (res?.code || '').toLowerCase().includes(s) ||
          (i.invoiceNumber || '').toLowerCase().includes(s) ||
          (i.responsibleName || '').toLowerCase().includes(s) ||
          `${g?.firstName || ''} ${g?.lastName || ''}`.toLowerCase().includes(s)
        );
      });
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state, tab, myId, q]);

  const stats = useMemo(() => {
    const all = (state.invoices || []).filter((i) => !i.deletedAt);
    const pending = all.filter((i) => i.status === 'pending');
    const mine = pending.filter((i) => i.responsibleStaffId === myId);
    const overdue = pending.filter((i) => i.dueAt < new Date().toISOString());
    const issued = all.filter((i) => i.status === 'issued');
    return {
      pending: pending.length,
      mine: mine.length,
      overdue: overdue.length,
      issued: issued.length,
      pendingAmount: pending.reduce((s, i) => s + i.amount, 0),
    };
  }, [state.invoices, myId]);

  const openIssue = (inv: Invoice) => {
    setIssueOpen(inv);
    setErr('');
    setForm({
      invoiceNumber: inv.invoiceNumber || '',
      driveUrl: inv.driveUrl || '',
      notes: inv.notes || '',
      fileName: '',
      fileMime: '',
      fileData: '',
    });
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const f = await fileToDataUrl(file);
      setForm((x) => ({ ...x, fileName: f.name, fileMime: f.mime, fileData: f.data }));
      setErr('');
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    }
  };

  const submitIssue = () => {
    if (!issueOpen) return;
    if (!form.invoiceNumber.trim()) {
      setErr('Fatura numarasi zorunlu');
      return;
    }
    if (!form.fileData && !form.driveUrl.trim()) {
      setErr('Fatura PDF/gorsel dosyasi VEYA Google Drive linki zorunlu');
      return;
    }
    // If only drive link, store a placeholder file marker
    const payload = {
      invoiceNumber: form.invoiceNumber.trim(),
      fileName: form.fileName || (form.driveUrl ? 'drive-link.txt' : 'fatura'),
      fileMime: form.fileMime || 'text/plain',
      fileData:
        form.fileData ||
        `data:text/plain;base64,${btoa('Drive: ' + form.driveUrl)}`,
      driveUrl: form.driveUrl.trim() || undefined,
      notes: form.notes,
    };
    issueInvoice(issueOpen.id, payload);
    setIssueOpen(null);
  };

  const downloadFile = (inv: Invoice) => {
    if (!inv.fileData) return;
    const a = document.createElement('a');
    a.href = inv.fileData;
    a.download = inv.fileName || `${inv.invoiceNumber || inv.id}.bin`;
    a.click();
  };

  const resInfo = (reservationId: string) => {
    const res = state.reservations.find((r) => r.id === reservationId);
    const g = state.guests.find((x) => x.id === res?.guestId);
    const room = state.rooms.find((r) => r.id === res?.roomId);
    return { res, g, room };
  };

  return (
    <div>
      <PageHeader
        title="Faturalar / Mali Arsiv"
        subtitle="Kesilmeyen faturalar, sorumlu personel ve dosya arsivi (denetim hazir)"
        actions={
          <Button
            variant="outline"
            onClick={() => {
              // create for first in-house without pending
              const r = state.reservations.find((x) => x.status === 'checked_in' && !x.deletedAt);
              if (!r) {
                pushToast('err', 'Aktif konaklama yok');
                return;
              }
              createManualInvoice(r.id);
            }}
          >
            Manuel fatura gorevi
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calculator size={18} className="text-teal-700" />
          <h3 className="font-semibold">Hızlı KDV Hesaplama</h3>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Faturadaki toplam (KDV dahil) tutarı gir, KDV oranını seç — matrah ve KDV tutarı otomatik hesaplanır. Başka bir siteye gitmene gerek yok.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Input
              label="Toplam Tutar (KDV Dahil) ₺"
              type="number"
              value={kdvAmount || ''}
              onChange={(e) => setKdvAmount(+e.target.value)}
              placeholder="Örn: 1500"
            />
          </div>
          <div className="w-32">
            <Select label="KDV Oranı" value={kdvRate} onChange={(e) => setKdvRate(+e.target.value)}>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((r) => (
                <option key={r} value={r}>
                  %{r}
                </option>
              ))}
            </Select>
          </div>
          {kdvAmount > 0 && (
            <div className="flex flex-wrap gap-4 rounded-xl bg-teal-50 px-4 py-2.5">
              <div>
                <p className="text-[10px] font-semibold uppercase text-teal-600">Matrah (KDV Hariç)</p>
                <p className="text-base font-bold text-teal-900">{formatCurrency(kdvCalc.base)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-teal-600">KDV Tutarı (%{kdvRate})</p>
                <p className="text-base font-bold text-teal-900">{formatCurrency(kdvCalc.vat)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-teal-600">Toplam (KDV Dahil)</p>
                <p className="text-base font-bold text-teal-900">{formatCurrency(kdvCalc.gross)}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" className="text-left" onClick={() => setTab('mine')}>
          <StatCard
            label="Bana ait bekleyen"
            value={stats.mine}
            hint="Kesmeniz gerekenler"
            icon={<AlertTriangle size={20} />}
            tone="amber"
            className={tab === 'mine' ? 'ring-2 ring-amber-400' : ''}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('all')}>
          <StatCard
            label="Tum bekleyen"
            value={stats.pending}
            hint={formatCurrency(stats.pendingAmount)}
            icon={<Clock size={20} />}
            tone="rose"
            className={tab === 'all' ? 'ring-2 ring-rose-400' : ''}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('all')}>
          <StatCard
            label="Suresi gecen"
            value={stats.overdue}
            hint="dueAt gecmis"
            icon={<AlertTriangle size={20} />}
            tone="violet"
          />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('archive')}>
          <StatCard
            label="Kesilen / arsiv"
            value={stats.issued}
            hint="Dosyali faturalar"
            icon={<CheckCircle2 size={20} />}
            tone="emerald"
            className={tab === 'archive' ? 'ring-2 ring-emerald-400' : ''}
          />
        </button>
      </div>

      {stats.mine > 0 && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
          <strong>Zorunlu is:</strong> {stats.mine} faturaniz bekliyor. Dosya yuklemeden &quot;kesildi&quot;
          isaretlenemez. Drive linki de kabul edilir.
        </div>
      )}

      <Card className="mb-3 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-1.5">
            {(
              [
                ['mine', 'Benim bekleyenlerim'],
                ['all', 'Tum bekleyenler'],
                ['archive', 'Arsiv'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold',
                  tab === k ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kod, misafir, fatura no, personel..."
              className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {invoices.length === 0 ? (
          <EmptyState title="Kayit yok" desc="Bu filtrede fatura gorevi bulunmuyor." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3">Rezervasyon</th>
                  <th className="px-3 py-3">Tetik</th>
                  <th className="px-3 py-3">Tutar</th>
                  <th className="px-3 py-3">Sorumlu</th>
                  <th className="px-3 py-3">Son tarih</th>
                  <th className="px-3 py-3">Fatura no / dosya</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const { res, g, room } = resInfo(inv.reservationId);
                  const overdue = inv.status === 'pending' && inv.dueAt < new Date().toISOString();
                  return (
                    <tr key={inv.id} className={cn(overdue && 'bg-rose-50/40')}>
                      <td className="px-3 py-2.5">
                        <Badge
                          color={
                            inv.status === 'issued'
                              ? 'emerald'
                              : inv.status === 'cancelled'
                                ? 'slate'
                                : overdue
                                  ? 'rose'
                                  : 'amber'
                          }
                        >
                          {inv.status === 'issued'
                            ? 'Kesildi'
                            : inv.status === 'cancelled'
                              ? 'Iptal'
                              : overdue
                                ? 'Gecikmis'
                                : 'Bekliyor'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-teal-800">{res?.code || '-'}</p>
                        <p className="text-xs text-slate-500">
                          {g?.firstName} {g?.lastName} · Oda {room?.number}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-xs capitalize">{inv.trigger}</td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <p className="font-medium">{inv.responsibleName}</p>
                        {inv.responsibleStaffId === myId && (
                          <span className="text-amber-700">Siz</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {formatDateTime(inv.dueAt)}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {inv.invoiceNumber ? (
                          <p className="font-semibold">{inv.invoiceNumber}</p>
                        ) : (
                          <p className="text-slate-400">-</p>
                        )}
                        {inv.fileName && <p className="text-slate-500">{inv.fileName}</p>}
                        {inv.driveUrl && (
                          <a
                            href={inv.driveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-teal-700 underline"
                          >
                            Drive <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap justify-end gap-1">
                          {inv.status === 'pending' && (
                            <Button size="sm" onClick={() => openIssue(inv)}>
                              <Upload size={14} /> Fatura kes
                            </Button>
                          )}
                          {inv.status === 'issued' && inv.fileData && (
                            <Button size="sm" variant="outline" onClick={() => downloadFile(inv)}>
                              <Download size={14} /> Indir
                            </Button>
                          )}
                          {inv.status === 'pending' && inv.responsibleStaffId === myId && (
                            <Button size="sm" variant="ghost" onClick={() => cancelInvoice(inv.id)}>
                              Iptal
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-4 text-xs leading-relaxed text-slate-500">
        <p className="font-semibold text-slate-700">Arsiv notu</p>
        <p className="mt-1">
          Faturalar tarayicida sifreli yerel depoda (localStorage/IndexedDB) saklanir; kucuk PDF/PNG dosyalari
          yuklenebilir. Buyuk dosyalar icin Google Drive linki ekleyin. Denetimde arama: rezervasyon kodu,
          misafir adi veya fatura numarasi ile saniyeler icinde bulunur. Ayarlar &gt; JSON yedek ile tum
          arsiv disa aktarilabilir.
        </p>
      </Card>

      <Modal open={!!issueOpen} onClose={() => setIssueOpen(null)} title="Fatura kes / dosya yukle" wide>
        {issueOpen && (
          <div className="space-y-3">
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Fatura dosyasi veya Drive linki olmadan kayit tamamlanmaz. Sorumlu: {issueOpen.responsibleName}
            </p>
            {err && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">
                Fatura numarasi <span className="text-rose-500">*</span>
              </span>
              <input
                value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="ORN: GIB-2026-000123"
              />
            </label>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">
                Fatura dosyasi (PDF/PNG/JPG) <span className="text-rose-500">*</span>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*,.png,.jpg,.jpeg"
                className="block w-full text-sm"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              {form.fileName && (
                <p className="mt-1 text-xs text-emerald-700">Yuklendi: {form.fileName}</p>
              )}
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">
                Google Drive / harici link (dosya yoksa zorunlu)
              </span>
              <input
                value={form.driveUrl}
                onChange={(e) => setForm({ ...form, driveUrl: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="https://drive.google.com/..."
              />
            </label>
            <Textarea
              label="Not"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIssueOpen(null)}>
                Vazgec
              </Button>
              <Button onClick={submitIssue}>
                <FileText size={14} /> Kesildi olarak kaydet
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
