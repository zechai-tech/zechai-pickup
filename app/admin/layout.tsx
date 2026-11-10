'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/admin/Sidebar';
import { TopBar } from '@/components/admin/TopBar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Clean layout for login page without topbar/sidebar
  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-cream text-espresso flex flex-col justify-center items-center p-4">
        {children}
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
