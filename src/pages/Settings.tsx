import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { Button, Card, Input, PageHeader, Select, Badge } from '../components/ui';
import { formatDateTime } from '../lib/utils';
import {
  BUILTIN_SUPABASE_ANON,
  BUILTIN_SUPABASE_URL,
  TEAM_SQL,
  applyTeamFromQuery,
  bootstrapTeamConnection,
  buildTeamInviteLink,
  getTeamKey,
  getTeamMeta,
  getTeamUrl,
  isTeamEnabled,
  resetSupabaseClient,
  setTeamCreds,
  setTeamEnabled,
  setTeamMeta,
  teamPing,
  listBackups,
  restoreBackup,
  type BackupInfo,
} from '../lib/teamSync';
import {
  Camera,
  Download,
  History,
  RotateCcw,
  Shield,
  HardDrive,
} from 'lucide-react';

export default function Settings() {
  const {
    state,
    updateSettings,
    resetData,
    currentUser,
    lastSaved,
    createManualSnapshot,
    getSnapshots,
    restoreSnapshotById,
    restoreLastBackup,
    exportFullBackup,
    restoreArchived,
    pushToCloud,
    pullFromCloud,
    setOnlineMode,
    cloudStatus,
    isManager,
    pushToast,
  } = useStore();

  const [form, setForm] = useState({ ...state.settings });
  const [saved, setSaved] = useState(false);
  const [snaps, setSnaps] = useState(() => getSnapshots());
  const [resetStep, setResetStep] = useState(0);
  const [resetConfirm, setResetConfirm] = useState('');
  const [sbUrl, setSbUrl] = useState(() => getTeamUrl() || BUILTIN_SUPABASE_URL);
  const [sbKey, setSbKey] = useState(() => getTeamKey() || BUILTIN_SUPABASE_ANON);
  const [teamOn, setTeamOn] = useState(() => isTeamEnabled());
  const [teamMsg, setTeamMsg] = useState('');
  const [teamBusy, setTeamBusy] = useState(false);
  const teamMeta = getTeamMeta();
  const [cloudBackups, setCloudBackups] = useState<BackupInfo[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadCloudBackups = async () => {
    setBackupsLoading(true);
    const list = await listBackups(30);
    setCloudBackups(list);
    setBackupsLoading(false);
  };

  useEffect(() => {
    setForm({ ...state.settings });
  }, [state.settings]);

  useEffect(() => {
    if (isManager) void loadCloudBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  useEffect(() => {
    void bootstrapTeamConnection().then(() => {
      setSbUrl(getTeamUrl());
      setSbKey(getTeamKey());
      setTeamOn(true);
      setTeamEnabled(true);
      setOnlineMode(true);
      setTeamMsg('Ortak Supabase baglantisi hazir. Test + Ilk yukleme yapin.');
    });
  }, []);

  const refreshSnaps = () => setSnaps(getSnapshots());

  const save = () => {
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const archive = state.archive ?? [];

  return (
    <div>
      <PageHeader title="Ayarlar" subtitle="Otel profili, Google Sheets ekip baglantisi, yedekleme · panel v3.2" />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Shield size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Koruma</p>
            <p className="font-semibold text-sm">Soft-delete + arşiv</p>
            <p className="text-[11px] text-slate-400">Silinen kayıtlar kalıcı silinmez</p>
          </div>
        </Card>
        <Card className="p-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
            <HardDrive size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Depolama</p>
            <p className="font-semibold text-sm">localStorage + IndexedDB</p>
            <p className="text-[11px] text-slate-400">
              {lastSaved ? `Son kayıt: ${formatDateTime(lastSaved)}` : 'Henüz kayıt yok'}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <History size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Anlık görüntü</p>
            <p className="font-semibold text-sm">{snaps.length} yedek nokta</p>
            <p className="text-[11px] text-slate-400">Otomatik + manuel</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 font-semibold">Otel Bilgileri</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Otel Adı" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Logo Kısa Kod" value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value.slice(0, 3) })} />
            <Input label="Adres" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="sm:col-span-2" />
            <Input label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="E-posta" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Select label="Para Birimi" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="TRY">TRY — Türk Lirası</option>
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — Dolar</option>
              <option value="GBP">GBP — Sterlin</option>
            </Select>
            <Input label="Yıldız" type="number" min={1} max={5} value={form.stars} onChange={(e) => setForm({ ...form, stars: +e.target.value })} />
            <Input label="KDV / Vergi %" type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: +e.target.value })} />
            <Input label="Check-in Saati" value={form.checkInTime} onChange={(e) => setForm({ ...form, checkInTime: e.target.value })} />
            <Input label="Check-out Saati" value={form.checkOutTime} onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })} />
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button type="button" onClick={save}>Kaydet</Button>
            {saved && <span className="text-sm text-emerald-600">Kaydedildi ✓</span>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">Sistem</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Aktif kullanıcı</dt><dd className="font-medium">{currentUser?.name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Rol</dt><dd className="font-medium">{currentUser?.role}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Rezervasyon</dt><dd className="font-medium">{state.reservations.filter(r => !r.deletedAt).length}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Arşiv kaydı</dt><dd className="font-medium">{archive.length}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Aktivite</dt><dd className="font-medium">{state.activity.length}</dd></div>
            </dl>
          </Card>

          <Card className="p-5">
            <h3 className="mb-2 font-semibold flex items-center gap-2">
              <Camera size={16} /> Veri Koruma
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Her değişiklik otomatik kaydedilir. Silinen öğeler arşive gider. Sıfırlama bile önceki veriyi anlık görüntüde tutar.
            </p>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={() => { createManualSnapshot(); refreshSnaps(); }}>
                <Camera size={16} /> Anlık Görüntü Al
              </Button>
              <Button type="button" variant="outline" onClick={exportFullBackup}>
                <Download size={16} /> Tam JSON Yedek İndir
              </Button>
              <Button type="button" variant="secondary" onClick={() => { restoreLastBackup(); refreshSnaps(); }}>
                <RotateCcw size={16} /> Son Yedeğe Dön
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Anlık Görüntüler</h3>
            <Button type="button" size="sm" variant="ghost" onClick={refreshSnaps}>Yenile</Button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {snaps.length === 0 && (
              <p className="text-sm text-slate-400 py-6 text-center">Henüz anlık görüntü yok — birkaç işlemden sonra otomatik oluşur.</p>
            )}
            {snaps.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.label}</p>
                  <p className="text-[11px] text-slate-400">{formatDateTime(s.ts)}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Bu anlık görüntüye dönülsün mü? Mevcut durum da yedeklenecek.')) {
                      restoreSnapshotById(s.id);
                      refreshSnaps();
                    }
                  }}
                >
                  Geri Yükle
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Silinenler Arşivi</h3>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {archive.length === 0 && (
              <p className="text-sm text-slate-400 py-6 text-center">Arşiv boş — silinen kayıtlar burada görünür.</p>
            )}
            {archive.slice(0, 40).map((a) => {
              const data = a.data as { number?: string; firstName?: string; lastName?: string; name?: string; type?: string; code?: string };
              const label =
                data.number ||
                (data.firstName ? `${data.firstName} ${data.lastName ?? ''}` : '') ||
                data.name ||
                data.type ||
                data.code ||
                a.entity;
              return (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge color="slate">{a.entity}</Badge>
                      <span className="font-medium truncate">{label}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {formatDateTime(a.deletedAt)} · {a.deletedBy}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => restoreArchived(a.id)}>
                    Geri Al
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-4 p-5 border-rose-100">
        <h3 className="mb-2 font-semibold text-rose-700">Demo Veriye Sıfırla</h3>
        <p className="mb-3 text-sm text-slate-500">
          Mevcut veriniz <strong>silinmez</strong> — önce otomatik anlık görüntü alınır. İstediğiniz zaman geri yükleyebilirsiniz.
        </p>
        {resetStep === 0 ? (
          <Button type="button" variant="danger" onClick={() => setResetStep(1)}>
            Sıfırlama Başlat
          </Button>
        ) : (
          <div className="space-y-3 max-w-md">
            <p className="text-sm text-rose-800">
              Onay için aşağıya <code className="rounded bg-rose-50 px-1">SIFIRLA</code> yazın:
            </p>
            <Input
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="SIFIRLA"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="danger"
                disabled={resetConfirm !== 'SIFIRLA'}
                onClick={() => {
                  resetData();
                  setResetStep(0);
                  setResetConfirm('');
                  refreshSnaps();
                }}
              >
                Onayla ve Sıfırla
              </Button>
              <Button type="button" variant="outline" onClick={() => { setResetStep(0); setResetConfirm(''); }}>
                Vazgeç
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="mb-3 font-semibold">Son Aktiviteler</h3>
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {state.activity.slice(0, 12).map((a) => (
            <div key={a.id} className="text-xs">
              <p className="text-slate-700">{a.message}</p>
              <p className="text-slate-400">{a.user} · {formatDateTime(a.timestamp)}</p>
            </div>
          ))}
        </div>
      </Card>

      
      <Card className="mt-4 p-5 border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-emerald-900">Canli ekip (Supabase)</h3>
            <p className="mt-1 text-sm text-slate-600">
              Google Sheets yerine gercek online veritabani. Ayni anda tum personel ayni rezervasyonlari gorur.
              Kurulum 5 dakika, ucretsiz.
            </p>
          </div>
          <Badge color={teamOn && sbUrl && sbKey ? 'emerald' : 'slate'}>
            {teamOn && sbUrl && sbKey ? 'Online' : 'Kapali'}
          </Badge>
        </div>

        <ol className="mb-4 list-decimal space-y-2 rounded-2xl border border-emerald-100 bg-white px-5 py-3 text-sm text-slate-700">
          <li>
            <a className="font-semibold text-emerald-800 underline" href="https://supabase.com" target="_blank" rel="noreferrer">
              supabase.com
            </a>{' '}
            → ucretsiz hesap → <strong>New project</strong> olusturun
          </li>
          <li>
            Sol menu <strong>SQL Editor</strong> → New query → asagidaki SQL&apos;i yapistirip{' '}
            <strong>Run</strong>
          </li>
          <li>
            <strong>Project Settings → API</strong> → <em>Project URL</em> ve <em>anon public</em> key kopyalayin
          </li>
          <li>Asagiya yapistirin → Test → Ilk yukleme → Personel davet linkini gonderin</li>
        </ol>

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">1) SQL (bir kez calistirin)</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(TEAM_SQL);
                  pushToast('ok', 'SQL kopyalandi — Supabase SQL Editor\'e yapistirin');
                } catch {
                  pushToast('err', 'Kopyalanamadi');
                }
              }}
            >
              SQL kopyala
            </Button>
          </div>
          <pre className="max-h-36 overflow-auto rounded-xl bg-slate-900 p-3 text-[10px] leading-relaxed text-emerald-100">
            {TEAM_SQL}
          </pre>
        </div>

        <div className="mb-3 grid gap-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">2) Project URL</span>
            <input
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">3) anon public key</span>
            <input
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
              placeholder="eyJhbGciOi..."
              className="h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs"
            />
          </label>
        </div>

        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={teamOn}
            onChange={(e) => {
              setTeamOn(e.target.checked);
              setTeamEnabled(e.target.checked);
              setOnlineMode(e.target.checked);
              setTeamMeta({ status: e.target.checked ? 'idle' : 'off' });
            }}
          />
          Canli ekip senkronu acik
        </label>

        <div className="mb-4 rounded-2xl border-2 border-sky-300 bg-sky-50 px-4 py-3">
          <p className="font-bold text-sky-950">Personel davet linki</p>
          <p className="mt-1 text-xs text-sky-900">
            Personel SADECE site linki ile degil, bu link ile girmeli (Supabase bilgisi icerir).
          </p>
          <p className="mt-2 break-all rounded-lg bg-white px-2 py-2 font-mono text-[11px] text-slate-800">
            {sbUrl && sbKey ? buildTeamInviteLink() : 'Once URL ve anon key girin...'}
          </p>
          <Button
            type="button"
            className="mt-3"
            disabled={!sbUrl || !sbKey}
            onClick={async () => {
              setTeamCreds(sbUrl, sbKey);
              resetSupabaseClient();
              setTeamEnabled(true);
              setTeamOn(true);
              setOnlineMode(true);
              const link = buildTeamInviteLink();
              try {
                await navigator.clipboard.writeText(link);
                pushToast('ok', 'Personel davet linki kopyalandi');
                setTeamMsg('Davet linki kopyalandi. Bunu personelinize gonderin.');
              } catch {
                pushToast('err', 'Kopyalanamadi — linki elle secin');
              }
            }}
          >
            Personel davet linkini kopyala
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={teamBusy || !sbUrl || !sbKey}
            onClick={async () => {
              setTeamBusy(true);
              setTeamCreds(sbUrl, sbKey);
              resetSupabaseClient();
              const r = await teamPing();
              setTeamMsg(r.message);
              pushToast(r.ok ? 'ok' : 'err', r.message);
              setTeamBusy(false);
            }}
          >
            Test
          </Button>
          <Button
            type="button"
            disabled={teamBusy || !sbUrl || !sbKey}
            onClick={async () => {
              setTeamBusy(true);
              try {
                setTeamCreds(sbUrl, sbKey);
                resetSupabaseClient();
                setTeamEnabled(true);
                setTeamOn(true);
                setOnlineMode(true);
                const r = await pushToCloud(true);
                setTeamMsg(r);
                pushToast('ok', r);
              } catch (e) {
                const m = String(e instanceof Error ? e.message : e);
                setTeamMsg(m);
                pushToast('err', m);
              }
              setTeamBusy(false);
            }}
          >
            Ilk yukleme (ortak DB)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={teamBusy || !sbUrl || !sbKey}
            onClick={async () => {
              setTeamBusy(true);
              try {
                setTeamCreds(sbUrl, sbKey);
                resetSupabaseClient();
                const r = await pullFromCloud(true);
                setTeamMsg(r);
                pushToast('ok', r);
              } catch (e) {
                const m = String(e instanceof Error ? e.message : e);
                setTeamMsg(m);
                pushToast('err', m);
              }
              setTeamBusy(false);
            }}
          >
            Simdi senkronla (Pull)
          </Button>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Durum: {cloudStatus || teamMeta.status} · v{teamMeta.lastVersion || 0}
          {teamMeta.lastBy ? ` · ${teamMeta.lastBy}` : ''}
          {teamMeta.lastPushAt ? ` · push ${formatDateTime(teamMeta.lastPushAt)}` : ''}
        </p>
        {teamMsg && (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">{teamMsg}</p>
        )}
        {teamMeta.lastError && (
          <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{teamMeta.lastError}</p>
        )}
      </Card>

      {isManager && (
        <Card className="mt-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <HardDrive size={18} /> Günlük Otomatik Yedekler
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Her gün sabah verinin bir kopyası otomatik olarak ayrı bir yerde saklanır (son 60 gün). Bir sorun
                olursa aşağıdan istediğin günün yedeğini geri yükleyebilirsin.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={backupsLoading} onClick={() => void loadCloudBackups()}>
              Yenile
            </Button>
          </div>

          {cloudBackups.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              {backupsLoading ? 'Yükleniyor...' : 'Henüz yedek yok — ilk otomatik yedek yarın sabah alınacak.'}
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {cloudBackups.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{b.id}</p>
                    <p className="text-xs text-slate-400">Alındı: {formatDateTime(b.createdAt)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={restoringId === b.id}
                    onClick={async () => {
                      const ok1 = window.confirm(
                        `${b.id} tarihli yedeği geri yüklemek istediğine emin misin? Bu, ŞU ANKİ canlı veriyi o günün haliyle DEĞİŞTİRECEK. Tüm cihazlar bu veriyi görecek.`
                      );
                      if (!ok1) return;
                      const ok2 = window.confirm('Son onay: geri yükleme geri alınamaz. Devam edilsin mi?');
                      if (!ok2) return;
                      setRestoringId(b.id);
                      try {
                        const restored = await restoreBackup(b.id, currentUser?.name || 'Yönetici');
                        if (restored) {
                          pushToast('ok', `${b.id} yedeği geri yüklendi. Sayfa yenileniyor...`);
                          setTimeout(() => window.location.reload(), 1200);
                        } else {
                          pushToast('err', 'Yedek geri yüklenemedi.');
                        }
                      } catch (e) {
                        pushToast('err', String(e instanceof Error ? e.message : e));
                      }
                      setRestoringId(null);
                    }}
                  >
                    {restoringId === b.id ? 'Yükleniyor...' : 'Bu yedeği geri yükle'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="mt-4 p-5">
        <h3 className="mb-2 font-semibold">UYU ROOM HOTEL PMS</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          Rezervasyon kodları sıralı verilir (UYU-0001, UYU-0002…). Panel girişi zorunludur.
          Veri asla kaybolmaz: localStorage + yedek + IndexedDB + anlık görüntüler. Silme soft-delete ile arşive alınır.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Son rezervasyon sırası: <strong>UYU-{(state.reservationSeq || 0).toString().padStart(4, '0')}</strong>
          {' · '}Toplam kayıtlı: {state.reservations.filter((r) => !r.deletedAt).length}
        </p>
      </Card>
    </div>
  );
}
