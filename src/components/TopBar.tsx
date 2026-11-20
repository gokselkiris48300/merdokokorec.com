import { Lock, LogOut, QrCode, UtensilsCrossed } from 'lucide-react';
import type { AdminUser, AppView } from '../types';

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  adminUser: AdminUser | null;
  onLogout: () => void;
}

export function TopBar({ activeView, onNavigate, adminUser, onLogout }: TopBarProps) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-white/[0.08] bg-[#090A0C]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('menu')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7300] rounded-lg"
        >
          <span className="font-display text-lg font-extrabold tracking-tight text-white sm:text-xl">
            Merdo <span className="text-[#FF7300]">Kokoreç</span>
          </span>
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            type="button"
            onClick={() => onNavigate('menu')}
            className={`whitespace-nowrap shrink-0 py-1.5 transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7300] ${
              activeView === 'menu'
                ? 'border-[#FF7300] text-white'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Dijital Menü
          </button>
          <button
            type="button"
            onClick={() => onNavigate('stand')}
            className={`whitespace-nowrap shrink-0 py-1.5 transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7300] ${
              activeView === 'stand'
                ? 'border-[#FF7300] text-white'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Masa Üstü Standı
          </button>
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className={`whitespace-nowrap shrink-0 py-1.5 transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7300] ${
              activeView === 'admin'
                ? 'border-[#FF7300] text-white'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Yönetici Paneli
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {adminUser ? (
            activeView === 'admin' ? (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#121417] px-4 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-[#FF7300]/60 hover:text-white whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <LogOut className="h-3.5 w-3.5 text-[#FF7300]" />
                <span>Çıkış Yap</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#FF7300] px-4 py-2 text-xs font-bold text-[#090A0C] transition-colors hover:bg-[#FF8826] whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Fiyatları Yönet</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(activeView === 'admin' ? 'stand' : 'admin')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF7300] px-4 py-2 text-xs font-bold text-[#090A0C] transition-colors hover:bg-[#FF8826] whitespace-nowrap shrink-0 min-h-[40px]"
            >
              {activeView === 'admin' ? (
                <>
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Masa Standı</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Yönetici Girişi</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Compact Mobile Navigation Row */}
      <div className="flex md:hidden items-center justify-around border-t border-white/[0.06] bg-[#090A0C] px-2 py-1.5">
        <button
          type="button"
          onClick={() => onNavigate('menu')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors min-h-[40px] ${
            activeView === 'menu' ? 'text-[#FF7300]' : 'text-zinc-400'
          }`}
        >
          <UtensilsCrossed className="h-3.5 w-3.5" />
          <span>Menü</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('stand')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors min-h-[40px] ${
            activeView === 'stand' ? 'text-[#FF7300]' : 'text-zinc-400'
          }`}
        >
          <QrCode className="h-3.5 w-3.5" />
          <span>Masa Standı</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('admin')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors min-h-[40px] ${
            activeView === 'admin' ? 'text-[#FF7300]' : 'text-zinc-400'
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Yönetim</span>
        </button>
      </div>
    </header>
  );
}
