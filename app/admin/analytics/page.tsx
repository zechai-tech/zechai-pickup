'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Store,
} from 'lucide-react';
import { useAdminStore, getUserScope } from '@/stores/admin-store';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { Outlet } from '@/types/supabase';
import {
  ANALYTICS_TABS,
  AnalyticsTab,
  DatePreset,
  buildCsvContent,
  formatDurationSeconds,
  formatHourSlotRange,
  formatINR,
  formatIndianNumber,
  getNowISTFormatted,
  getPresetDateRange,
  slugifyForFilename,
  triggerCsvDownload,
} from '@/lib/analytics-utils';
import { AnalyticsSkeleton, AnalyticsError } from '@/components/admin/analytics/AnalyticsSkeleton';
import { SalesTab, SalesData } from '@/components/admin/analytics/SalesTab';
import { PeakHoursTab, PeakHoursData } from '@/components/admin/analytics/PeakHoursTab';
import { KitchenSpeedTab, KitchenSpeedData } from '@/components/admin/analytics/KitchenSpeedTab';
import { BestItemsTab, BestItemsData } from '@/components/admin/analytics/BestItemsTab';
import { BoughtTogetherTab, BoughtTogetherData } from '@/components/admin/analytics/BoughtTogetherTab';
import {
  RepeatCustomersTab,
  RepeatCustomersData,
} from '@/components/admin/analytics/RepeatCustomersTab';

const PRESET_OPTIONS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7days', label: 'Last 7 days' },
  { key: '30days', label: 'Last 30 days' },
  { key: 'this_month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
];

