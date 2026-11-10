'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/admin/Sidebar';
import { TopBar } from '@/components/admin/TopBar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, setUser, logout, setAuthInitialized } = useAdminStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Clean layout for login page without topbar/sidebar
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          // No active session in Supabase — redirect to login
          logout();
          setAuthInitialized(true);
          if (isMounted) {
            router.replace('/admin/login');
          }
          return;
        }

        // Active session exists — fetch full profile
        const cleanEmail = session.user.email?.toLowerCase().trim() || '';
        const res = await fetch(
          `/api/admin/users/me?uid=${session.user.id}&email=${encodeURIComponent(cleanEmail)}`
        );
        const data = await res.json();

        if (!res.ok || !data.user || !data.user.is_active) {
          await supabase.auth.signOut();
          logout();
          setAuthInitialized(true);
          if (isMounted) {
            router.replace('/admin/login');
          }
          return;
        }

        const user = data.user;
        setUser(user, session.access_token);
        setAuthInitialized(true);

        // If a non-admin / non-manager tries to access /admin/* routes, route to /staff/orders
        if (user.role === 'staff' || user.role === 'ordering_staff') {
          if (isMounted) {
            router.replace('/staff/orders');
          }
          return;
        }

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Admin layout auth init error:', err);
        logout();
        setAuthInitialized(true);
        if (isMounted) {
          router.replace('/admin/login');
        }
      }
    };

    initAuth();

    // Listen for auth state changes (signout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        logout();
        router.replace('/admin/login');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isLoginPage, router, setUser, logout, setAuthInitialized]);

  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-cream text-espresso flex flex-col justify-center items-center p-4">
        {children}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBEA]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CE5535] mx-auto mb-4" />
          <p className="text-[#75604F] text-xs font-bold tracking-wide">Restoring session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-cream text-espresso overflow-hidden font-sans">
      {/* Sidebar for Desktop & Tablet + Mobile Drawer */}
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* TopBar */}
        <TopBar onToggleMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scrollbar-none">
          {children}
        </main>
      </div>
    </div>
  );
}
