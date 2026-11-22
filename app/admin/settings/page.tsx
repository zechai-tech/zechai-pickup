'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSettingsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/settings/payments');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBEA]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CE5535] mx-auto mb-4" />
        <p className="text-[#75604F] text-xs font-bold tracking-wide">Loading settings...</p>
      </div>
    </div>
  );
}
