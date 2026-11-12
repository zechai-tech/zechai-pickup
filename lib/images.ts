import { ASSET_MANIFEST, LEGACY_ASSET_ALIASES } from '@/lib/image-manifest';

export type ImageVariant = 'thumb' | 'tile' | 'hero';

// Tiny 1x1 #F4E7CC cream block SVG encoded as base64 for instant zero-network blurDataURL
export const CREAM_BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOCIgaGVpZ2h0PSI4IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNGNEU3Q0MiLz48L3N2Zz4=';

export const DEFAULT_MENU_IMAGE = '/assets/chai.v1.webp';

const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pdgtdcabbfvhomkpoajw.supabase.co'
).replace(/\/+$/, '');

let supabaseOriginHost = 'pdgtdcabbfvhomkpoajw.supabase.co';
try {
  supabaseOriginHost = new URL(SUPABASE_URL).hostname;
} catch {
  // Keep default host
}

/**
 * Single helper function building and normalizing image URLs across the entire app.
 * - Converts legacy /assets/*.png|jpg paths to versioned .v1.webp files
 * - Selects pre-generated 400w (thumb), 600w (tile), or 800w (hero) variants for Render
 * - Converts Supabase Storage relative paths into full public bucket URLs
 * - Strips untrusted/hotlinked external image hosts (returns '' so SafeImage shows cup mark fallback)
 */
export function resolveImageUrl(
  rawSrc?: string | null,
  variant: ImageVariant = 'hero'
): string {
  if (!rawSrc || typeof rawSrc !== 'string') return '';
  const trimmed = rawSrc.trim();
  if (!trimmed) return '';

  // Allow inline previews from admin file picker
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Normalize legacy static filenames (/assets/chai.jpg -> /assets/chai.v1.webp)
  let normalized = LEGACY_ASSET_ALIASES[trimmed] || trimmed;

  // Map any -thumb / -tile variant back to its manifest key if needed
  const variantMatch = normalized.match(/^(\/assets\/.+?)-(thumb|tile)\.(v\d+\.webp)$/);
  if (variantMatch) {
    normalized = `${variantMatch[1]}.${variantMatch[3]}`;
  }

  const manifestEntry = ASSET_MANIFEST[normalized];
  if (manifestEntry) {
    return manifestEntry[variant] || manifestEntry.hero;
  }

  // Already a local asset or local upload path
  if (normalized.startsWith('/assets/') || normalized.startsWith('/uploads/')) {
    return normalized;
  }

  // Allow HTTPS URLs strictly on our configured Supabase Storage host
  if (normalized.startsWith('https://') || normalized.startsWith('http://')) {
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname === supabaseOriginHost && parsed.pathname.includes('/storage/v1/object/public/')) {
        return normalized;
      }
    } catch {
      return '';
    }
    // Reject hotlinked third-party image hosts -> triggers SafeImage fallback tile
    return '';
  }

  // Treat bare storage paths (e.g., "item-123.webp" or "menu/item-123.webp") as Supabase 'menu' bucket paths
  const cleanStoragePath = normalized.replace(/^\/+/, '').replace(/^menu\//, '');
  if (!cleanStoragePath) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/menu/${cleanStoragePath}`;
}

export function getBlurDataURL(resolvedSrc?: string | null): string {
  if (!resolvedSrc) return CREAM_BLUR_DATA_URL;
  // Normalize -thumb / -tile back to manifest key
  let key = resolvedSrc;
  const variantMatch = key.match(/^(\/assets\/.+?)-(thumb|tile)\.(v\d+\.webp)$/);
  if (variantMatch) {
    key = `${variantMatch[1]}.${variantMatch[3]}`;
  }
  const entry = ASSET_MANIFEST[key];
  return entry?.blurDataURL || CREAM_BLUR_DATA_URL;
}

export function isLocalOptimizedAsset(src: string): boolean {
  return (
    src.startsWith('/assets/') ||
    src.startsWith('/uploads/') ||
    src.startsWith('data:') ||
    src.startsWith('blob:')
  );
}

/**
 * Warms up image URLs in an idle callback while respecting Data Saver (saveData).
 */
const warmedUrlSet = new Set<string>();

export function warmImagesInIdle(urls: string[], maxCount = 8): void {
  if (typeof window === 'undefined') return;

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (nav.connection?.saveData) {
    return;
  }

  const targets = urls
    .map((u, idx) => resolveImageUrl(u, idx < 2 ? 'tile' : 'thumb'))
    .filter((u) => Boolean(u) && !warmedUrlSet.has(u))
    .slice(0, maxCount);

  if (targets.length === 0) return;

  const runWarm = () => {
    for (const url of targets) {
      if (warmedUrlSet.has(url)) continue;
      warmedUrlSet.add(url);
      const img = new window.Image();
      img.decoding = 'async';
      img.src = url;
    }
  };

  const scheduleAfterLoad = () => {
    setTimeout(() => {
      if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(runWarm, { timeout: 3000 });
      } else {
        runWarm();
      }
    }, 2500);
  };

  if (document.readyState === 'complete') {
    scheduleAfterLoad();
  } else {
    window.addEventListener('load', scheduleAfterLoad, { once: true });
  }
}
