import React from 'react';

export default function StaticFlag({ className = 'w-7 h-7' }) {
  return (
    <svg viewBox="0 0 32 32" className={`pointer-events-none ${className}`} aria-hidden="true">
      <defs>
        <clipPath id="cornerFlagClip">
          <polygon points="32,0 32,32 0,0" />
        </clipPath>
      </defs>
      <g clipPath="url(#cornerFlagClip)">
        {/* White background for stripes */}
        <rect width="32" height="32" fill="#ffffff" />
        {/* Red stripes (US 7 red stripes of 13 total) */}
        <rect y="0" width="32" height="2.46" fill="#b22234" />
        <rect y="4.92" width="32" height="2.46" fill="#b22234" />
        <rect y="9.84" width="32" height="2.46" fill="#b22234" />
        <rect y="14.76" width="32" height="2.46" fill="#b22234" />
        <rect y="19.68" width="32" height="2.46" fill="#b22234" />
        <rect y="24.60" width="32" height="2.46" fill="#b22234" />
        <rect y="29.52" width="32" height="2.48" fill="#b22234" />
        {/* Blue canton */}
        <rect x="0" y="0" width="16" height="17.2" fill="#3c3b6e" />
        {/* White star dots */}
        <circle cx="4" cy="3.5" r="0.85" fill="#ffffff" />
        <circle cx="8" cy="3.5" r="0.85" fill="#ffffff" />
        <circle cx="12" cy="3.5" r="0.85" fill="#ffffff" />
        <circle cx="6" cy="6.8" r="0.85" fill="#ffffff" />
        <circle cx="10" cy="6.8" r="0.85" fill="#ffffff" />
        <circle cx="4" cy="10.2" r="0.85" fill="#ffffff" />
        <circle cx="8" cy="10.2" r="0.85" fill="#ffffff" />
        <circle cx="12" cy="10.2" r="0.85" fill="#ffffff" />
        <circle cx="6" cy="13.6" r="0.85" fill="#ffffff" />
        <circle cx="10" cy="13.6" r="0.85" fill="#ffffff" />
      </g>
    </svg>
  );
}
