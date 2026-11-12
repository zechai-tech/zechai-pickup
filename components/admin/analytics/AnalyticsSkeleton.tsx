'use client';

import React from 'react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 rounded-[20px] bg-[#FFFEF7] border border-[#EADFC7] p-5 flex flex-col justify-between"
          >
            <div className="h-3 w-24 rounded bg-[#F4E7CC]" />
            <div className="h-7 w-32 rounded bg-[#F4E7CC]" />
            <div className="h-3 w-20 rounded bg-[#F4E7CC]/70" />
          </div>
        ))}
      </div>

      <div className="h-72 rounded-[20px] bg-[#FFFEF7] border border-[#EADFC7] p-5">
        <div className="h-4 w-40 rounded bg-[#F4E7CC] mb-4" />
        <div className="h-52 w-full rounded-xl bg-[#F4E7CC]/40" />
      </div>

      <div className="h-64 rounded-[20px] bg-[#FFFEF7] border border-[#EADFC7] p-5 space-y-3">
        <div className="h-4 w-36 rounded bg-[#F4E7CC]" />
        <div className="h-9 w-full rounded-lg bg-[#F4E7CC]/60" />
        <div className="h-9 w-full rounded-lg bg-[#F4E7CC]/40" />
        <div className="h-9 w-full rounded-lg bg-[#F4E7CC]/40" />
      </div>
    </div>
  );
}

export function AnalyticsError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="bg-[#FFFEF7] border border-[#BA1A1A]/30 rounded-[20px] p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-[#BA1A1A]/10 text-[#BA1A1A] flex items-center justify-center mx-auto">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <h3 className="text-base font-extrabold text-[#2B1A12]">
          Could not load analytics
        </h3>
        <p className="text-xs text-[#75604F]">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-xl bg-[#CE5535] hover:bg-[#A8401F] text-[#FDFBEA] text-xs font-bold transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Retry</span>
      </button>
    </div>
  );
}

export function AnalyticsEmpty({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-10 text-center space-y-2">
      <div className="w-12 h-12 rounded-2xl bg-[#F4E7CC] text-[#75604F] flex items-center justify-center mx-auto mb-3">
        <Inbox className="w-6 h-6" />
      </div>
      <h3 className="text-base font-extrabold text-[#2B1A12]">{title}</h3>
      {subtitle && (
        <p className="text-xs text-[#75604F] max-w-md mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
