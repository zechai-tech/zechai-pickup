import React from 'react';

interface CupMarkSvgProps {
  className?: string;
  variant?: 'orange' | 'cream';
  'aria-hidden'?: boolean;
}

/**
 * Lightweight inline SVG Zécha! cup mark used for SafeImage error/empty fallback tiles
 * and compact cup badges (zero network requests, never fails or shifts layout).
 */
export function CupMarkSvg({
  className = 'w-8 h-8',
  variant = 'orange',
  'aria-hidden': ariaHidden = true,
}: CupMarkSvgProps) {
  const strokeColor = variant === 'cream' ? '#FDFBEA' : '#CE5535';
  const accentFill = variant === 'cream' ? '#FDFBEA' : '#CE5535';
  const steamColor = variant === 'cream' ? 'rgba(253,251,234,0.85)' : 'rgba(206,85,53,0.75)';

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Rising steam swirls */}
      <path
        d="M24 19C24 16 26.5 14.5 26.5 11.5C26.5 9.5 25 8 25 8"
        stroke={steamColor}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M32 17.5C32 14.5 34.5 13 34.5 10C34.5 8 33 6.5 33 6.5"
        stroke={steamColor}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M40 19C40 16 42.5 14.5 42.5 11.5C42.5 9.5 41 8 41 8"
        stroke={steamColor}
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Cup rim & body */}
      <path
        d="M15 24H46V35.5C46 43.5 39.2 49.5 30.5 49.5C21.8 49.5 15 43.5 15 35.5V24Z"
        stroke={strokeColor}
        strokeWidth="3.2"
        strokeLinejoin="round"
        fill={variant === 'cream' ? 'rgba(253,251,234,0.14)' : 'rgba(206,85,53,0.1)'}
      />

      {/* Cup handle */}
      <path
        d="M46 27.5H49.5C52.8 27.5 55.2 30 55.2 33.2C55.2 36.4 52.8 39 49.5 39H45.5"
        stroke={strokeColor}
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      {/* Saucer */}
      <path
        d="M13 54.5H48"
        stroke={accentFill}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
