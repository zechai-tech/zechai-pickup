'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { Sidebar } from '@/components/admin/Sidebar';
import { TopBar } from '@/components/admin/TopBar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useAdminStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Clean layout for login page without topbar/sidebar
  const isLoginPage = pathname === '/admin/login';

  // If a non-admin / non-manager tries to access /admin/* routes, redirect to /orders
  useEffect(() => {
    if (!isLoginPage && currentUser) {
      if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
        router.push('/orders');
      }
    }
  }, [currentUser, isLoginPage, router]);

  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-cream text-espresso flex flex-col justify-center items-center p-4">
        {children}
      </div>
    );
  }

  // If logged in as staff, block render while redirecting
  if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return null;
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
