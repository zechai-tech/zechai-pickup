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
  const { currentUser } = useAdminStore();

  useEffect(() => {
    // If not logged in, go to login
    if (!currentUser) {
      router.push('/admin/login');
      return;
    }

    // If role not allowed
    if (!allowedRoles.includes(currentUser.role)) {
      if (currentUser.role === 'staff' || currentUser.role === 'ordering_staff') {
        router.push('/admin/orders');
      } else {
        router.push('/admin/dashboard');
      }
    }
  }, [currentUser, allowedRoles, router]);

  if (!currentUser) {
    return (
      <div className="flex-1 min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange animate-spin" />
      </div>
    );
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return null;
  }

  return <>{children}</>;
}
