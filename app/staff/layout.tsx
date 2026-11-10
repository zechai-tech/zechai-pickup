'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { supabase } from '@/lib/supabase';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser, logout, setAuthInitialized } = useAdminStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          logout();
          setAuthInitialized(true);
          if (isMounted) {
            router.replace('/login');
          }
          return;
        }

        // Active session exists — fetch profile
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
            router.replace('/login');
          }
          return;
        }

        const user = data.user;
        setUser(user, session.access_token);
        setAuthInitialized(true);

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Staff layout auth init error:', err);
        logout();
        setAuthInitialized(true);
        if (isMounted) {
          router.replace('/login');
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        logout();
        router.replace('/login');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, setUser, logout, setAuthInitialized]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBEA]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CE5535] mx-auto mb-4" />
          <p className="text-[#75604F] text-xs font-bold tracking-wide">
            Loading terminal...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
