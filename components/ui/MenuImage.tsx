'use client';

import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';

interface MenuImageProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string;
}

export function MenuImage({
  src,
  alt,
  fallbackSrc = '/assets/chai.jpg',
  className,
  ...props
}: MenuImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#FAF4E6]">
      <Image
        {...props}
        src={hasError ? fallbackSrc : imgSrc}
        alt={alt}
        className={className}
        onError={() => {
          setHasError(true);
        }}
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#FAF4E6]">
          <Image
            src="/assets/mascot-orange.png"
            alt="Zécha Cup"
            width={32}
            height={32}
            className="opacity-40 object-contain"
          />
        </div>
      )}
    </div>
  );
}
