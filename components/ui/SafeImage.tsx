'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image, { ImageProps } from 'next/image';
import {
  resolveImageUrl,
  getBlurDataURL,
  isLocalOptimizedAsset,
  ImageVariant,
} from '@/lib/images';
import { CupMarkSvg } from '@/components/ui/CupMarkSvg';
import { cn } from '@/lib/utils';

export interface SafeImageProps
  extends Omit<ImageProps, 'src' | 'onError' | 'placeholder' | 'blurDataURL'> {
  src?: string | null;
  alt: string;
  variant?: ImageVariant;
  containerClassName?: string;
  fallbackVariant?: 'orange' | 'cream';
  transparent?: boolean;
  preloadNearViewport?: boolean;
}

/**
 * Resilient next/image wrapper used across customer & admin screens:
 * - Resolves versioned local WebP assets & single-source storage URLs via lib/images.ts
 * - Renders instant cream (#F4E7CC) / matched blurDataURL placeholder
 * - Retries once on error, then permanently swaps to cream tile + Zécha! cup mark SVG
 * - Serves pre-sized local files with `unoptimized` so Render never stalls runtime resizing
 * - Fade-in is opacity-only 150ms (disabled under prefers-reduced-motion), zero CLS
 */
export function SafeImage({
  src,
  alt,
  variant = 'hero',
  className,
  containerClassName,
  fallbackVariant = 'orange',
  transparent = false,
  preloadNearViewport = false,
  priority = false,
  loading,
  fill,
  width,
  height,
  sizes,
  ...props
}: SafeImageProps) {
  const resolvedSrc = useMemo(() => resolveImageUrl(src, variant), [src, variant]);
  const blurUrl = useMemo(() => getBlurDataURL(resolvedSrc), [resolvedSrc]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [failed, setFailed] = useState(!resolvedSrc);
  const [loaded, setLoaded] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(priority);

  // Reset state whenever src changes
  useEffect(() => {
    setRetryCount(0);
    setFailed(!resolvedSrc);
    setLoaded(false);
  }, [resolvedSrc]);

  // Eagerly trigger load when within 300px of viewport for menu rows
  useEffect(() => {
    if (!preloadNearViewport || priority || isNearViewport || !resolvedSrc) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [preloadNearViewport, priority, isNearViewport, resolvedSrc]);

  const effectiveSrc = useMemo(() => {
    if (!resolvedSrc) return '';
    if (retryCount === 0) return resolvedSrc;
    const sep = resolvedSrc.includes('?') ? '&' : '?';
    return `${resolvedSrc}${sep}retry=${retryCount}`;
  }, [resolvedSrc, retryCount]);

  const handleError = () => {
    if (retryCount < 1 && resolvedSrc) {
      setRetryCount(1);
    } else {
      setFailed(true);
    }
  };

  // Fixed-size wrapper guarantees zero layout shift even in fallback state
  const boxStyle: React.CSSProperties | undefined =
    !fill && width && height
      ? { width: Number(width), height: Number(height) }
      : undefined;

  if (failed || !effectiveSrc) {
    return (
      <div
        style={boxStyle}
        className={cn(
          fill ? 'absolute inset-0 w-full h-full' : 'relative inline-flex shrink-0',
          'bg-[#F4E7CC] flex items-center justify-center overflow-hidden',
          containerClassName
        )}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={!alt ? true : undefined}
      >
        <CupMarkSvg
          variant={fallbackVariant}
          className="w-8 h-8 opacity-75"
          aria-hidden={true}
        />
      </div>
    );
  }

  const effectiveLoading = priority
    ? undefined
    : isNearViewport
    ? 'eager'
    : loading ?? 'lazy';

  return (
    <div
      ref={containerRef}
      style={boxStyle}
      className={cn(
        fill ? 'relative w-full h-full' : 'relative inline-block shrink-0',
        transparent ? 'bg-transparent overflow-visible' : 'bg-[#F4E7CC] overflow-hidden',
        containerClassName
      )}
    >
      <Image
        {...props}
        src={effectiveSrc}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        sizes={sizes}
        priority={priority}
        loading={effectiveLoading}
        decoding="async"
        placeholder={transparent ? 'empty' : 'blur'}
        blurDataURL={transparent ? undefined : blurUrl}
        unoptimized={isLocalOptimizedAsset(resolvedSrc)}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={cn(
          'transition-opacity duration-150 motion-reduce:transition-none',
          loaded ? 'opacity-100' : transparent ? 'opacity-100' : 'opacity-90',
          className
        )}
      />
    </div>
  );
}
