import { useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
  X,
  PackageSearch,
  Images,
  Search,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  Layers,
} from 'lucide-react';
import { useStore } from '../lib/store';
import type { MenuItem } from '../lib/types';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader } from '../components/ui';
import { formatCurrency, resizeImageToBlob } from '../lib/utils';
import { uploadPublicImage } from '../lib/teamSync';

const empty = {
  name: '',
  category: 'Yiyecek',
  price: 0,
  available: true,
  description: '',
  imageUrl: '',
  stock: '' as number | '',
};

const CATEGORY_ICON: Record<string, string> = {
  'Yiyecek': '🍽️',
  'İçecek': '🥤',
  'Tatlı': '🍰',
  'Kahvaltı': '🍳',
  'Alkollü İçecek': '🍷',
};

export default function MenuManagement() {
  const { state, addMenuItem, updateMenuItem, deleteMenuItem, updateSettings } = useStore();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [imgBusy, setImgBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [q, setQ] = useState('');
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  const items = useMemo(
    () => (state.menuItems || []).filter((m) => !m.deletedAt),
    [state.menuItems]
  );
  const filteredItems = useMemo(() => {
    if (!q.trim()) return items;
    const s = q.trim().toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(s) || i.description?.toLowerCase().includes(s));
  }, [items, q]);
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))).sort(),
    [items]
  );
  const banners = state.settings.orderPageBanners || [];

  const toggleCat = (cat: string) => setOpenCats((o) => ({ ...o, [cat]: !o[cat] }));
  const isCatOpen = (cat: string) => (q.trim() ? true : openCats[cat] !== false); // default acik

  const stats = useMemo(() => {
    const outOfStock = items.filter((m) => typeof m.stock === 'number' && m.stock <= 0).length;
    const unavailable = items.filter((m) => !m.available).length;
    const totalValue = items.reduce((s, m) => s + m.price, 0);
    return { total: items.length, categories: categories.length, outOfStock, unavailable, totalValue };
  }, [items, categories]);

  const openCreate = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (m: MenuItem) => {
    setEditId(m.id);
    setForm({
      name: m.name,
      category: m.category,
      price: m.price,
      available: m.available,
      description: m.description || '',
      imageUrl: m.imageUrl || '',
      stock: typeof m.stock === 'number' ? m.stock : '',
    });
    setOpen(true);
  };

  const handleImagePick = async (file: File | undefined) => {
    if (!file) return;
    setImgBusy(true);
    try {
      const blob = await resizeImageToBlob(file, 480, 0.65);
      const url = await uploadPublicImage(blob, 'menu');
      if (url) {
        setForm((f) => ({ ...f, imageUrl: url }));
      } else {
        alert('Görsel yüklenemedi. İnternet bağlantısını kontrol edin.');
      }
    } catch {
      alert('Görsel işlenemedi.');
    }
    setImgBusy(false);
  };

  const handleBannerPick = async (file: File | undefined) => {
    if (!file) return;
    setBannerBusy(true);
    try {
      const blob = await resizeImageToBlob(file, 1280, 0.72);
      const url = await uploadPublicImage(blob, 'banner');
      if (url) {
        updateSettings({ orderPageBanners: [...banners, url] });
      } else {
        alert('Görsel yüklenemedi. İnternet bağlantısını kontrol edin.');
      }
    } catch {
      alert('Görsel işlenemedi.');
    }
    setBannerBusy(false);
  };

  const removeBanner = (idx: number) => {
    updateSettings({ orderPageBanners: banners.filter((_, i) => i !== idx) });
  };

  const save = () => {
    if (!form.name.trim() || form.price <= 0) return;
    const payload = {
      name: form.name,
      category: form.category,
      price: form.price,
      available: form.available,
      description: form.description,
      imageUrl: form.imageUrl,
      stock: form.stock === '' ? undefined : Number(form.stock),
    };
    if (editId) updateMenuItem(editId, payload);
    else addMenuItem(payload);
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Menü / Ürünler"
        subtitle="Restoran & kafe ürünleri, fiyatları ve stokları — oda servisi siparişlerinde kullanılır"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Ürün Ekle
          </Button>
        }
      />

      {/* Ozet istatistikler */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Toplam Ürün</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Kategori</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{stats.categories}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Tükenen</p>
          <p className={`mt-1 text-2xl font-bold ${stats.outOfStock > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{stats.outOfStock}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Satışta Değil</p>
          <p className={`mt-1 text-2xl font-bold ${stats.unavailable > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{stats.unavailable}</p>
        </Card>
      </div>

      {/* Banner yonetimi */}
      <Card className="mb-5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Images size={18} className="text-teal-700" />
          <div>
            <p className="font-semibold">Sipariş Sayfası Banner Görselleri</p>
            <p className="text-xs text-slate-500">
              Misafirin gördüğü sipariş sayfasının üstünde dönen slayt görselleri (otel, restoran, ürün fotoğrafları)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {banners.map((b, i) => (
            <div key={i} className="relative">
              <img src={b} alt="" className="h-20 w-32 rounded-lg object-cover" />
              <button
                onClick={() => removeBanner(i)}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <label className="flex h-20 w-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-teal-400 hover:text-teal-600">
            <ImagePlus size={18} />
            <span className="text-[11px]">{bannerBusy ? 'Yükleniyor...' : 'Banner Ekle'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBannerPick(e.target.files?.[0])} />
          </label>
        </div>
      </Card>

      {/* Arama */}
      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ürün adı veya açıklamada ara..."
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      {items.length === 0 ? (
        <Card><EmptyState title="Henüz ürün eklenmemiş" /></Card>
      ) : filteredItems.length === 0 ? (
        <Card><EmptyState title="Aramanla eşleşen ürün yok" /></Card>
      ) : (
        categories.map((cat) => {
          const catItems = filteredItems.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;
          const catValue = catItems.reduce((s, m) => s + m.price, 0);
          const opened = isCatOpen(cat);
          return (
            <div key={cat} className="mb-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
              {/* Kategori basligi — acilir/kapanir */}
              <button
                onClick={() => toggleCat(cat)}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{CATEGORY_ICON[cat] || '🍴'}</span>
                  <div>
                    <p className="font-semibold text-slate-800">{cat}</p>
                    <p className="text-xs text-slate-400">
                      {catItems.length} ürün · Ort. {formatCurrency(catValue / catItems.length)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{catItems.length}</Badge>
                  {opened ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
              </button>

              {opened && (
                <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {catItems.map((m) => {
                    const lowStock = typeof m.stock === 'number' && m.stock <= 3;
                    const outOfStock = typeof m.stock === 'number' && m.stock <= 0;
                    return (
                      <Card key={m.id} className="overflow-hidden p-0">
                        <div className="flex h-36 w-full items-center justify-center bg-slate-50">
                          {m.imageUrl ? (
                            <img src={m.imageUrl} alt={m.name} className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-slate-300">
                              <UtensilsCrossed size={26} />
                              <span className="text-[10px]">Görsel yok</span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{m.name}</p>
                              {m.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{m.description}</p>}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => { if (confirm('Ürün silinsin mi?')) deleteMenuItem(m.id); }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-lg font-bold text-teal-800">{formatCurrency(m.price)}</span>
                            <div className="flex gap-1.5">
                              {typeof m.stock === 'number' && (
                                <Badge color={outOfStock ? 'rose' : lowStock ? 'amber' : 'slate'}>
                                  <PackageSearch size={11} className="mr-1 inline" />
                                  Stok: {m.stock}
                                </Badge>
                              )}
                              <button
                                onClick={() => updateMenuItem(m.id, { available: !m.available })}
                                className="cursor-pointer"
                              >
                                <Badge color={m.available && !outOfStock ? 'emerald' : 'slate'}>
                                  {m.available && !outOfStock ? 'Mevcut' : 'Tükendi'}
                                </Badge>
                              </button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Ürünü Düzenle' : 'Yeni Ürün'}>
        <div className="space-y-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Görsel (opsiyonel)</span>
            {form.imageUrl ? (
              <div className="relative w-fit">
                <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-slate-50">
                  <img src={form.imageUrl} alt="" className="h-full w-full rounded-xl object-contain" />
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, imageUrl: '' })}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-teal-400 hover:text-teal-600">
                <ImagePlus size={22} />
                <span className="text-[11px]">{imgBusy ? 'Yükleniyor...' : 'Fotoğraf ekle'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImagePick(e.target.files?.[0])}
                />
              </label>
            )}
          </div>
          <Input label="Ürün Adı" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div>
            <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-600">
              <Layers size={12} /> Kategori
            </span>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              list="menu-categories"
            />
          </div>
          <datalist id="menu-categories">
            {['Yiyecek', 'İçecek', 'Tatlı', 'Kahvaltı', 'Alkollü İçecek'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fiyat (₺)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} />
            <Input
              label="Stok (opsiyonel — boş = sınırsız)"
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value === '' ? '' : +e.target.value })}
            />
          </div>
          <p className="text-xs text-slate-400">Stok sadece bu panelde görünür, misafire gösterilmez. Sipariş teslim edildikçe otomatik düşer.</p>
          <Input label="Açıklama (opsiyonel)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
            Şu an mevcut / satılabilir
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={save}>Kaydet</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
