import {
  Check,
  Clock,
  Eye,
  EyeOff,
  FolderPlus,
  Lock,
  Pencil,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  AdminUser,
  AuditLogEntry,
  CategoryType,
  MenuCategory,
  MenuResponse,
  StandSettings,
} from '../types';
import { authFetch } from '../utils/authStorage';

interface AdminPanelProps {
  adminUser: AdminUser | null;
  showInitialHint: boolean;
  onLoginSuccess: (user: AdminUser, token?: string) => void;
  onSessionExpired: () => void;
  onMenuUpdated: (menu: MenuResponse) => void;
  onOpenMenu: () => void;
}

type AdminTab = 'prices' | 'logs' | 'settings';
type CreateMode = 'item' | 'category';

interface DraftItemState {
  nameInput: string;
  priceInput: string;
  isAvailable: boolean;
}

const LOGO_URL = '/assets/aistudio/03648E70-0E47-429D-8D86-6445A1B732AA_5227a2d0.png';

function formatPriceDisplay(price: number | null): string {
  if (price === null || price === undefined) return 'Girilmedi';
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(price)} ₺`;
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function parseDraftPrice(input: string): { valid: boolean; value: number | null } {
  const trimmed = input.trim();
  if (trimmed === '') return { valid: true, value: null };
  const normalized = trimmed.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { valid: false, value: null };
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0 || num > 100000) {
    return { valid: false, value: null };
  }
  return { valid: true, value: Math.round(num * 100) / 100 };
}

export function AdminPanel({
  adminUser,
  showInitialHint,
  onLoginSuccess,
  onSessionExpired,
  onMenuUpdated,
  onOpenMenu,
}: AdminPanelProps) {
  // Login state
  const [username, setUsername] = useState(showInitialHint ? 'admin' : '');
  const didPrefillUsername = useRef(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Admin workspace state
  const [activeTab, setActiveTab] = useState<AdminTab>('prices');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [settings, setSettings] = useState<StandSettings | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftItemState>>({});
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // New item / category creation state
  const [createMode, setCreateMode] = useState<CreateMode>('item');
  const [newCategoryId, setNewCategoryId] = useState('doner-tavuk');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [creatingItem, setCreatingItem] = useState(false);

  const [newCatName, setNewCatName] = useState('');
  const [newCatSubtitle, setNewCatSubtitle] = useState('');
  const [newCatType, setNewCatType] = useState<CategoryType>('food');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Settings & Password state
  const [taglineInput, setTaglineInput] = useState('');
  const [wifiNameInput, setWifiNameInput] = useState('');
  const [wifiPassInput, setWifiPassInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [newDisplayNameInput, setNewDisplayNameInput] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCredentialPasswords, setShowCredentialPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const hydrateFromMenu = useCallback((data: MenuResponse) => {
    setCategories(data.categories);
    setSettings(data.settings);
    setTaglineInput(data.settings.tagline);
    setWifiNameInput(data.settings.wifiName);
    setWifiPassInput(data.settings.wifiPassword);

    if (data.categories.length > 0) {
      setNewCategoryId((prev) =>
        data.categories.some((c) => c.id === prev) ? prev : data.categories[0].id
      );
    }

    const nextDrafts: Record<string, DraftItemState> = {};
    for (const cat of data.categories) {
      for (const item of cat.items) {
        nextDrafts[item.id] = {
          nameInput: item.name,
          priceInput: item.price === null ? '' : String(item.price),
          isAvailable: item.isAvailable,
        };
      }
    }
    setDrafts(nextDrafts);
  }, []);

  const loadAdminMenu = useCallback(async () => {
    setLoadingAdminData(true);
    try {
      const res = await authFetch('/api/admin/menu');
      if (res.status === 401) {
        onSessionExpired();
        setLoginError('Oturumunuz sona erdi, lütfen tekrar giriş yapın.');
        return;
      }
      if (!res.ok) throw new Error('Yönetici menü verileri alınamadı.');
      const data = (await res.json()) as MenuResponse;
      hydrateFromMenu(data);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Veri yükleme hatası.',
      });
    } finally {
      setLoadingAdminData(false);
    }
  }, [hydrateFromMenu, onSessionExpired]);

  const loadAuditLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await authFetch('/api/admin/audit-logs');
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      if (!res.ok) throw new Error('Geçmiş kayıtları alınamadı.');
      const data = (await res.json()) as { logs: AuditLogEntry[] };
      setAuditLogs(data.logs);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Kayıtlar yüklenemedi.',
      });
    } finally {
      setLoadingLogs(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    if (adminUser) {
      setNewUsernameInput(adminUser.username);
      setNewDisplayNameInput(adminUser.displayName);
      loadAdminMenu();
    } else if (showInitialHint && !didPrefillUsername.current) {
      didPrefillUsername.current = true;
      setUsername((prev) => prev || 'admin');
    }
  }, [adminUser, loadAdminMenu, showInitialHint]);

  useEffect(() => {
    if (adminUser && activeTab === 'logs') {
      loadAuditLogs();
    }
  }, [adminUser, activeTab, loadAuditLogs]);

  // Calculate dirty rows (price, availability, or name changes)
  const dirtyUpdates = useMemo(() => {
    const changes: Array<{
      id: string;
      name: string;
      price: number | null;
      isAvailable: boolean;
      priceChangedOrAvail: boolean;
      nameChanged: boolean;
    }> = [];

    for (const cat of categories) {
      for (const item of cat.items) {
        const draft = drafts[item.id];
        if (!draft) continue;
        const parsed = parseDraftPrice(draft.priceInput);
        const trimmedName = draft.nameInput.trim() || item.name;
        const priceChanged = parsed.valid && parsed.value !== item.price;
        const availChanged = draft.isAvailable !== item.isAvailable;
        const nameChanged = trimmedName !== item.name;

        if (priceChanged || availChanged || nameChanged) {
          changes.push({
            id: item.id,
            name: trimmedName,
            price: parsed.valid ? parsed.value : item.price,
            isAvailable: draft.isAvailable,
            priceChangedOrAvail: priceChanged || availChanged,
            nameChanged,
          });
        }
      }
    }
    return changes;
  }, [categories, drafts]);

  // Metrics summary
  const summary = useMemo(() => {
    let totalItems = 0;
    let missingPriceCount = 0;
    let unavailableCount = 0;
    for (const cat of categories) {
      for (const item of cat.items) {
        totalItems += 1;
        if (item.price === null) missingPriceCount += 1;
        if (!item.isAvailable) unavailableCount += 1;
      }
    }
    return {
      totalCategories: categories.length,
      totalItems,
      missingPriceCount,
      unavailableCount,
    };
  }, [categories]);

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Giriş yapılamadı.');
        return;
      }
      setPassword('');
      onLoginSuccess(data.user, data.token);
    } catch {
      setLoginError('Sunucu ile bağlantı kurulamadı.');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleSaveSingleRow(itemId: string) {
    const draft = drafts[itemId];
    if (!draft) return;

    const parsed = parseDraftPrice(draft.priceInput);
    if (!parsed.valid) {
      setFeedback({
        type: 'error',
        text: 'Lütfen geçerli bir sayısal fiyat girin (örn. 150 veya 150,50).',
      });
      return;
    }

    const trimmedName = draft.nameInput.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', text: 'Ürün adı boş bırakılamaz.' });
      return;
    }

    setSavingRowId(itemId);
    setFeedback(null);
    try {
      const res = await authFetch(`/api/admin/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          price: parsed.value,
          isAvailable: draft.isAvailable,
        }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Güncelleme başarısız.');
      setEditingNameId(null);
      hydrateFromMenu(data.menu);
      onMenuUpdated(data.menu);
      setFeedback({
        type: 'success',
        text: `"${trimmedName}" güncellendi ve canlı menüye yansıtıldı.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Satır güncellenemedi.',
      });
    } finally {
      setSavingRowId(null);
    }
  }

  async function handleSaveBatch() {
    if (dirtyUpdates.length === 0) return;

    for (const cat of categories) {
      for (const item of cat.items) {
        const draft = drafts[item.id];
        if (!draft) continue;
        const parsed = parseDraftPrice(draft.priceInput);
        if (!parsed.valid) {
          setFeedback({
            type: 'error',
            text: `"${cat.name} · ${item.name}" için geçerli bir fiyat girin (0 – 100.000 ₺).`,
          });
          return;
        }
      }
    }

    setSavingBatch(true);
    setFeedback(null);
    try {
      // Persist any renamed items individually first, then batch price/availability
      const nameChanges = dirtyUpdates.filter((u) => u.nameChanged);
      for (const itemUpdate of nameChanges) {
        const res = await authFetch(`/api/admin/items/${encodeURIComponent(itemUpdate.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: itemUpdate.name,
            price: itemUpdate.price,
            isAvailable: itemUpdate.isAvailable,
          }),
        });
        if (res.status === 401) {
          onSessionExpired();
          return;
        }
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Ürün adı güncellenemedi.');
        }
      }

      const batchItems = dirtyUpdates
        .filter((u) => u.priceChangedOrAvail)
        .map((u) => ({ id: u.id, price: u.price, isAvailable: u.isAvailable }));

      let latestMenu: MenuResponse | null = null;
      if (batchItems.length > 0) {
        const res = await authFetch('/api/admin/items/batch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: batchItems }),
        });
        if (res.status === 401) {
          onSessionExpired();
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Güncelleme başarısız.');
        latestMenu = data.menu;
      } else {
        const res = await authFetch('/api/admin/menu');
        if (res.ok) latestMenu = (await res.json()) as MenuResponse;
      }

      setEditingNameId(null);
      if (latestMenu) {
        hydrateFromMenu(latestMenu);
        onMenuUpdated(latestMenu);
      }
      setFeedback({
        type: 'success',
        text: `${dirtyUpdates.length} kalem başarıyla veritabanına kaydedildi ve canlı menü güncellendi.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Fiyatlar kaydedilemedi.',
      });
    } finally {
      setSavingBatch(false);
    }
  }

  async function handleCreateItem(e: FormEvent) {
    e.preventDefault();
    const trimmedName = newItemName.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', text: 'Lütfen ürün veya porsiyon adını yazın.' });
      return;
    }

    const parsedPrice = parseDraftPrice(newItemPrice);
    if (!parsedPrice.valid) {
      setFeedback({
        type: 'error',
        text: 'Lütfen geçerli bir fiyat girin (örn. 150 veya boş bırakın).',
      });
      return;
    }

    const targetCategoryId = newCategoryId || categories[0]?.id;
    if (!targetCategoryId) {
      setFeedback({ type: 'error', text: 'Önce bir kategori seçin veya oluşturun.' });
      return;
    }

    setCreatingItem(true);
    setFeedback(null);
    try {
      const res = await authFetch('/api/admin/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: targetCategoryId,
          name: trimmedName,
          price: parsedPrice.value,
        }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ürün eklenemedi.');
      hydrateFromMenu(data.menu);
      onMenuUpdated(data.menu);
      setNewItemName('');
      setNewItemPrice('');
      setFeedback({ type: 'success', text: `"${trimmedName}" menüye başarıyla eklendi.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ürün ekleme hatası.',
      });
    } finally {
      setCreatingItem(false);
    }
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    const trimmedName = newCatName.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', text: 'Lütfen kategori adını girin.' });
      return;
    }

    setCreatingCategory(true);
    setFeedback(null);
    try {
      const res = await authFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          subtitle: newCatSubtitle.trim(),
          type: newCatType,
        }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kategori oluşturulamadı.');
      hydrateFromMenu(data.menu);
      onMenuUpdated(data.menu);
      if (data.categoryId) {
        setNewCategoryId(data.categoryId);
      }
      setNewCatName('');
      setNewCatSubtitle('');
      setCreateMode('item');
      setFeedback({
        type: 'success',
        text: `"${trimmedName.toLocaleUpperCase('tr-TR')}" kategorisi oluşturuldu. Şimdi altına ürün/porsiyon ekleyebilirsiniz.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Kategori eklenemedi.',
      });
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleDeleteItem(id: string) {
    setFeedback(null);
    try {
      const res = await authFetch(`/api/admin/items/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ürün silinemedi.');
      setConfirmDeleteId(null);
      hydrateFromMenu(data.menu);
      onMenuUpdated(data.menu);
      setFeedback({ type: 'success', text: 'Ürün menüden kaldırıldı.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Silme işlemi başarısız.',
      });
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);
    try {
      const res = await authFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagline: taglineInput,
          wifiName: wifiNameInput,
          wifiPassword: wifiPassInput,
        }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ayarlar kaydedilemedi.');
      hydrateFromMenu(data.menu);
      onMenuUpdated(data.menu);
      setFeedback({ type: 'success', text: 'Masa standı ve işletme ayarları güncellendi.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ayarlar kaydedilemedi.',
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleUpdateCredentials(e: FormEvent) {
    e.preventDefault();
    if (nextPassword && nextPassword !== confirmPassword) {
      setFeedback({ type: 'error', text: 'Yeni şifreler birbiriyle eşleşmiyor.' });
      return;
    }
    setChangingPassword(true);
    setFeedback(null);
    try {
      const res = await authFetch('/api/auth/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsernameInput,
          newDisplayName: newDisplayNameInput,
          newPassword: nextPassword,
        }),
      });
      if (res.status === 401) {
        const errData = await res.json().catch(() => ({}));
        if (String(errData.error || '').includes('Yetkisiz')) {
          onSessionExpired();
          return;
        }
        throw new Error(errData.error || 'Mevcut şifreniz hatalı.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Giriş bilgileri güncellenemedi.');
      onLoginSuccess(data.user, data.token);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setFeedback({
        type: 'success',
        text: 'Yönetici kullanıcı adı ve şifre bilgileriniz güvenli şekilde güncellendi.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Giriş bilgileri güncellenemedi.',
      });
    } finally {
      setChangingPassword(false);
    }
  }

  // ---------- LOGIN VIEW ----------
  if (!adminUser) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#121417]">
          <div className="bg-[#000000] px-6 py-6 flex justify-center border-b border-white/[0.08]">
            <img
              src={LOGO_URL}
              alt="Merdo Kokoreç"
              referrerPolicy="no-referrer"
              className="h-24 w-auto object-contain"
            />
          </div>

          <form onSubmit={handleLoginSubmit} className="p-6 sm:p-7 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#FF7300]">
                <ShieldCheck className="h-4 w-4" />
                <span>Güvenli İşletme Yönetimi</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-extrabold text-white">
                Yönetici Girişi
              </h1>
              <p className="mt-1 text-xs text-zinc-400">
                Menü fiyatlarını ve ürün durumlarını anlık olarak güncellemek için giriş yapın.
              </p>
            </div>

            {loginError && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-200"
              >
                {loginError}
              </div>
            )}

            <div>
              <label htmlFor="admin-username" className="block text-xs font-semibold text-zinc-300">
                Kullanıcı Adı
              </label>
              <input
                id="admin-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adınız"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#FF7300] focus:outline-none min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-semibold text-zinc-300">
                Şifre
              </label>
              <div className="relative mt-1.5">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Yönetici şifreniz"
                  className="w-full rounded-xl border border-white/10 bg-[#090A0C] py-2.5 pl-3.5 pr-11 text-sm text-white focus:border-[#FF7300] focus:outline-none min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {showInitialHint && (
              <div className="rounded-xl border border-white/[0.08] bg-[#090A0C] px-4 py-3 text-xs text-zinc-400 space-y-2.5">
                <p>
                  İlk kurulum giriş bilgisi:{' '}
                  <span className="font-mono text-zinc-200">admin</span> /{' '}
                  <span className="font-mono text-[#FF7300]">merdo2026</span>. Giriş sonrası Ayarlar
                  sekmesinden kullanıcı adı ve şifrenizi değiştirebilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setUsername('admin');
                    setPassword('merdo2026');
                    setLoginError('');
                  }}
                  className="rounded-lg border border-[#FF7300]/40 bg-[#121417] px-3 py-1.5 text-[11px] font-semibold text-[#FF7300] hover:bg-[#FF7300] hover:text-[#090A0C] transition-colors"
                >
                  Varsayılan Bilgileri Doldur
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF7300] py-3 text-sm font-bold text-[#090A0C] transition-colors hover:bg-[#FF8826] disabled:opacity-60 min-h-[46px]"
            >
              <Lock className="h-4 w-4" />
              <span>{loggingIn ? 'Doğrulanıyor...' : 'Panele Giriş Yap'}</span>
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ---------- AUTHENTICATED ADMIN DASHBOARD ----------
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#FF7300]">
            Oturum Açık · {adminUser.displayName}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Menü ve Fiyat Yönetim Paneli
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Yapılan fiyat güncellemeleri veritabanına işlenir ve QR menüye anında yansır.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenMenu}
            className="rounded-xl border border-white/15 bg-[#121417] px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:border-white/30 hover:text-white min-h-[42px]"
          >
            Canlı Menüyü Gör
          </button>
          {activeTab === 'prices' && (
            <button
              type="button"
              disabled={dirtyUpdates.length === 0 || savingBatch}
              onClick={handleSaveBatch}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-colors min-h-[42px] ${
                dirtyUpdates.length > 0
                  ? 'bg-[#FF7300] text-[#090A0C] hover:bg-[#FF8826]'
                  : 'bg-white/10 text-zinc-400 cursor-not-allowed'
              }`}
            >
              <Save className="h-4 w-4" />
              <span>
                {savingBatch
                  ? 'Kaydediliyor...'
                  : dirtyUpdates.length > 0
                  ? `Tümünü Kaydet (${dirtyUpdates.length})`
                  : 'Tüm Fiyatlar Güncel'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`mt-5 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-zinc-300 hover:text-white underline"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Summary Strip */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/[0.08] bg-[#121417] p-4">
          <p className="text-xs text-zinc-400">Kategori Sayısı</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
            {summary.totalCategories}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#121417] p-4">
          <p className="text-xs text-zinc-400">Toplam Kalem</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
            {summary.totalItems}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#121417] p-4">
          <p className="text-xs text-zinc-400">Fiyat Girilmemiş</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#FF7300]">
            {summary.missingPriceCount}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#121417] p-4">
          <p className="text-xs text-zinc-400">Tükendi İşaretli</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-300">
            {summary.unavailableCount}
          </p>
        </div>
      </section>

      {/* Sub-Tabs */}
      <div className="mt-6 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#121417] p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('prices')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[40px] ${
            activeTab === 'prices'
              ? 'bg-[#FF7300] text-[#090A0C]'
              : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
          }`}
        >
          <Save className="h-3.5 w-3.5" />
          <span>Fiyat &amp; Menü Editörü</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[40px] ${
            activeTab === 'logs'
              ? 'bg-[#FF7300] text-[#090A0C]'
              : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Değişiklik Geçmişi</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[40px] ${
            activeTab === 'settings'
              ? 'bg-[#FF7300] text-[#090A0C]'
              : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Stand &amp; Güvenlik Ayarları</span>
        </button>
      </div>

      {/* TAB 1: PRICES EDITOR */}
      {activeTab === 'prices' && (
        <div className="mt-6 space-y-6">
          {/* Add New Item or Category Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#121417] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
              <h2 className="font-display text-sm font-bold text-white">
                {createMode === 'item'
                  ? 'Menüye Yeni Ürün / Porsiyon Ekle'
                  : 'Menüye Yeni Kategori Ekle'}
              </h2>
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#090A0C] p-1">
                <button
                  type="button"
                  onClick={() => setCreateMode('item')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    createMode === 'item'
                      ? 'bg-[#FF7300] text-[#090A0C]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Ürün / Porsiyon</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('category')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    createMode === 'category'
                      ? 'bg-[#FF7300] text-[#090A0C]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>Yeni Kategori</span>
                </button>
              </div>
            </div>

            {createMode === 'item' ? (
              <form onSubmit={handleCreateItem} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <label htmlFor="new-cat" className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Kategori Seçin
                  </label>
                  <select
                    id="new-cat"
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#090A0C] px-3 py-2.5 text-xs font-medium text-white focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label htmlFor="new-name" className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Ürün / Porsiyon Adı
                  </label>
                  <input
                    id="new-name"
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Örn. Şalgam veya Dürüm"
                    className="w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="new-price" className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Fiyat (₺)
                  </label>
                  <input
                    id="new-price"
                    type="text"
                    inputMode="decimal"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="Örn. 150"
                    className="w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 font-mono text-xs tabular-nums text-white placeholder:text-zinc-500 focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    disabled={creatingItem || categories.length === 0}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FF7300] px-4 py-2.5 text-xs font-bold text-[#090A0C] hover:bg-[#FF8826] disabled:opacity-50 transition-colors min-h-[42px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{creatingItem ? 'Ekleniyor...' : 'Ekle'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleCreateCategory}
                className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-4">
                  <label htmlFor="new-cat-name" className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Kategori Adı
                  </label>
                  <input
                    id="new-cat-name"
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Örn. SUCUK EKMEK"
                    className="w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label htmlFor="new-cat-sub" className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Kısa Açıklama (İsteğe bağlı)
                  </label>
                  <input
                    id="new-cat-sub"
                    type="text"
                    value={newCatSubtitle}
                    onChange={(e) => setNewCatSubtitle(e.target.value)}
                    placeholder="Örn. Odun ateşinde özel sucuk"
                    className="w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="new-cat-type" className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Tür
                  </label>
                  <select
                    id="new-cat-type"
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as CategoryType)}
                    className="w-full rounded-xl border border-white/10 bg-[#090A0C] px-3 py-2.5 text-xs font-medium text-white focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                  >
                    <option value="food">Yemek</option>
                    <option value="beverage">İçecek</option>
                  </select>
                </div>
                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    disabled={creatingCategory}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FF7300] px-4 py-2.5 text-xs font-bold text-[#090A0C] hover:bg-[#FF8826] disabled:opacity-50 transition-colors min-h-[42px]"
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span>{creatingCategory ? 'Oluşturuluyor...' : 'Oluştur'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Category Price Tables */}
          {loadingAdminData ? (
            <div className="h-64 animate-pulse rounded-2xl border border-white/[0.08] bg-[#121417]" />
          ) : (
            <div className="space-y-6">
              {categories.map((cat) => (
                <section
                  key={cat.id}
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121417]"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#090A0C]/60 px-5 py-4">
                    <div>
                      <h3 className="font-display text-lg font-extrabold text-white">{cat.name}</h3>
                      {cat.subtitle && <p className="text-xs text-zinc-400">{cat.subtitle}</p>}
                    </div>
                    <span className="font-mono text-xs tabular-nums text-zinc-400">
                      {cat.items.length} kalem
                    </span>
                  </div>

                  {cat.items.length === 0 ? (
                    <div className="px-5 py-6 text-xs text-zinc-400">
                      Bu kategoride henüz ürün bulunmuyor. Yukarıdaki formdan bu kategoriye ürün veya
                      porsiyon ekleyebilirsiniz.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.06]">
                      {cat.items.map((item) => {
                        const draft = drafts[item.id] || {
                          nameInput: item.name,
                          priceInput: item.price === null ? '' : String(item.price),
                          isAvailable: item.isAvailable,
                        };
                        const parsed = parseDraftPrice(draft.priceInput);
                        const trimmedName = draft.nameInput.trim() || item.name;
                        const isRowDirty =
                          (parsed.valid && parsed.value !== item.price) ||
                          draft.isAvailable !== item.isAvailable ||
                          trimmedName !== item.name;

                        return (
                          <div
                            key={item.id}
                            className={`grid grid-cols-1 gap-3 px-5 py-3.5 sm:grid-cols-12 sm:items-center ${
                              isRowDirty ? 'bg-[#FF7300]/[0.06]' : ''
                            }`}
                          >
                            {/* Item Name (with inline rename support) */}
                            <div className="sm:col-span-4 flex items-center gap-2 min-w-0">
                              {editingNameId === item.id ? (
                                <input
                                  type="text"
                                  value={draft.nameInput}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: { ...draft, nameInput: e.target.value },
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveSingleRow(item.id);
                                    } else if (e.key === 'Escape') {
                                      setEditingNameId(null);
                                    }
                                  }}
                                  autoFocus
                                  className="w-full rounded-lg border border-[#FF7300] bg-[#090A0C] px-2.5 py-1.5 text-sm font-semibold text-white focus:outline-none min-h-[38px]"
                                />
                              ) : (
                                <>
                                  <span className="text-sm font-semibold text-white truncate">
                                    {draft.nameInput}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingNameId(item.id)}
                                    aria-label={`${item.name} adını düzenle`}
                                    title="Adı düzenle"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-zinc-200 shrink-0"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Price Input + Row Save */}
                            <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
                              <div className="relative flex-1 min-w-[125px] max-w-[165px]">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  aria-label={`${cat.name} ${item.name} fiyatı`}
                                  value={draft.priceInput}
                                  placeholder="Henüz girilmedi"
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...draft,
                                        priceInput: e.target.value,
                                      },
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveSingleRow(item.id);
                                    }
                                  }}
                                  className={`w-full rounded-lg border bg-[#090A0C] py-2 pl-3 pr-8 font-mono text-sm font-bold tabular-nums text-white placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:text-zinc-500 focus:outline-none min-h-[40px] ${
                                    !parsed.valid
                                      ? 'border-red-500'
                                      : 'border-white/15 focus:border-[#FF7300]'
                                  }`}
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[#FF7300]">
                                  ₺
                                </span>
                              </div>

                              {isRowDirty && (
                                <button
                                  type="button"
                                  disabled={savingRowId === item.id || !parsed.valid}
                                  onClick={() => handleSaveSingleRow(item.id)}
                                  className="rounded-lg bg-[#FF7300] px-3 py-2 text-xs font-bold text-[#090A0C] hover:bg-[#FF8826] disabled:opacity-50 min-h-[40px]"
                                >
                                  {savingRowId === item.id ? '...' : 'Kaydet'}
                                </button>
                              )}

                              {draft.priceInput !== '' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: { ...draft, priceInput: '' },
                                    }))
                                  }
                                  title="Fiyatı temizle (Henüz fiyat girilmedi)"
                                  className="rounded-lg border border-white/10 px-2.5 py-2 text-[11px] text-zinc-400 hover:text-white min-h-[40px]"
                                >
                                  Temizle
                                </button>
                              )}
                            </div>

                            {/* Availability Toggle */}
                            <div className="sm:col-span-2 flex items-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...draft,
                                      isAvailable: !draft.isAvailable,
                                    },
                                  }))
                                }
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors min-h-[38px] ${
                                  draft.isAvailable
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                                }`}
                              >
                                {draft.isAvailable ? 'Mevcut' : 'Tükendi'}
                              </button>
                            </div>

                            {/* Delete Action (2-step inline confirm) */}
                            <div className="sm:col-span-2 flex items-center justify-end gap-2">
                              {confirmDeleteId === item.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-red-500 min-h-[36px]"
                                  >
                                    Sil
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:text-white min-h-[36px]"
                                  >
                                    İptal
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  aria-label={`${item.name} sil`}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {/* Bottom Batch Save Action when Dirty */}
          {dirtyUpdates.length > 0 && (
            <div className="sticky bottom-4 z-30 flex items-center justify-between gap-4 rounded-2xl border border-[#FF7300]/50 bg-[#090A0C]/95 p-4 backdrop-blur-md shadow-2xl">
              <p className="text-xs font-semibold text-white sm:text-sm">
                <span className="font-mono text-[#FF7300]">{dirtyUpdates.length}</span> adet
                değişiklik kaydedilmeyi bekliyor.
              </p>
              <button
                type="button"
                disabled={savingBatch}
                onClick={handleSaveBatch}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF7300] px-5 py-2.5 text-xs font-bold text-[#090A0C] hover:bg-[#FF8826] whitespace-nowrap min-h-[42px]"
              >
                <Save className="h-4 w-4" />
                <span>{savingBatch ? 'Kaydediliyor...' : 'Tümünü Kaydet'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121417]">
          <div className="border-b border-white/[0.08] px-5 py-4">
            <h2 className="font-display text-base font-bold text-white">
              Fiyat ve Menü Değişiklik Geçmişi
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Veritabanı üzerinde gerçekleştirilen tüm güncellemeler tarih ve yönetici bilgisiyle
              saklanır.
            </p>
          </div>

          {loadingLogs ? (
            <div className="p-8 text-center text-xs text-zinc-400">Kayıtlar yükleniyor...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-400">
              Henüz kayıtlı bir fiyat değişikliği bulunmuyor. Fiyat düzenlediğinizde kayıtlar burada
              görünecektir.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-[#090A0C]/50 text-zinc-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Tarih</th>
                    <th className="px-5 py-3 font-semibold">Yönetici</th>
                    <th className="px-5 py-3 font-semibold">Kategori</th>
                    <th className="px-5 py-3 font-semibold">Ürün</th>
                    <th className="px-5 py-3 font-semibold text-right">Eski Fiyat</th>
                    <th className="px-5 py-3 font-semibold text-right">Yeni Fiyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-mono tabular-nums text-zinc-400 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-5 py-3 font-medium text-zinc-200">{log.adminUsername}</td>
                      <td className="px-5 py-3 text-zinc-300">{log.categoryName}</td>
                      <td className="px-5 py-3 font-semibold text-white">{log.itemName}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-zinc-400">
                        {formatPriceDisplay(log.oldPrice)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold tabular-nums text-[#FF7300]">
                        {formatPriceDisplay(log.newPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: STAND & SECURITY SETTINGS */}
      {activeTab === 'settings' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Stand & Wi-Fi Settings */}
          <form
            onSubmit={handleSaveSettings}
            className="rounded-2xl border border-white/[0.08] bg-[#121417] p-6 space-y-4"
          >
            <div>
              <h2 className="font-display text-base font-bold text-white">
                Masa Standı ve İşletme Bilgileri
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                QR masa standında ve dijital menüde gösterilecek slogan ile isteğe bağlı Wi-Fi
                bilgilerini düzenleyin.
              </p>
            </div>

            <div>
              <label htmlFor="set-tagline" className="block text-xs font-semibold text-zinc-300">
                Slogan / Alt Başlık
              </label>
              <input
                id="set-tagline"
                type="text"
                value={taglineInput}
                onChange={(e) => setTaglineInput(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-sm text-white focus:border-[#FF7300] focus:outline-none min-h-[42px]"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="set-wifi-name" className="block text-xs font-semibold text-zinc-300">
                  Müşteri Wi-Fi Adı (İsteğe bağlı)
                </label>
                <input
                  id="set-wifi-name"
                  type="text"
                  value={wifiNameInput}
                  onChange={(e) => setWifiNameInput(e.target.value)}
                  placeholder="Örn. Merdo_Misafir"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-sm text-white focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                />
              </div>
              <div>
                <label htmlFor="set-wifi-pass" className="block text-xs font-semibold text-zinc-300">
                  Wi-Fi Şifresi (İsteğe bağlı)
                </label>
                <input
                  id="set-wifi-pass"
                  type="text"
                  value={wifiPassInput}
                  onChange={(e) => setWifiPassInput(e.target.value)}
                  placeholder="Örn. kokorec123"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-sm text-white focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="rounded-xl bg-[#FF7300] px-5 py-2.5 text-xs font-bold text-[#090A0C] hover:bg-[#FF8826] transition-colors min-h-[42px]"
            >
              {savingSettings ? 'Kaydediliyor...' : 'Stand Ayarlarını Kaydet'}
            </button>
          </form>

          {/* Admin Credentials Update */}
          <form
            onSubmit={handleUpdateCredentials}
            className="rounded-2xl border border-white/[0.08] bg-[#121417] p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-bold text-white">
                  Güvenli Giriş Bilgilerini Güncelle
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  Yönetici kullanıcı adınızı, görünen adınızı ve şifrenizi güncelleyebilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCredentialPasswords((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#090A0C] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-white shrink-0"
              >
                {showCredentialPasswords ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Gizle</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    <span>Göster</span>
                  </>
                )}
              </button>
            </div>

            {adminUser.isDefaultPassword && (
              <div className="rounded-xl border border-[#FF7300]/40 bg-[#FF7300]/10 px-3.5 py-2.5 text-xs text-amber-100">
                Şu anda varsayılan kurulum şifresi aktif. Güvenliğiniz için yeni bir kullanıcı adı
                ve şifre belirlemeniz önerilir.
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cred-username" className="block text-xs font-semibold text-zinc-300">
                  Kullanıcı Adı
                </label>
                <input
                  id="cred-username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={40}
                  value={newUsernameInput}
                  onChange={(e) => setNewUsernameInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 font-mono text-sm text-white focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                />
              </div>
              <div>
                <label htmlFor="cred-display" className="block text-xs font-semibold text-zinc-300">
                  Yönetici Adı / Ünvanı
                </label>
                <input
                  id="cred-display"
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={newDisplayNameInput}
                  onChange={(e) => setNewDisplayNameInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-sm text-white focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="curr-pass" className="block text-xs font-semibold text-zinc-300">
                Mevcut Şifre (Doğrulama İçin Zorunlu)
              </label>
              <input
                id="curr-pass"
                type={showCredentialPasswords ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Mevcut şifrenizi girin"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#FF7300] focus:outline-none min-h-[42px]"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="next-pass" className="block text-xs font-semibold text-zinc-300">
                  Yeni Şifre (İsteğe bağlı, en az 6 karakter)
                </label>
                <input
                  id="next-pass"
                  type={showCredentialPasswords ? 'text' : 'password'}
                  minLength={6}
                  value={nextPassword}
                  onChange={(e) => setNextPassword(e.target.value)}
                  placeholder="Değiştirmek istemiyorsanız boş bırakın"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                />
              </div>
              <div>
                <label htmlFor="confirm-pass" className="block text-xs font-semibold text-zinc-300">
                  Yeni Şifre (Tekrar)
                </label>
                <input
                  id="confirm-pass"
                  type={showCredentialPasswords ? 'text' : 'password'}
                  required={nextPassword.length > 0}
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Yeni şifreyi doğrulayın"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090A0C] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#FF7300] focus:outline-none min-h-[42px]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="rounded-xl bg-[#FF7300] px-5 py-2.5 text-xs font-bold text-[#090A0C] hover:bg-[#FF8826] transition-colors min-h-[42px]"
            >
              {changingPassword ? 'Güncelleniyor...' : 'Giriş Bilgilerini Kaydet'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
