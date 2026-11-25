import React from 'react';

interface OrnamentProps {
  className?: string;
}

/**
 * Ornamen Daun Pisang & Sulur Batik Bugis — Halus & Modern Nusantara
 */
export const BananaLeafOrnament: React.FC<OrnamentProps> = ({ className = 'w-48 h-48' }) => (
  <svg
    viewBox="0 0 220 220"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M110 24L196 110L110 196L24 110Z"
      stroke="#D9A52E"
      strokeOpacity="0.22"
      strokeWidth="1.2"
      strokeDasharray="4 4"
    />
    <path
      d="M28 192C50 132 106 68 192 28C168 106 114 166 28 192Z"
      fill="#193D2B"
      fillOpacity="0.08"
      stroke="#193D2B"
      strokeOpacity="0.24"
      strokeWidth="1.5"
    />
    <path
      d="M28 192C84 134 132 86 192 28"
      stroke="#193D2B"
      strokeOpacity="0.30"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M68 152L58 118M94 126L82 88M122 98L112 64M148 72L142 46"
      stroke="#193D2B"
      strokeOpacity="0.20"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <path
      d="M72 148L108 156M98 122L136 128M126 94L158 98"
      stroke="#193D2B"
      strokeOpacity="0.20"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <circle cx="150" cy="144" r="2.2" fill="#A83A2D" fillOpacity="0.28" />
    <circle cx="160" cy="134" r="1.8" fill="#D9A52E" fillOpacity="0.36" />
    <circle cx="140" cy="154" r="1.8" fill="#D9A52E" fillOpacity="0.36" />
  </svg>
);

/**
 * Ornamen Batik Sulappa Eppa & Rempah Kunyit Cabai
 */
export const SpiceBotanicalOrnament: React.FC<OrnamentProps> = ({ className = 'w-40 h-40' }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M90 16L164 90L90 164L16 90Z"
      fill="#D9A52E"
      fillOpacity="0.06"
      stroke="#D9A52E"
      strokeOpacity="0.26"
      strokeWidth="1.2"
    />
    <path
      d="M126 42C132 68 122 104 94 128C78 142 58 146 48 140C66 126 88 104 102 68C107 55 114 44 126 42Z"
      fill="#A83A2D"
      fillOpacity="0.10"
      stroke="#A83A2D"
      strokeOpacity="0.26"
      strokeWidth="1.4"
    />
    <path
      d="M124 42C127 32 135 26 144 26"
      stroke="#193D2B"
      strokeOpacity="0.32"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="58"
      cy="68"
      r="22"
      fill="#D9A52E"
      fillOpacity="0.10"
      stroke="#D9A52E"
      strokeOpacity="0.32"
      strokeWidth="1.3"
    />
    <path
      d="M58 51L75 68L58 85L41 68Z"
      stroke="#30251F"
      strokeOpacity="0.20"
      strokeWidth="1.1"
    />
    <circle cx="90" cy="24" r="2" fill="#A83A2D" fillOpacity="0.28" />
    <circle cx="90" cy="156" r="2" fill="#A83A2D" fillOpacity="0.28" />
  </svg>
);

/**
 * Ornamen Tenun & Batik Lipa Sabbe Bugis
 */
export const BugisWovenAccent: React.FC<OrnamentProps> = ({ className = 'w-48 h-24' }) => (
  <svg
    viewBox="0 0 240 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M8 84L24 68L40 84L56 68L72 84L88 68L104 84L120 68L136 84L152 68L168 84L184 68L200 84L216 68L232 84"
      stroke="#A83A2D"
      strokeOpacity="0.22"
      strokeWidth="1.2"
    />
    <path
      d="M12 44L36 20L60 44L36 68L12 44ZM68 44L92 20L116 44L92 68L68 44ZM124 44L148 20L172 44L148 68L124 44ZM180 44L204 20L228 44L204 68L180 44Z"
      stroke="#D9A52E"
      strokeOpacity="0.34"
      strokeWidth="1.3"
    />
    <circle cx="36" cy="44" r="3.5" fill="#A83A2D" fillOpacity="0.26" />
    <circle cx="92" cy="44" r="3.5" fill="#193D2B" fillOpacity="0.26" />
    <circle cx="148" cy="44" r="3.5" fill="#D9A52E" fillOpacity="0.34" />
    <circle cx="204" cy="44" r="3.5" fill="#193D2B" fillOpacity="0.26" />
  </svg>
);

/**
 * Pembatas Garis Minimalis Motif Sulappa Eppa Bugis — Halus & Editorial
 */
export const NusantaraSectionDivider: React.FC<OrnamentProps> = ({ className = '' }) => (
  <div className={`flex items-center justify-center gap-4 ${className}`} aria-hidden="true">
    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#30251F]/15 to-[#D9A52E]/55" />
    <svg
      viewBox="0 0 72 16"
      className="w-16 h-4 shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6 8L12 3L18 8L12 13L6 8Z" stroke="#193D2B" strokeOpacity="0.38" strokeWidth="1.2" />
      <path
        d="M36 2L43 8L36 14L29 8L36 2Z"
        fill="#D9A52E"
        fillOpacity="0.22"
        stroke="#D9A52E"
        strokeOpacity="0.85"
        strokeWidth="1.2"
      />
      <circle cx="36" cy="8" r="1.8" fill="#193D2B" />
      <path d="M54 8L60 3L66 8L60 13L54 8Z" stroke="#193D2B" strokeOpacity="0.38" strokeWidth="1.2" />
    </svg>
    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#30251F]/15 to-[#D9A52E]/55" />
  </div>
);

/**
 * Emblem Minimalis Mangkuk Nasi Kuning & Uap Hangat
 */
export const NasiKuningEmblem: React.FC<OrnamentProps> = ({ className = 'w-8 h-8' }) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M8 18C8 12.5 12.5 9 18 9C23.5 9 28 12.5 28 18"
      fill="#D9A52E"
      fillOpacity="0.32"
      stroke="#9A7013"
      strokeWidth="1.5"
    />
    <path
      d="M5 18H31C30.4 24.4 25 28.5 18 28.5C11 28.5 5.6 24.4 5 18Z"
      fill="#193D2B"
      fillOpacity="0.16"
      stroke="#30251F"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M13 28.5H23" stroke="#30251F" strokeWidth="1.6" strokeLinecap="round" />
    <path
      d="M15 6C15 4.8 16 4 16 3M19 6C19 4.8 20 4 20 3"
      stroke="#A83A2D"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);
