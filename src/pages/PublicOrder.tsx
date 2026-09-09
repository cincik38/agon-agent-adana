import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Minus, ShoppingBag, CheckCircle2, UtensilsCrossed } from 'lucide-react';
import { useStore } from '../lib/store';
import { formatCurrency } from '../lib/utils';

export default function PublicOrder() {
  const { reservationId } = useParams();
  const { state, createCafeOrder, ready } = useStore();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [activeCat, setActiveCat] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const banners = state.settings.orderPageBanners || [];

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 4200);
    return () => clearInterval(t);
  }, [banners.length]);

  const res = state.reservations.find((r) => r.id === reservationId && !r.deletedAt);
  const guest = res ? state.guests.find((g) => g.id === res.guestId) : undefined;
  const room = res ? state.rooms.find((r) => r.id === res.roomId) : undefined;
  const menu = useMemo(
    () =>
      (state.menuItems || []).filter(
        (m) => !m.deletedAt && m.available && !(typeof m.stock === 'number' && m.stock <= 0)
      ),
    [state.menuItems]
  );
  const categories = useMemo(() => Array.from(new Set(menu.map((m) => m.category))), [menu]);
  const currentCat = activeCat || categories[0] || '';

  const cartItems = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ item: menu.find((m) => m.id === id)!, qty }))
    .filter((x) => x.item);
  const total = cartItems.reduce((a, x) => a + x.item.price * x.qty, 0);
  const totalCount = cartItems.reduce((a, x) => a + x.qty, 0);

  const changeQty = (id: string, delta: number) => {
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }));
  };

  const submit = () => {
    if (!res || !guest || cartItems.length === 0) return;
    const result = createCafeOrder({
      reservationId: res.id,
      guestId: guest.id,
      roomId: res.roomId,
      items: cartItems.map((x) => ({ menuItemId: x.item.id, name: x.item.name, price: x.item.price, qty: x.qty })),
      note: note || undefined,
    });
    if (typeof result === 'object' && 'error' in result) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c1a17]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (!res || !guest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c1a17] p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-white">Bağlantı geçersiz</p>
          <p className="mt-1 text-sm text-teal-100/60">Bu sipariş linki artık aktif değil. Lütfen resepsiyonla iletişime geçin.</p>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0c1a17] to-[#133a32] p-6 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle2 className="text-emerald-400" size={36} />
          </div>
          <p className="text-xl font-bold text-white">Siparişiniz alındı!</p>
          <p className="mt-2 text-sm text-teal-100/70">En kısa sürede Oda {room?.number}'e getirilecek.</p>
          <p className="mt-6 text-xs text-teal-100/40">Teşekkür ederiz — {state.settings.name || 'UYU ROOM HOTEL'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f1] pb-32">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0f2a24] via-[#164338] to-[#1c5245] px-6 pb-8 pt-10 text-white">
        {banners.length > 0 && (
          <div className="absolute inset-0">
            {banners.map((b, i) => (
              <img
                key={i}
                src={b}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                  i === bannerIdx ? 'opacity-40' : 'opacity-0'
                }`}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f2a24] via-[#0f2a24]/60 to-[#0f2a24]/20" />
          </div>
        )}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-400/10" />
        <div className="pointer-events-none absolute -bottom-14 left-10 h-32 w-32 rounded-full bg-emerald-300/10" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2 text-teal-200/80">
            <UtensilsCrossed size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">Oda Servisi</span>
          </div>
          <h1 className="text-2xl font-bold leading-tight">{state.settings.name || 'UYU ROOM HOTEL'}</h1>
          <p className="mt-2 text-sm text-teal-100/80">
            Merhaba <span className="font-semibold text-white">{guest.firstName}</span>, Oda {room?.number} —
            dilediğinizi seçin, kapınıza getirelim.
          </p>
        </div>
        {banners.length > 1 && (
          <div className="relative mt-5 flex justify-center gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setBannerIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === bannerIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-slate-200 bg-[#f7f5f1]/95 px-4 py-3 backdrop-blur">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                currentCat === cat
                  ? 'bg-[#164338] text-white shadow-sm'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {menu.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-400">Şu an menü hazırlanıyor, lütfen daha sonra tekrar deneyin.</p>
      ) : (
        <div className="space-y-3 px-4 pt-4">
          {menu.filter((m) => m.category === currentCat).map((m) => (
            <div key={m.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
              {m.imageUrl ? (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                  <img src={m.imageUrl} alt={m.name} className="h-full w-full rounded-xl object-contain" />
                </div>
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
                  <UtensilsCrossed size={22} />
                </div>
              )}
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{m.name}</p>
                  {m.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{m.description}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#164338]">{formatCurrency(m.price)}</span>
                  {cart[m.id] ? (
                    <div className="flex items-center gap-2 rounded-full bg-[#164338] px-1 py-1">
                      <button
                        onClick={() => changeQty(m.id, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-4 text-center text-sm font-bold text-white">{cart[m.id]}</span>
                      <button
                        onClick={() => changeQty(m.id, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => changeQty(m.id, 1)}
                      className="flex items-center gap-1 rounded-full bg-[#164338]/10 px-3 py-1.5 text-xs font-bold text-[#164338]"
                    >
                      <Plus size={12} /> Ekle
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mx-4 mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {/* Cart bar */}
      {cartItems.length > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed inset-x-4 bottom-4 flex items-center justify-between rounded-2xl bg-[#164338] px-5 py-4 text-white shadow-xl"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingBag size={18} /> {totalCount} ürün — {formatCurrency(total)}
          </span>
          <span className="text-sm font-bold underline">Sepeti Gör</span>
        </button>
      )}

      {/* Cart review sheet */}
      {showCart && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={() => setShowCart(false)}>
          <div
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <h2 className="mb-3 text-lg font-bold text-slate-800">Sepetiniz</h2>
            <div className="space-y-3">
              {cartItems.map((x) => (
                <div key={x.item.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{x.item.name}</p>
                    <p className="text-xs text-slate-400">{formatCurrency(x.item.price)} adet</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeQty(x.item.id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-5 text-center text-sm font-bold">{x.qty}</span>
                    <button
                      onClick={() => changeQty(x.item.id, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sipariş notu (opsiyonel) — örn: acısız olsun"
              className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-teal-500"
              rows={2}
            />
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-500">Toplam</span>
              <span className="text-xl font-bold text-slate-800">{formatCurrency(total)}</span>
            </div>
            <button
              onClick={submit}
              className="mt-4 w-full rounded-2xl bg-[#164338] py-4 font-bold text-white"
            >
              Siparişi Onayla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
