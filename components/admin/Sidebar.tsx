'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Users,
  Store,
  X,
  ExternalLink,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useAdminStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = mounted && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin');
  const isSuperAdmin = mounted && (currentUser?.role === 'super_admin' || currentUser?.role === 'admin');

  const navItems = [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Orders',
      href: '/admin/orders',
      icon: ShoppingBag,
    },
    {
      label: 'Menu Items',
      href: '/admin/menu',
      icon: UtensilsCrossed,
    },
    {
      label: 'Users & Staff',
      href: '/admin/users',
      icon: Users,
    },
    ...(isAdmin
      ? [
          {
            label: 'Outlets',
            href: '/admin/outlets',
            icon: Store,
          },
        ]
      : []),
  ];

  const visibleItems = navItems;

  const content = (
    <div className="flex flex-col h-full justify-between bg-card border-r border-border p-4">
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-6 pt-2 px-2 border-b border-border/70">
          <Link href="/admin/dashboard" className="flex items-center gap-3">
            <div className="relative w-28 h-8">
              <Image
                src="/assets/logo-orange.png"
                alt="Zécha!"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-espresso/60 hover:bg-sand/60"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation links */}
        <nav className="mt-6 space-y-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition-all duration-150',
                  isActive
                    ? 'bg-espresso text-cream shadow-sm'
                    : 'text-espresso/80 hover:bg-sand/60 hover:text-espresso'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 transition-colors',
                    isActive ? 'text-mustard' : 'text-espresso/60'
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Settings Section (super_admin only) */}
          {isSuperAdmin && (
            <div className="pt-4 mt-4 border-t border-border/70 space-y-1.5">
              <p className="px-3.5 pb-1 text-[11px] font-black tracking-wider uppercase text-espresso/45">
                Settings
              </p>
              <Link
                href="/admin/settings/payments"
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition-all duration-150',
                  pathname === '/admin/settings/payments'
                    ? 'bg-espresso text-cream shadow-sm'
                    : 'text-espresso/80 hover:bg-sand/60 hover:text-espresso'
                )}
              >
                <CreditCard
                  className={cn(
                    'w-5 h-5 transition-colors',
                    pathname === '/admin/settings/payments' ? 'text-mustard' : 'text-espresso/60'
                  )}
                />
                <span>Payments</span>
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* Footer link to view customer storefront */}
      <div className="pt-4 border-t border-border/70">
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between p-3 rounded-xl bg-sand/40 hover:bg-sand text-xs font-bold text-espresso transition-colors"
        >
          <span>View Customer App</span>
          <ExternalLink className="w-4 h-4 text-espresso/50" />
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop/Tablet static sidebar */}
      <aside className="hidden md:block w-64 shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-espresso/50 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          {/* Drawer content */}
          <div className="relative w-72 max-w-[80vw] h-full z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
