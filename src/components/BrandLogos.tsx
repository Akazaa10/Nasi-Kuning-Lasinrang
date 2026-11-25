import React from 'react';

interface LogoProps {
  className?: string;
}

/**
 * Logo Resmi QRIS (Quick Response Code Indonesian Standard) & GPN
 */
export const QrisLogo: React.FC<LogoProps> = ({ className = 'h-7 w-auto' }) => (
  <div className={`inline-flex items-center gap-2 ${className}`}>
    <div className="px-2.5 py-1 rounded-lg bg-white text-[#30251F] flex items-center gap-1.5 fx-2d-ivory">
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="8" height="8" rx="1.5" stroke="#111111" strokeWidth="2.2" />
        <rect x="4.5" y="4.5" width="3" height="3" fill="#A83A2D" />
        <rect x="14" y="2" width="8" height="8" rx="1.5" stroke="#111111" strokeWidth="2.2" />
        <rect x="16.5" y="4.5" width="3" height="3" fill="#111111" />
        <rect x="2" y="14" width="8" height="8" rx="1.5" stroke="#111111" strokeWidth="2.2" />
        <rect x="4.5" y="16.5" width="3" height="3" fill="#111111" />
        <path d="M14 14H17V17H14V14ZM19 14H22V17H19V14ZM14 19H17V22H14V19ZM19 19H22V22H19V19Z" fill="#A83A2D" />
      </svg>
      <span className="font-bold text-xs tracking-tight text-[#111111]">QRIS</span>
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#A83A2D] text-white leading-none tracking-wider fx-2d-badge-pill">
        GPN
      </span>
    </div>
  </div>
);

/**
 * Logo Resmi DANA (#108EE9 Blue Emblem — 3D Sculpted App Icon)
 */
export const DanaLogoIcon: React.FC<LogoProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 40 40"
    className={`${className} rounded-[10px] fx-2d-blue`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="dana3dBg" x1="20" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#47B5FF" />
        <stop offset="50%" stopColor="#108EE9" />
        <stop offset="100%" stopColor="#085E9E" />
      </linearGradient>
      <linearGradient id="dana3dGloss" x1="20" y1="1" x2="20" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.48" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="10" fill="url(#dana3dBg)" />
    <rect x="1.5" y="1.5" width="37" height="18" rx="8.5" fill="url(#dana3dGloss)" />
    <path
      d="M9.5 16.4C13.6 14.3 18.2 14.4 22.3 16.4C25.2 17.8 27.9 18.1 30.5 16.9V24.2C27.5 25.8 24.1 25.7 20.6 23.9C16.9 22 13.3 22 9.5 23.9V16.4Z"
      fill="#FFFFFF"
    />
    <path
      d="M9.5 19.6C13.4 17.8 17.3 17.9 21 19.8C24.3 21.5 27.4 21.6 30.5 20.1V21.7C27.3 23.2 24.1 23.1 20.7 21.4C17.1 19.6 13.4 19.5 9.5 21.3V19.6Z"
      fill="#108EE9"
    />
  </svg>
);

export const DanaLogoInline: React.FC<LogoProps> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 32 32"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="15" fill="#FFFFFF" fillOpacity="0.2" />
    <path
      d="M7 13.2C10.5 11.4 14.4 11.5 17.9 13.2C20.4 14.4 22.7 14.6 25 13.6V19.6C22.4 21 19.5 20.9 16.5 19.4C13.3 17.8 10.2 17.8 7 19.4V13.2Z"
      fill="#FFFFFF"
    />
  </svg>
);

/**
 * Logo Resmi GoPay (#00AA13 Gojek Green + GoPay Wallet Accent — 3D Sculpted App Icon)
 */
