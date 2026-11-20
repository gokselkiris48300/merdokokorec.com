import { Coffee, Flame, Minus, Plus, Receipt, Search, Wifi, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { MenuCategory, MenuItem, StandSettings } from '../types';

interface CustomerMenuProps {
  categories: MenuCategory[];
  settings: StandSettings;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  onOpenStand: () => void;
  onOpenAdmin: () => void;
}

interface TrayEntry {
  item: MenuItem;
  categoryName: string;
  quantity: number;
}

const LOGO_URL = '/assets/aistudio/03648E70-0E47-429D-8D86-6445A1B732AA_5227a2d0.png';

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) {
    return 'Henüz fiyat girilmedi';
  }
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(price)} ₺`;
}

export function CustomerMenu({
  categories,
  settings,
  loading,
  error,
  onRetry,
  onOpenStand,
  onOpenAdmin,
}: CustomerMenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tray, setTray] = useState<Record<string, TrayEntry>>({});
  const [showTrayDrawer, setShowTrayDrawer] = useState(false);

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('tr-TR');

  const filteredCategories = useMemo(() => {
    return categories
      .filter((cat) => selectedCategory === 'all' || cat.id === selectedCategory)
      .map((cat) => {
        if (!normalizedQuery) return cat;
        const catMatches = cat.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery);
        if (catMatches) return cat;
        return {
          ...cat,
          items: cat.items.filter((item) =>
            item.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
          ),
        };
      })
      .filter((cat) => cat.items.length > 0);
  }, [categories, selectedCategory, normalizedQuery]);

  const foodCategories = useMemo(
    () => filteredCategories.filter((c) => c.type === 'food'),
    [filteredCategories]
  );

  const beverageCategories = useMemo(
    () => filteredCategories.filter((c) => c.type === 'beverage'),
    [filteredCategories]
  );

  const trayEntries = useMemo(() => Object.values(tray), [tray]);
  const trayTotalCount = useMemo(
    () => trayEntries.reduce((sum, e) => sum + e.quantity, 0),
    [trayEntries]
  );
  const trayTotalPrice = useMemo(
    () => trayEntries.reduce((sum, e) => sum + (e.item.price || 0) * e.quantity, 0),
    [trayEntries]
  );

  function addToTray(item: MenuItem, categoryName: string) {
    if (!item.isAvailable || item.price === null) return;
    setTray((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          item,
          categoryName,
          quantity: existing ? existing.quantity + 1 : 1,
        },
      };
    });
  }

  function decrementTray(itemId: string) {
    setTray((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return {
        ...prev,
        [itemId]: { ...existing, quantity: existing.quantity - 1 },
      };
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      {/* Hero Banner with Seamless Logo Integration */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#000000]">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left: Official Merdo Kokoreç Logo */}
          <div className="lg:col-span-5 flex items-center justify-center bg-[#000000] p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-white/[0.08]">
            <img
              src={LOGO_URL}
              alt="Merdo Kokoreç Resmi Logosu"
              referrerPolicy="no-referrer"
              className="max-h-48 w-auto object-contain sm:max-h-56"
            />
          </div>

          {/* Right: Menu Header, Table Context & Filter Bar */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-[#090A0C] p-6 sm:p-8">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-400">
                <span className="text-[#FF7300] font-semibold">Dijital QR Menü</span>
                <span aria-hidden="true">·</span>
                <span>{settings.tagline}</span>
              </div>

              <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl text-balance">
                Güncel Lezzet ve Fiyat Listesi
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                Közde kuzu ve dana kokoreçten ızgara kasap köfteye, tavuk döner ve tavuk şişten
                soğuk içeceklere kadar tüm güncel fiyatlarımızı anlık olarak inceleyebilirsiniz.
              </p>
            </div>

            {/* Search Input */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ürün veya porsiyon ara (örn. Kokoreç, Ayran)..."
                  aria-label="Menüde ürün ara"
                  className="w-full rounded-xl border border-white/10 bg-[#121417] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-[#FF7300] focus:outline-none min-h-[44px]"
                />
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="rounded-xl border border-white/10 bg-[#121417] px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white min-h-[44px] whitespace-nowrap"
                >
                  Temizle
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Category Segmented Filter Bar */}
      <section aria-label="Kategori Filtreleri" className="mt-6">
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#121417] p-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[40px] ${
              selectedCategory === 'all'
                ? 'bg-[#FF7300] text-[#090A0C]'
                : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            Tümü
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[40px] ${
                selectedCategory === cat.id
                  ? 'bg-[#FF7300] text-[#090A0C]'
                  : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* Loading Skeleton */}
      {loading && categories.length === 0 && (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-96 animate-pulse rounded-2xl border border-white/[0.06] bg-[#121417]"
            />
          ))}
        </div>
      )}

      {/* Menu Load Error State */}
      {!loading && error && categories.length === 0 && (
        <div
          role="alert"
          className="mt-10 rounded-2xl border border-red-500/30 bg-[#121417] p-10 text-center"
        >
          <p className="font-display text-lg font-bold text-white">Menü Yüklenemedi</p>
          <p className="mt-1 text-sm text-zinc-400">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-lg bg-[#FF7300] px-5 py-2.5 text-xs font-bold text-[#090A0C] hover:bg-[#FF8826] min-h-[40px]"
            >
              Tekrar Dene
            </button>
          )}
        </div>
      )}

      {/* Empty Search Result */}
      {!loading && !error && filteredCategories.length === 0 && (
        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#121417] p-10 text-center">
          <p className="font-display text-lg font-bold text-white">Aranan ürün bulunamadı</p>
          <p className="mt-1 text-sm text-zinc-400">
            Farklı bir anahtar kelime deneyin veya tüm menüyü görüntüleyin.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-4 rounded-lg bg-[#FF7300] px-5 py-2.5 text-xs font-bold text-[#090A0C] hover:bg-[#FF8826] min-h-[40px]"
          >
            Tüm Menüyü Göster
          </button>
        </div>
      )}

      {/* Main Food Categories Grid */}
      {foodCategories.length > 0 && (
        <section aria-label="Ana Yemekler" className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {foodCategories.map((category) => (
            <article
              key={category.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121417]"
            >
              {/* Category Photograph */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#090A0C]">
                {category.imageUrl ? (
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#121417] to-[#090A0C]">
                    <Flame className="h-12 w-12 text-[#FF7300]/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#121417] via-[#090A0C]/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">
                    {category.name}
                  </h2>
                  {category.subtitle && (
                    <p className="mt-1 text-xs font-medium text-zinc-300">{category.subtitle}</p>
                  )}
                </div>
              </div>

              {/* Portion & Price Rows */}
              <div className="flex-1 divide-y divide-white/[0.07] px-5 pb-4 pt-2 sm:px-6">
                {category.items.map((item) => {
                  const inTrayQty = tray[item.id]?.quantity || 0;
                  const canAdd = item.isAvailable && item.price !== null;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-4 py-3.5 ${
                        !item.isAvailable ? 'opacity-55' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white sm:text-base">
                            {item.name}
                          </span>
                          {!item.isAvailable && (
                            <span className="text-xs font-medium text-zinc-400">· Tükendi</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {item.price === null ? (
                          <span className="text-xs font-medium italic text-zinc-400">
                            Henüz fiyat girilmedi
                          </span>
                        ) : (
                          <span
                            className={`font-mono text-base font-bold tabular-nums sm:text-lg ${
                              item.isAvailable ? 'text-[#FF7300]' : 'line-through text-zinc-500'
                            }`}
                          >
                            {formatPrice(item.price)}
                          </span>
                        )}

                        {canAdd && (
                          <div className="flex items-center gap-1">
                            {inTrayQty > 0 ? (
                              <div className="flex items-center gap-1 rounded-lg border border-[#FF7300]/40 bg-[#090A0C] p-0.5">
                                <button
                                  type="button"
                                  onClick={() => decrementTray(item.id)}
                                  aria-label={`${category.name} ${item.name} azalt`}
                                  className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/10 hover:text-white"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="min-w-[20px] text-center font-mono text-xs font-bold tabular-nums text-white">
                                  {inTrayQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => addToTray(item, category.name)}
                                  aria-label={`${category.name} ${item.name} artır`}
                                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#FF7300] hover:bg-[#FF7300]/15"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToTray(item, category.name)}
                                aria-label={`${category.name} ${item.name} hesaba ekle`}
                                title="Masa hesabına ekle"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#090A0C] text-zinc-400 transition-colors hover:border-[#FF7300] hover:text-[#FF7300]"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Beverages Section */}
      {beverageCategories.map((bevCat) => (
        <section
          key={bevCat.id}
          aria-label={bevCat.name}
          className="mt-8 rounded-2xl border border-white/[0.08] bg-[#121417] p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#FF7300]">
                <Coffee className="h-4 w-4" />
                <span>Soğuk Servis</span>
              </div>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-white">
                {bevCat.name}
              </h2>
            </div>
            {bevCat.subtitle && (
              <p className="text-xs font-medium text-zinc-400">{bevCat.subtitle}</p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-x-8 divide-y divide-white/[0.06] md:grid-cols-2 md:divide-y-0">
            {bevCat.items.map((item) => {
              const inTrayQty = tray[item.id]?.quantity || 0;
              const canAdd = item.isAvailable && item.price !== null;

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-4 border-b border-white/[0.06] py-3.5 ${
                    !item.isAvailable ? 'opacity-55' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-white sm:text-base truncate">
                      {item.name}
                    </span>
                    {!item.isAvailable && (
                      <span className="text-xs font-medium text-zinc-400 shrink-0">· Tükendi</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {item.price === null ? (
                      <span className="text-xs font-medium italic text-zinc-400">
                        Henüz fiyat girilmedi
                      </span>
                    ) : (
                      <span
                        className={`font-mono text-base font-bold tabular-nums ${
                          item.isAvailable ? 'text-[#FF7300]' : 'line-through text-zinc-500'
                        }`}
                      >
                        {formatPrice(item.price)}
                      </span>
                    )}

                    {canAdd && (
                      <div className="flex items-center gap-1">
                        {inTrayQty > 0 ? (
                          <div className="flex items-center gap-1 rounded-lg border border-[#FF7300]/40 bg-[#090A0C] p-0.5">
                            <button
                              type="button"
                              onClick={() => decrementTray(item.id)}
                              aria-label={`${item.name} azalt`}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/10 hover:text-white"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-[20px] text-center font-mono text-xs font-bold tabular-nums text-white">
                              {inTrayQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => addToTray(item, bevCat.name)}
                              aria-label={`${item.name} artır`}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-[#FF7300] hover:bg-[#FF7300]/15"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToTray(item, bevCat.name)}
                            aria-label={`${item.name} hesaba ekle`}
                            title="Masa hesabına ekle"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#090A0C] text-zinc-400 transition-colors hover:border-[#FF7300] hover:text-[#FF7300]"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Quiet Footer with Optional Wi-Fi & Quick Links */}
      <footer className="mt-12 border-t border-white/[0.08] pt-6 text-xs text-zinc-500">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-zinc-300">Merdo Kokoreç</span>
            <span aria-hidden="true">·</span>
            <span>Fiyatlara KDV dahildir</span>
            {settings.wifiName && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 text-zinc-300">
                  <Wifi className="h-3.5 w-3.5 text-[#FF7300]" />
                  Wi-Fi: {settings.wifiName}
                  {settings.wifiPassword ? ` / Şifre: ${settings.wifiPassword}` : ''}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onOpenStand}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Masa Standı QR Oluştur
            </button>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-zinc-400 hover:text-[#FF7300] transition-colors"
            >
              Yönetici Girişi
            </button>
          </div>
        </div>
      </footer>

      {/* Compact Sticky Table Check Bar (only shown when customer adds >= 1 item) */}
      {trayTotalCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md">
          <button
            type="button"
            onClick={() => setShowTrayDrawer(true)}
            className="flex w-full items-center justify-between rounded-xl bg-[#FF7300] px-5 py-3 text-[#090A0C] shadow-lg shadow-black/50 transition-transform active:scale-[0.99] min-h-[48px]"
          >
            <div className="flex items-center gap-2.5 text-sm font-bold">
              <Receipt className="h-4 w-4" />
              <span>Masa Hesap Özeti ({trayTotalCount} ürün)</span>
            </div>
            <span className="font-mono text-base font-extrabold tabular-nums">
              {formatPrice(trayTotalPrice)}
            </span>
          </button>
        </div>
      )}

      {/* Table Check Drawer / Modal */}
      {showTrayDrawer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-white/10 bg-[#121417] p-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Sipariş Hesap Özeti
                </h3>
                <p className="text-xs text-zinc-400">
                  Seçtiğiniz ürünlerin tahmini toplam tutarıdır.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTrayDrawer(false)}
                aria-label="Özeti kapat"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {trayEntries.map(({ item, categoryName, quantity }) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {categoryName} · {item.name}
                    </p>
                    <p className="font-mono text-xs tabular-nums text-zinc-400">
                      {formatPrice(item.price)} × {quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#090A0C] p-0.5">
                      <button
                        type="button"
                        onClick={() => decrementTray(item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/10"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[20px] text-center font-mono text-xs font-bold tabular-nums text-white">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToTray(item, categoryName)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[#FF7300] hover:bg-[#FF7300]/15"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="min-w-[68px] text-right font-mono text-sm font-bold tabular-nums text-[#FF7300]">
                      {formatPrice((item.price || 0) * quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-white/[0.1] pt-4">
              <span className="text-sm font-semibold text-zinc-300">Toplam Tutar</span>
              <span className="font-mono text-2xl font-extrabold tabular-nums text-[#FF7300]">
                {formatPrice(trayTotalPrice)}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setTray({});
                  setShowTrayDrawer(false);
                }}
                className="flex-1 rounded-xl border border-white/15 bg-[#090A0C] py-3 text-xs font-semibold text-zinc-300 hover:text-white min-h-[44px]"
              >
                Listeyi Temizle
              </button>
              <button
                type="button"
                onClick={() => setShowTrayDrawer(false)}
                className="flex-1 rounded-xl bg-[#FF7300] py-3 text-xs font-bold text-[#090A0C] hover:bg-[#FF8826] min-h-[44px]"
              >
                Menüye Dön
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
