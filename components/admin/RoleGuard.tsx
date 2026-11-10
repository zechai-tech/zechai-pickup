'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { UserRole } from '@/types/supabase';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const { currentUser, isAuthInitialized } = useAdminStore();

  useEffect(() => {
    // Only evaluate route protection AFTER async auth initialization completes
    if (!isAuthInitialized) return;

    // If not logged in, go to login
    if (!currentUser) {
      router.replace('/admin/login');
      return;
    }

    // If role not allowed
    const isRoleAllowed =
      allowedRoles.includes(currentUser.role) ||
      (allowedRoles.includes('admin') && currentUser.role === 'super_admin');

    if (!isRoleAllowed) {
      if (currentUser.role === 'staff' || currentUser.role === 'ordering_staff') {
        router.replace('/staff/orders');
      } else {
        router.replace('/admin/dashboard');
      }
    }
  }, [currentUser, isAuthInitialized, allowedRoles, router]);

  if (!isAuthInitialized || !currentUser) {
    return (
      <div className="flex-1 min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange animate-spin mx-auto mb-2" />
          <p className="text-espresso/60 text-xs font-semibold">Loading access...</p>
        </div>
      </div>
    );
  }

  const isRoleAllowed =
    allowedRoles.includes(currentUser.role) ||
    (allowedRoles.includes('admin') && currentUser.role === 'super_admin');

  if (!isRoleAllowed) {
    return null;
  }

  return <>{children}</>;
}
