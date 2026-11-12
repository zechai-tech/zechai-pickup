'use client';

import React from 'react';
import { SafeImage, SafeImageProps } from '@/components/ui/SafeImage';

export type MenuImageProps = SafeImageProps;

/**
 * Re-export SafeImage as MenuImage so existing imports remain compatible.
 */
export function MenuImage(props: MenuImageProps) {
  return <SafeImage {...props} />;
}
