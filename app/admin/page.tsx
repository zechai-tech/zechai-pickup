'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { supabase } from '@/lib/supabase';
import { setClarityUser } from '@/lib/clarity';

/**
 * Root landing page for /admin and /admin/
 *
 * Resolves the appropriate portal destination without flashing 404 or protected content:
 * - If no active session -> redirects to /admin/login
 * - If active staff / ordering_staff -> redirects to /staff/orders
 * - If active admin / super_admin / manager -> redirects to /admin/dashboard
 */
export default function AdminIndexPage() {
  const router = useRouter();
  const { currentUser, setUser } = useAdminStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const resolvePortalLanding = async () => {
      try {
        // 1. Check if user profile is already present in Zustand store
        if (currentUser && currentUser.is_active) {
          if (currentUser.role === 'staff' || currentUser.role === 'ordering_staff') {
            if (isMounted) router.replace('/staff/orders');
          } else {
            // Admin, super_admin, manager -> /admin/dashboard
            if (isMounted) router.replace('/admin/dashboard');
          }
          return;
        }

        // 2. Check Supabase session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          if (isMounted) {
            router.replace('/admin/login');
          }
          return;
        }

        // 3. Fetch active user profile from API
        const cleanEmail = session.user.email?.toLowerCase().trim() || '';
        const res = await fetch(
          `/api/admin/users/me?uid=${session.user.id}&email=${encodeURIComponent(cleanEmail)}`
        );
        const data = await res.json();

        if (res.ok && data.user && data.user.is_active) {
          setUser(data.user, session.access_token);

          // Clarity user tagging
          const userOutlet =
            data.user.outlet?.name ||
            data.user.outlet_name ||
            (data.user.role === 'admin' || data.user.role === 'super_admin' ? 'All Outlets' : '');
          setClarityUser(data.user.role, userOutlet);

          if (data.user.role === 'staff' || data.user.role === 'ordering_staff') {
            if (isMounted) router.replace('/staff/orders');
          } else {
            if (isMounted) router.replace('/admin/dashboard');
          }
        } else {
          // Inactive user or no profile found
          await supabase.auth.signOut();
          if (isMounted) {
            router.replace('/admin/login');
          }
        }
      } catch (err) {
        console.error('Error resolving landing page for /admin:', err);
        if (isMounted) {
          router.replace('/admin/login');
        }
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };

    resolvePortalLanding();

    return () => {
      isMounted = false;
    };
  }, [router, currentUser, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBEA]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CE5535] mx-auto mb-4" />
        <p className="text-[#75604F] text-xs font-bold tracking-wide">
          {checking ? 'Restoring session...' : 'Redirecting...'}
        </p>
      </div>
    </div>
  );
}
