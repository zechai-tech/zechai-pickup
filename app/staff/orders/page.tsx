'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { supabase } from '@/lib/supabase';
import { LogOut, Store, User, Sparkles } from 'lucide-react';

export default function StaffOrdersPage() {
  const router = useRouter();
  const { currentUser, logout } = useAdminStore();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out notice:', e);
    }
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-cream text-espresso flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-card rounded-[32px] border border-border shadow-xl p-8 text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Logo */}
        <div className="relative w-36 h-12 mx-auto mb-6">
          <Image
            src="/assets/logo-orange.png"
            alt="Zécha!"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-soft text-orange-dark text-xs font-bold mb-4">
          <Sparkles className="w-3.5 h-3.5 text-orange" />
          <span>Kitchen & Counter Terminal</span>
        </div>

        {/* Centered Heading */}
        <h1 className="font-display font-black text-2xl text-espresso tracking-tight mb-2">
          Staff Orders — Coming Soon
        </h1>
        <p className="text-xs text-espresso/70 max-w-xs mx-auto leading-relaxed mb-6 font-medium">
          The dedicated tablet-friendly KDS (Kitchen Display System) and quick order-taking interface for counter staff is currently in active preparation.
        </p>

        {/* User Info Card */}
        {currentUser && (
          <div className="bg-sand/40 rounded-2xl border border-border p-4 mb-6 text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-espresso/60 font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-orange" />
                <span>Logged in as</span>
              </span>
              <strong className="text-espresso font-bold">{currentUser.name}</strong>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-espresso/60 font-semibold flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-espresso/50" />
                <span>Outlet</span>
              </span>
              <span className="text-espresso font-bold">
                {currentUser.outlet?.name || currentUser.outlet_name || 'All Outlets'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
              <span className="text-espresso/60 font-semibold">Role</span>
              <span className="px-2 py-0.5 rounded-full bg-sand text-espresso font-black text-[10px] uppercase tracking-wider">
                {currentUser.role.replace('_', ' ')}
              </span>
            </div>
          </div>
        )}

        {/* Logout CTA */}
        <button
          onClick={handleLogout}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-sand text-espresso font-bold text-xs hover:bg-sand/80 transition-colors"
        >
          <LogOut className="w-4 h-4 text-espresso/60" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
