/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { CustomerMenu } from './components/CustomerMenu';
import { TableStandStudio } from './components/TableStandStudio';
import { TopBar } from './components/TopBar';
import type {
  AdminUser,
  AppView,
  AuthStatusResponse,
  MenuCategory,
  MenuResponse,
  StandSettings,
} from './types';
import { authFetch, setStoredAdminToken } from './utils/authStorage';

const DEFAULT_SETTINGS: StandSettings = {
  businessName: 'Merdo Kokoreç',
  tagline: 'Odun Ateşinde Lezzet · Güncel Fiyat Listesi',
  wifiName: '',
  wifiPassword: '',
  defaultTableCount: 12,
  updatedAt: '',
};

function getInitialViewFromUrl(): AppView {
  if (typeof window === 'undefined') return 'menu';
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view === 'stand' || view === 'admin') return view;
  return 'menu';
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(getInitialViewFromUrl);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [settings, setSettings] = useState<StandSettings>(DEFAULT_SETTINGS);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [showInitialHint, setShowInitialHint] = useState(false);

  const fetchMenu = useCallback(async () => {
    setMenuError('');
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) {
        setMenuError('Menü verileri sunucudan alınamadı. Lütfen tekrar deneyin.');
        return;
      }
      const data = (await res.json()) as MenuResponse;
      setCategories(data.categories);
      setSettings(data.settings);
    } catch (err) {
      console.error('Menü yükleme hatası:', err);
      setMenuError('Menü yüklenirken bağlantı hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoadingMenu(false);
    }
  }, []);

  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/me');
      if (!res.ok) return;
      const data = (await res.json()) as AuthStatusResponse;
      if (!data.authenticated) {
        setStoredAdminToken(null);
      }
      setAdminUser(data.user);
      setShowInitialHint(data.showInitialHint);
    } catch (err) {
      console.error('Oturum kontrol hatası:', err);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
    fetchAuthStatus();
  }, [fetchMenu, fetchAuthStatus]);

  // Real-time live menu updates via Server-Sent Events
  useEffect(() => {
    const eventSource = new EventSource('/api/menu/stream');
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        if (parsed.type === 'menu_updated') {
          fetchMenu();
        }
      } catch {
        // Ignore ping payloads
      }
    };
    return () => {
      eventSource.close();
    };
  }, [fetchMenu]);

  function handleNavigate(view: AppView) {
    setActiveView(view);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (view === 'menu') {
        url.searchParams.delete('view');
      } else {
        url.searchParams.set('view', view);
      }
      window.history.replaceState({}, '', url.toString());
    }
  }

  async function handleLogout() {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredAdminToken(null);
      setAdminUser(null);
      fetchAuthStatus();
    }
  }

  function handleSessionExpired() {
    setStoredAdminToken(null);
    setAdminUser(null);
  }

  function handleMenuUpdated(updatedMenu: MenuResponse) {
    setCategories(updatedMenu.categories);
    setSettings(updatedMenu.settings);
  }

  return (
    <div className="min-h-screen bg-[#090A0C] text-[#F5F5F4]">
      <TopBar
        activeView={activeView}
        onNavigate={handleNavigate}
        adminUser={adminUser}
        onLogout={handleLogout}
      />

      {activeView === 'menu' && (
        <CustomerMenu
          categories={categories}
          settings={settings}
          loading={loadingMenu}
          error={menuError}
          onRetry={fetchMenu}
          onOpenStand={() => handleNavigate('stand')}
          onOpenAdmin={() => handleNavigate('admin')}
        />
      )}

      {activeView === 'stand' && (
        <TableStandStudio
          settings={settings}
          onPreviewMenu={() => handleNavigate('menu')}
        />
      )}

      {activeView === 'admin' && (
        <AdminPanel
          adminUser={adminUser}
          showInitialHint={showInitialHint}
          onLoginSuccess={(user, token) => {
            if (token) {
              setStoredAdminToken(token);
            }
            setAdminUser(user);
            setShowInitialHint(user.isDefaultPassword);
          }}
          onSessionExpired={handleSessionExpired}
          onMenuUpdated={handleMenuUpdated}
          onOpenMenu={() => handleNavigate('menu')}
        />
      )}
    </div>
  );
}
