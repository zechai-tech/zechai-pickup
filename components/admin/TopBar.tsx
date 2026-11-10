'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { supabase } from '@/lib/supabase';
import { LogOut, Menu, Bell, BellOff, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onToggleMobileMenu?: () => void;
}

export function TopBar({ onToggleMobileMenu }: TopBarProps) {
  const router = useRouter();
  const { currentUser, logout, soundEnabled, setSoundEnabled } = useAdminStore();

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
    <header className="h-16 bg-card border-b border-border px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
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

      {/* Right side: User profile, Sound toggle, Logout */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Sound toggle button */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={cn(
            'p-2 rounded-full border transition-all flex items-center gap-1.5 text-xs font-semibold',
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
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-border bg-card hover:bg-sand/40 text-espresso/80 hover:text-brandRed text-xs font-bold flex items-center gap-1.5 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
