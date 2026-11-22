'use client';

import React, { useState, useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/admin/Sidebar';
import { TopBar } from '@/components/admin/TopBar';
import { setClarityUser } from '@/lib/clarity';
import { initOneSignal, loginOneSignalUser, logoutOneSignalUser } from '@/lib/onesignal-client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, setUser, logout, setAuthInitialized } = useAdminStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize OneSignal on Portal mount
  useEffect(() => {
    initOneSignal();
  }, []);

  // Sync OneSignal login with current Portal user
  useEffect(() => {
    if (currentUser?.id) {
      loginOneSignalUser(currentUser.id);
    }
  }, [currentUser?.id]);

  // Clean layout for login page and root admin redirect without topbar/sidebar
  const isLoginPage = pathname === '/admin/login';
  const isRootAdmin = pathname === '/admin' || pathname === '/admin/';
  const isCleanLayout = isLoginPage || isRootAdmin;

  useEffect(() => {
    if (isCleanLayout) {
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
        logoutOneSignalUser();
        logout();
        router.replace('/admin/login');
      } else if (session?.access_token) {
        const currentUser = useAdminStore.getState().currentUser;
        if (currentUser) {
          useAdminStore.getState().setUser(currentUser, session.access_token);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isCleanLayout, router, setUser, logout, setAuthInitialized]);

  // Tag Clarity with role and outlet whenever user session is active
  useEffect(() => {
    if (currentUser) {
      const outletName =
        currentUser.outlet?.name ||
        currentUser.outlet_name ||
        (currentUser.role === 'admin' || currentUser.role === 'super_admin' ? 'All Outlets' : '');
      setClarityUser(currentUser.role, outletName);
    }
  }, [currentUser]);

  if (isCleanLayout) {
    return (
      <div className="min-h-screen bg-cream text-espresso flex flex-col justify-center items-center p-4">
        <link rel="manifest" href="/admin-manifest.json" />
        <link rel="apple-touch-icon" href="/admin-apple-touch-icon.png" />
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          strategy="afterInteractive"
        />
        {children}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBEA]">
        <link rel="manifest" href="/admin-manifest.json" />
        <link rel="apple-touch-icon" href="/admin-apple-touch-icon.png" />
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          strategy="afterInteractive"
        />
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CE5535] mx-auto mb-4" />
          <p className="text-[#75604F] text-xs font-bold tracking-wide">Restoring session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-cream text-espresso overflow-hidden font-sans">
      <link rel="manifest" href="/admin-manifest.json" />
      <link rel="apple-touch-icon" href="/admin-apple-touch-icon.png" />
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />
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