export const GopayLogoIcon: React.FC<LogoProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 40 40"
    className={`${className} rounded-[10px] fx-2d-icon-gojek`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="gopay3dBg" x1="20" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#22D437" />
        <stop offset="52%" stopColor="#00AA13" />
        <stop offset="100%" stopColor="#00730D" />
      </linearGradient>
      <linearGradient id="gopay3dGloss" x1="20" y1="1" x2="20" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.48" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="10" fill="url(#gopay3dBg)" />
    <rect x="1.5" y="1.5" width="37" height="18" rx="8.5" fill="url(#gopay3dGloss)" />
    <rect x="9" y="12" width="22" height="16" rx="4.5" fill="#FFFFFF" />
    <path d="M23 17H31V23H23C21.3431 23 20 21.6569 20 20C20 18.3431 21.3431 17 23 17Z" fill="#00AED6" />
    <circle cx="23.5" cy="20" r="1.6" fill="#FFFFFF" />
    <circle cx="14.5" cy="20" r="2.6" fill="#00AA13" />
  </svg>
);

export const GopayLogoInline: React.FC<LogoProps> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 32 32"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="15" fill="#FFFFFF" fillOpacity="0.2" />
    <rect x="7.5" y="10" width="17" height="12" rx="3.5" fill="#FFFFFF" />
    <circle cx="19.5" cy="16" r="2.2" fill="#00AA13" />
    <circle cx="12" cy="16" r="2" fill="#00AED6" />
  </svg>
);

/**
 * Logo Resmi GoFood / Gojek (2D Tactile Emblem & Tag)
 */
export const GoFoodLogoBadge: React.FC<LogoProps> = ({ className = '' }) => (
  <div className={`inline-flex items-center gap-3 ${className}`}>
    <div className="w-10 h-10 rounded-xl bg-[#00AA13] fx-2d-icon-gojek flex items-center justify-center shrink-0">
      <svg
        viewBox="0 0 32 32"
        className="w-6 h-6"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M16 6C10.477 6 6 10.477 6 16C6 19.65 7.956 22.842 10.88 24.588L12.71 21.52C10.81 20.388 9.54 18.338 9.54 16C9.54 12.432 12.432 9.54 16 9.54C19.568 9.54 22.46 12.432 22.46 16C22.46 18.338 21.19 20.388 19.29 21.52L21.12 24.588C24.044 22.842 26 19.65 26 16C26 10.477 21.523 6 16 6Z"
          fill="#FFFFFF"
        />
        <circle cx="16" cy="16" r="3.4" fill="#FFFFFF" />
      </svg>
    </div>
    <div className="leading-tight text-left">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold tracking-tight text-[#30251F]">gojek</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EE2737] text-white tracking-wide fx-2d-badge-pill">
          gofood
        </span>
      </div>
      <div className="text-xs text-[#6E5D53] mt-0.5">
        Mitra Pengantaran Resmi
      </div>
    </div>
  </div>
);

/**
 * Logo Resmi Maxim (2D Tactile Emblem & Tag)
 */
export const MaximLogoBadge: React.FC<LogoProps> = ({ className = '' }) => (
  <div className={`inline-flex items-center gap-3 ${className}`}>
    <div className="w-10 h-10 rounded-xl bg-[#FFCC00] fx-2d-icon-maxim flex items-center justify-center shrink-0">
      <svg
        viewBox="0 0 32 32"
        className="w-6 h-6"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M6 22L9.2 10H13.6L15.4 16.6L19.4 10H24.2L21 22H17.2L19.1 14.9L14.9 22H12.2L10.7 15.1L8.9 22H6Z"
          fill="#111111"
        />
        <circle cx="24.5" cy="20.2" r="2" fill="#DC2626" />
      </svg>
    </div>
    <div className="leading-tight text-left">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold italic tracking-tight text-[#30251F]">
          maxim
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F3EDE0] text-[#30251F] fx-2d-badge-pill">
          Delivery
        </span>
      </div>
      <div className="text-xs text-[#6E5D53] mt-0.5">
        Layanan Antar Pinrang
      </div>
    </div>
  </div>
);
