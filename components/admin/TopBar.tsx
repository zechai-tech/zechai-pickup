'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { supabase } from '@/lib/supabase';
import { LogOut, Menu, Bell, BellOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onToggleMobileMenu?: () => void;
}

export function TopBar({ onToggleMobileMenu }: TopBarProps) {
  const router = useRouter();
  const {
    currentUser,
    logout,
    soundEnabled,
    setSoundEnabled,
    triggerSync,
    isSyncing,
    setSyncing,
  } = useAdminStore();

  const [syncToast, setSyncToast] = useState(false);

  const handleSyncClick = async () => {
    if (isSyncing) return;
    setSyncing(true);
    triggerSync();

    // Allow components to trigger re-fetches
    setTimeout(() => {
      setSyncing(false);
      setSyncToast(true);
      setTimeout(() => {
        setSyncToast(false);
      }, 2000);
    }, 600);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Signout error:', e);
    }
    logout();
    router.push('/admin/login');
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-orange/15 text-orange-dark border-orange/30',
    manager: 'bg-mustard/20 text-[#7D5A00] border-mustard/40',
    staff: 'bg-[#EBF7EE] text-brandGreen border-brandGreen/30',
    ordering_staff: 'bg-sand text-espresso border-border',
  };

  return (
    <header className="h-16 bg-card border-b border-border px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs relative">
      {/* Sync Success Toast */}
      {syncToast && (
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-50 bg-[#2F7A3E] text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Data synced</span>
        </div>
      )}

      {/* Left side: Mobile menu toggle + breadcrumb / brand */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-xl text-espresso hover:bg-sand/50 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="hidden sm:block">
          <span className="text-xs font-semibold text-espresso/60 uppercase tracking-wider block">
            Zécha! Operations
          </span>
          <span className="font-display font-black text-sm text-espresso">
            {currentUser?.role ? `${currentUser.role.toUpperCase()} PANEL` : 'ADMINISTRATION'}
          </span>
        </div>
      </div>

      {/* Right side: Sync button, Sound toggle, User profile, Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sync button (Left of Alerts) */}
        <button
          onClick={handleSyncClick}
          disabled={isSyncing}
          className={cn(
            'px-3 py-2 rounded-full border border-border bg-card text-espresso hover:bg-orange-soft hover:text-orange-dark hover:border-orange/30 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-75'
          )}
          title="Refresh & sync data from Supabase"
        >
          <RefreshCw className={cn('w-3.5 h-3.5 text-orange', isSyncing && 'animate-spin')} />
          <span>Sync</span>
        </button>

        {/* Sound toggle button */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={cn(
            'px-3 py-2 rounded-full border transition-all flex items-center gap-1.5 text-xs font-semibold',
            soundEnabled
              ? 'bg-sand/60 border-border text-espresso hover:bg-sand'
              : 'bg-card border-border/60 text-espresso/40'
          )}
          title={soundEnabled ? 'Order sound alerts enabled' : 'Order sound alerts muted'}
        >
          {soundEnabled ? (
            <Bell className="w-4 h-4 text-orange" />
          ) : (
            <BellOff className="w-4 h-4 text-espresso/40" />
          )}
          <span className="hidden lg:inline">{soundEnabled ? 'Alerts On' : 'Muted'}</span>
        </button>

        {/* User Info */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-border/80">
            <div className="w-8 h-8 rounded-full bg-sand flex items-center justify-center text-espresso font-black text-xs">
              {currentUser.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-espresso leading-tight">
                {currentUser.name}
              </span>
              <span
                className={cn(
                  'text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded mt-0.5 border inline-block w-fit',
                  roleColors[currentUser.role] || 'bg-sand text-espresso'
                )}
              >
                {currentUser.role.replace('_', ' ')}
              </span>
            </div>
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="p-2 sm:px-3 sm:py-2 rounded-full border border-border bg-card hover:bg-[#FDF0F0] text-espresso/80 hover:text-brandRed text-xs font-bold flex items-center gap-1.5 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