const VALID_TABS = new Set<AnalyticsTab>(ANALYTICS_TABS.map((t) => t.key));
const VALID_PRESETS = new Set<DatePreset>(PRESET_OPTIONS.map((p) => p.key));

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, isAuthInitialized, sessionToken } = useAdminStore();
  const { isAdmin, isManager } = getUserScope(currentUser);
  const { showToast } = useToast();

  // Derive filter state from URL query string with safe defaults
  const urlTab = searchParams.get('tab') as AnalyticsTab | null;
  const activeTab: AnalyticsTab = urlTab && VALID_TABS.has(urlTab) ? urlTab : 'sales';

  const urlPreset = searchParams.get('preset') as DatePreset | null;
  const activePreset: DatePreset =
    urlPreset && VALID_PRESETS.has(urlPreset) ? urlPreset : '7days';

  const default7 = useMemo(() => getPresetDateRange('7days'), []);
  const resolvedRange = useMemo(() => {
    if (activePreset !== 'custom') {
      return getPresetDateRange(activePreset);
    }
    const f = searchParams.get('from');
    const t = searchParams.get('to');
    if (f && t && /^\d{4}-\d{2}-\d{2}$/.test(f) && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return { from: f, to: t };
    }
    return default7;
  }, [activePreset, searchParams, default7]);

  const urlOutlet = searchParams.get('outlet') || 'all';
  const effectiveOutletParam = isManager
    ? currentUser?.outlet_id || ''
    : urlOutlet;

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Lazy per-tab client state (keyed by tab+filters)
  const [tabData, setTabData] = useState<Partial<Record<AnalyticsTab, any>>>({});
  const [tabMetaKey, setTabMetaKey] = useState<Partial<Record<AnalyticsTab, string>>>({});
  const [loadingTab, setLoadingTab] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const filterKey = `${resolvedRange.from}__${resolvedRange.to}__${effectiveOutletParam || 'all'}`;

  // Update URL search params cleanly
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === '') {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      });
      router.replace(`/admin/analytics?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Close export dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Load outlets list for Admins
  useEffect(() => {
    if (!isAuthInitialized || !currentUser || !isAdmin) return;
    fetch('/api/admin/outlets', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setOutlets(d.outlets || []))
      .catch((err) => console.error('Failed to load outlets for analytics:', err));
  }, [isAuthInitialized, currentUser, isAdmin]);

  // Fetch data ONLY for the currently active tab whenever tab or filters change
  useEffect(() => {
    if (!isAuthInitialized || !currentUser) return;
    if (isManager && !currentUser.outlet_id) return;

    // Skip refetch if we already loaded this exact tab with these exact filters (unless Retry triggered)
    if (tabMetaKey[activeTab] === filterKey && tabData[activeTab] && reloadNonce === 0) {
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    const fetchActiveTab = async () => {
      setLoadingTab(true);
      setErrorMsg(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || sessionToken;
        if (!token) {
          throw new Error('Missing admin session token. Please sign in again.');
        }

        const qs = new URLSearchParams({
          from: resolvedRange.from,
          to: resolvedRange.to,
          outlet_id: effectiveOutletParam || 'all',
        });

        const res = await fetch(`/api/admin/analytics/${activeTab}?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || `Failed to load ${activeTab}`);
        }

        if (!cancelled) {
          setTabData((prev) => ({ ...prev, [activeTab]: json }));
          setTabMetaKey((prev) => ({ ...prev, [activeTab]: filterKey }));
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err?.message || 'Unable to fetch analytics data');
        }
      } finally {
        if (!cancelled) {
          setLoadingTab(false);
        }
      }
    };

    fetchActiveTab();
    return () => {
      cancelled = true;
    };
  }, [
    isAuthInitialized,
    currentUser,
    isManager,
    activeTab,
    filterKey,
    resolvedRange.from,
    resolvedRange.to,
    effectiveOutletParam,
    sessionToken,
    reloadNonce,
    tabMetaKey,
    tabData,
  ]);

  const currentTabLabel =
    ANALYTICS_TABS.find((t) => t.key === activeTab)?.label || 'Analytics';

  const selectedOutletName = useMemo(() => {
    if (isManager) {
      return currentUser?.outlet?.name || currentUser?.outlet_name || 'Assigned Outlet';
    }
    if (!effectiveOutletParam || effectiveOutletParam === 'all') {
      return 'All outlets';
    }
    const found = outlets.find((o) => o.id === effectiveOutletParam);
    return found ? found.name : 'Selected outlet';
  }, [isManager, currentUser, effectiveOutletParam, outlets]);

  const currentData = tabMetaKey[activeTab] === filterKey ? tabData[activeTab] : null;

  // Determine whether the active tab has exportable data
  const hasExportData = useMemo(() => {
    if (!currentData || loadingTab) return false;
    switch (activeTab) {
      case 'sales': {
        const d = currentData as SalesData;
        return (d.kpis?.orders || 0) > 0 || (d.daily && d.daily.some((x) => x.orders > 0));
      }
      case 'peak-hours': {
        const d = currentData as PeakHoursData;
        return (d.hourly || []).some((h) => Number(h.orders) > 0);
      }
      case 'kitchen-speed': {
        const d = currentData as KitchenSpeedData;
        return (d.kpis?.measured_orders || 0) > 0;
      }
      case 'best-items': {
        const d = currentData as BestItemsData;
        return (d.items?.length || 0) > 0 || (d.slow_movers?.length || 0) > 0;
      }
      case 'bought-together': {
        const d = currentData as BoughtTogetherData;
        return Boolean(d.has_enough_data && d.pairs && d.pairs.length > 0);
      }
      case 'repeat-customers': {
        const d = currentData as RepeatCustomersData;
        return Boolean(d.has_enough_data && d.top_customers && d.top_customers.length > 0);
      }
      default:
        return false;
    }
  }, [activeTab, currentData, loadingTab]);

  // Build tabular export sections for both CSV and PDF
  const buildExportPayload = useCallback(() => {
    if (!currentData) return null;

    const outletSlug = slugifyForFilename(selectedOutletName);
    const baseFilename = `zecha-${activeTab}-${resolvedRange.from}_to_${resolvedRange.to}-${outletSlug}`;

    if (activeTab === 'sales') {
      const d = currentData as SalesData;
      const totOrders = d.daily.reduce((s, r) => s + Number(r.orders || 0), 0);
      const totRev = d.daily.reduce((s, r) => s + Number(r.revenue || 0), 0);
      const totAov = totOrders > 0 ? totRev / totOrders : 0;

      const sections: Array<{
        title?: string;
        headers: string[];
        rows: Array<Array<string | number>>;
        hasTotalRow?: boolean;
      }> = [
        {
          title: 'Daily Sales Breakdown',
          headers: ['Date', 'Orders', 'Revenue', 'Avg order value'],
          rows: [
            ...d.daily.map((r) => [
              r.formatted_date,
              r.orders,
              formatINR(r.revenue),
              formatINR(r.orders > 0 ? r.avg_order_value : 0),
            ]),
            ['Total', totOrders, formatINR(totRev), formatINR(totAov)],
          ],
          hasTotalRow: true,
        },
      ];

      if ((!effectiveOutletParam || effectiveOutletParam === 'all') && d.outlets?.length > 0) {
        const outOrders = d.outlets.reduce((s, r) => s + Number(r.orders || 0), 0);
        const outRev = d.outlets.reduce((s, r) => s + Number(r.revenue || 0), 0);
        sections.push({
          title: 'Outlet Breakdown',
          headers: ['Outlet', 'Orders', 'Revenue', 'Share %'],
          rows: [
            ...d.outlets.map((o) => [
              o.outlet_name,
              o.orders,
              formatINR(o.revenue),
              `${Number(o.share_percentage || 0).toFixed(1)}%`,
            ]),
            ['Total', outOrders, formatINR(outRev), '100.0%'],
          ],
          hasTotalRow: true,
        });
      }

      return {
        baseFilename,
        kpis: [
          { label: 'Total Revenue', value: formatINR(d.kpis.revenue) },
          { label: 'Orders', value: formatIndianNumber(d.kpis.orders) },
          { label: 'Avg Order Value', value: formatINR(d.kpis.avg_order_value) },
          { label: 'Items Sold', value: formatIndianNumber(d.kpis.items_sold) },
        ],
        sections,
      };
    }

    if (activeTab === 'peak-hours') {
      const d = currentData as PeakHoursData;
      const totHourOrders = d.hourly.reduce((s, h) => s + Number(h.orders || 0), 0);
      const totHourRev = d.hourly.reduce((s, h) => s + Number(h.revenue || 0), 0);
      return {
        baseFilename,
        sections: [
          {
            title: 'Hourly Totals (IST)',
            headers: ['Hour Slot (IST)', 'Orders', 'Revenue'],
            rows: [
              ...d.hourly.map((h) => [
                formatHourSlotRange(h.hour),
                h.orders,
                formatINR(h.revenue),
              ]),
              ['Total', totHourOrders, formatINR(totHourRev)],
            ],
            hasTotalRow: true,
          },
          {
            title: 'Weekday x Hour Breakdown (Active Slots)',
            headers: ['Day', 'Hour Slot (IST)', 'Orders', 'Revenue'],
            rows: d.grid
              .filter((c) => Number(c.orders) > 0)
              .map((c) => [
                c.day_name,
                formatHourSlotRange(c.hour),
                c.orders,
                formatINR(c.revenue),
              ]),
          },
        ],
      };
    }

    if (activeTab === 'kitchen-speed') {
      const d = currentData as KitchenSpeedData;
      return {
        baseFilename,
        kpis: [
          {
            label: 'Avg Paid to Ready',
            value: formatDurationSeconds(d.kpis.avg_paid_to_ready_sec),
          },
          {
            label: 'Ready <= 20 min',
            value: `${Number(d.kpis.pct_within_20 || 0).toFixed(1)}%`,
          },
          { label: 'Measured Orders', value: String(d.kpis.measured_orders) },
          { label: 'Excluded Orders', value: String(d.kpis.excluded_orders) },
        ],
        sections: [
          {
            title: 'Stage Averages',
            headers: ['Metric', 'Value'],
            rows: [
              ['Avg Making (paid/making -> packaging)', formatDurationSeconds(d.kpis.avg_making_sec)],
              ['Avg Packaging (packaging -> ready)', formatDurationSeconds(d.kpis.avg_packaging_sec)],
              ['Avg Total Paid -> Ready', formatDurationSeconds(d.kpis.avg_paid_to_ready_sec)],
              ['Orders Ready Within 20 min', `${Number(d.kpis.pct_within_20 || 0).toFixed(1)}%`],
            ],
          },
          {
            title: '10 Slowest Orders',
            headers: ['Order #', 'Outlet', 'Ordered At (IST)', 'Total Time'],
            rows: d.slowest_orders.map((o) => [
              `#${o.order_number}`,
              o.outlet_name || '-',
              o.ordered_at,
              formatDurationSeconds(o.total_seconds),
            ]),
          },
        ],
      };
    }

    if (activeTab === 'best-items') {
      const d = currentData as BestItemsData;
      const totQty = d.items.reduce((s, r) => s + Number(r.qty_sold || 0), 0);
      const totRev = d.items.reduce((s, r) => s + Number(r.revenue || 0), 0);
      return {
        baseFilename,
        sections: [
          {
            title: 'Best Selling Items',
            headers: ['Rank', 'Item', 'Qty sold', 'Revenue', '% of revenue'],
            rows: [
              ...d.items.map((item) => [
                item.rank,
                item.name,
                item.qty_sold,
                formatINR(item.revenue),
                `${Number(item.share_pct || 0).toFixed(1)}%`,
              ]),
              ['', 'Total', totQty, formatINR(totRev), '100.0%'],
            ],
            hasTotalRow: true,
          },
          {
            title: '5 Slow Movers',
            headers: ['Item', 'Units sold'],
            rows: (d.slow_movers || []).map((s) => [s.name, s.qty_sold]),
          },
        ],
      };
    }

    if (activeTab === 'bought-together') {
      const d = currentData as BoughtTogetherData;
      return {
        baseFilename,
        sections: [
          {
            title: 'Frequently Bought Together (Top 15)',
            headers: ['Item A + Item B', 'Times together', '% of orders containing A'],
            rows: d.pairs.map((p) => [
              `${p.item_a} + ${p.item_b}`,
              p.times_together,
              `${Number(p.pct_of_a || 0).toFixed(1)}%`,
            ]),
          },
        ],
      };
    }

    if (activeTab === 'repeat-customers') {
      const d = currentData as RepeatCustomersData;
      return {
        baseFilename,
        kpis: [
          { label: 'Unique Customers', value: formatIndianNumber(d.kpis.unique_customers) },
          { label: 'New Customers', value: formatIndianNumber(d.kpis.new_customers) },
          { label: 'Returning', value: formatIndianNumber(d.kpis.returning_customers) },
          { label: 'Repeat Rate', value: `${Number(d.kpis.repeat_rate_pct || 0).toFixed(1)}%` },
        ],
        sections: [
          {
            title: 'Top 20 Customers',
            headers: [
              'Phone',
              'Name',
              'Orders',
              'Total spent',
              'Last order date',
              'Avg days between orders',
            ],
            rows: d.top_customers.map((c) => [
              c.phone,
              c.name || 'Guest Customer',
              c.orders,
              formatINR(c.total_spent),
              c.last_order_date,
              c.avg_days_between !== null && c.avg_days_between !== undefined
                ? `${c.avg_days_between} d`
                : '—',
            ]),
          },
        ],
      };
    }

    return null;
  }, [activeTab, currentData, selectedOutletName, resolvedRange, effectiveOutletParam]);

  const handleDownloadCsv = () => {
    setExportMenuOpen(false);
    if (!hasExportData) {
      showToast('Nothing to export for this range', 'info');
      return;
    }
    const payload = buildExportPayload();
    if (!payload) {
      showToast('Nothing to export for this range', 'info');
      return;
    }
    const csv = buildCsvContent(payload.sections);
    triggerCsvDownload(`${payload.baseFilename}.csv`, csv);
    showToast('CSV exported', 'success');
  };

  const handleDownloadPdf = async () => {
    setExportMenuOpen(false);
    if (!hasExportData) {
      showToast('Nothing to export for this range', 'info');
      return;
    }
    const payload = buildExportPayload();
    if (!payload) {
      showToast('Nothing to export for this range', 'info');
      return;
    }
    try {
      setExportingPdf(true);
      const { generateAnalyticsPdf } = await import('@/lib/analytics-pdf');
      await generateAnalyticsPdf({
        tabLabel: currentTabLabel,
        dateRangeLabel: `${resolvedRange.from} to ${resolvedRange.to}`,
        outletLabel: selectedOutletName,
        generatedAtIST: getNowISTFormatted(),
        filename: `${payload.baseFilename}.pdf`,
        kpis: payload.kpis,
        sections: payload.sections,
      });
      showToast('PDF report downloaded', 'success');
    } catch (err: any) {
      console.error('PDF generation failed:', err);
      showToast('Failed to generate PDF report', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleTabChange = (tab: AnalyticsTab) => {
    setReloadNonce(0);
    updateUrlParams({ tab });
  };

  const handlePresetChange = (preset: DatePreset) => {
    setReloadNonce(0);
    if (preset === 'custom') {
      updateUrlParams({
        preset: 'custom',
        from: resolvedRange.from,
        to: resolvedRange.to,
      });
    } else {
      const range = getPresetDateRange(preset);
      updateUrlParams({
        preset,
        from: range.from,
        to: range.to,
      });
    }
  };

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="max-w-7xl mx-auto pb-16 space-y-5 font-sans">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#2B1A12] text-[#FDFBEA] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-[#E8B125]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B1A12] tracking-tight">
                  Analytics
                </h1>
                <span className="px-2.5 py-1 rounded-full bg-[#F4E7CC] border border-[#EADFC7] text-[11px] font-extrabold text-[#2B1A12] uppercase tracking-wide">
                  App orders only
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#75604F] font-medium">
                Read-only pickup app reporting · All dates & hours in IST
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Filter & Export Bar */}
        <div className="sticky top-0 z-30 bg-[#FDFBEA]/95 backdrop-blur-md py-3 -mx-2 px-2 border-b border-[#EADFC7] space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Date Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <Calendar className="w-4 h-4 text-[#75604F] shrink-0 mr-1 hidden sm:block" />
              {PRESET_OPTIONS.map((p) => {
                const isActive = activePreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handlePresetChange(p.key)}
                    className={`px-3.5 min-h-[44px] rounded-xl text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                      isActive
                        ? 'bg-[#CE5535] text-[#FDFBEA] shadow-xs'
                        : 'bg-[#FFFEF7] border border-[#EADFC7] text-[#2B1A12] hover:bg-[#F4E7CC]/50'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Outlet Selector + Export Dropdown */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Custom Date Inputs if Custom preset is active */}
              {activePreset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    aria-label="From date"
                    value={resolvedRange.from}
                    max={resolvedRange.to}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setReloadNonce(0);
                      updateUrlParams({ preset: 'custom', from: e.target.value });
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-[#FFFEF7] border border-[#EADFC7] text-xs font-bold text-[#2B1A12]"
                  />
                  <span className="text-xs font-bold text-[#75604F]">to</span>
                  <input
                    type="date"
                    aria-label="To date"
                    value={resolvedRange.to}
                    min={resolvedRange.from}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setReloadNonce(0);
                      updateUrlParams({ preset: 'custom', to: e.target.value });
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-[#FFFEF7] border border-[#EADFC7] text-xs font-bold text-[#2B1A12]"
                  />
                </div>
              )}

              {/* Outlet Selector for Admins vs Fixed Badge for Managers */}
              {isAdmin ? (
                <div className="relative flex items-center">
                  <Store className="w-4 h-4 text-[#75604F] absolute left-3 pointer-events-none" />
                  <select
                    aria-label="Select outlet"
                    value={urlOutlet}
                    onChange={(e) => {
                      setReloadNonce(0);
                      updateUrlParams({ outlet: e.target.value });
                    }}
                    className="min-h-[44px] pl-9 pr-8 rounded-xl bg-[#FFFEF7] border border-[#EADFC7] text-xs font-bold text-[#2B1A12] appearance-none cursor-pointer focus:outline-none focus:border-[#CE5535]"
                  >
                    <option value="all">All outlets</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#75604F] absolute right-2.5 pointer-events-none" />
                </div>
              ) : (
                <div className="min-h-[44px] px-3.5 rounded-xl bg-[#FFFEF7] border border-[#EADFC7] flex items-center gap-2 text-xs font-bold text-[#2B1A12]">
                  <Store className="w-4 h-4 text-[#CE5535]" />
                  <span>{selectedOutletName}</span>
                </div>
              )}

              {/* Export Dropdown */}
              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  aria-disabled={!hasExportData || exportingPdf}
                  onClick={() => {
                    if (!hasExportData) {
                      showToast('Nothing to export for this range', 'info');
                      return;
                    }
                    setExportMenuOpen((prev) => !prev);
                  }}
                  className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                    !hasExportData || exportingPdf
                      ? 'bg-[#F4E7CC]/70 text-[#75604F] border border-[#EADFC7] opacity-60 cursor-not-allowed'
                      : 'bg-[#2B1A12] text-[#FDFBEA] hover:bg-[#1C100A]'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>{exportingPdf ? 'Exporting PDF...' : 'Export'}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {exportMenuOpen && hasExportData && (
                  <div className="absolute right-0 mt-1.5 w-48 rounded-2xl bg-[#FFFEF7] border border-[#EADFC7] shadow-xl py-1.5 z-40">
                    <button
                      type="button"
                      onClick={handleDownloadCsv}
                      className="w-full min-h-[44px] px-4 text-left text-xs font-bold text-[#2B1A12] hover:bg-[#F4E7CC]/50 flex items-center gap-2.5"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-[#2F7A3E]" />
                      <span>Download CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="w-full min-h-[44px] px-4 text-left text-xs font-bold text-[#2B1A12] hover:bg-[#F4E7CC]/50 flex items-center gap-2.5"
                    >
                      <FileText className="w-4 h-4 text-[#CE5535]" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 6 Tabs (Horizontally scrollable on mobile) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {ANALYTICS_TABS.map((t) => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleTabChange(t.key)}
                  className={`px-4 min-h-[44px] rounded-2xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-colors shrink-0 ${
                    isActive
                      ? 'bg-[#2B1A12] text-[#FDFBEA] shadow-xs'
                      : 'bg-[#FFFEF7] border border-[#EADFC7] text-[#75604F] hover:text-[#2B1A12] hover:bg-[#F4E7CC]/40'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Tab Content */}
        {loadingTab && !currentData ? (
          <AnalyticsSkeleton />
        ) : errorMsg ? (
          <AnalyticsError
            message={errorMsg}
            onRetry={() => setReloadNonce((n) => n + 1)}
          />
        ) : currentData ? (
          <>
            {activeTab === 'sales' && (
              <SalesTab
                data={currentData}
                isAllOutlets={!effectiveOutletParam || effectiveOutletParam === 'all'}
              />
            )}
            {activeTab === 'peak-hours' && <PeakHoursTab data={currentData} />}
            {activeTab === 'kitchen-speed' && <KitchenSpeedTab data={currentData} />}
            {activeTab === 'best-items' && <BestItemsTab data={currentData} />}
            {activeTab === 'bought-together' && <BoughtTogetherTab data={currentData} />}
            {activeTab === 'repeat-customers' && <RepeatCustomersTab data={currentData} />}
          </>
        ) : (
          <AnalyticsSkeleton />
        )}
      </div>
    </RoleGuard>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent />
    </Suspense>
  );
}
