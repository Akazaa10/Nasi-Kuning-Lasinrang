import React from 'react';

interface IPhone18ProFrameProps {
  children: React.ReactNode;
  className?: string;
}

export const IPhone18ProFrame: React.FC<IPhone18ProFrameProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`iphone-3d-stage relative select-none px-2.5 sm:px-3.5 pb-5 sm:pb-6 ${className}`}>
      {/* Realistic Blur-Free Studio Floor Shadow Pool */}
      <div
        aria-hidden="true"
        className="iphone-3d-shadow-pool pointer-events-none absolute inset-x-4 sm:inset-x-6 bottom-0 h-8 sm:h-10 rounded-full opacity-95"
      />

      {/* Sculpted 3D Brushed Titanium Hardware Body (Pixel-Crisp Orthogonal 4K OLED) */}
      <div className="iphone-3d-body relative">
        {/* Physical Left 3D Metallic Side Buttons (Action + Volume Up + Volume Down) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[4px] sm:-left-[5px] top-[17.5%] w-[4.5px] sm:w-[5.5px] h-6 sm:h-7 rounded-l-[3.5px] border-y border-white/30 bg-gradient-to-r from-[#EFE0C6] via-[#8E7F6E] to-[#3B332C] shadow-[-2px_2px_4px_rgba(0,0,0,0.65)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[4px] sm:-left-[5px] top-[25.5%] w-[4.5px] sm:w-[5.5px] h-10 sm:h-12 rounded-l-[3.5px] border-y border-white/30 bg-gradient-to-r from-[#EFE0C6] via-[#8E7F6E] to-[#3B332C] shadow-[-2px_2px_4px_rgba(0,0,0,0.65)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[4px] sm:-left-[5px] top-[34.5%] w-[4.5px] sm:w-[5.5px] h-10 sm:h-12 rounded-l-[3.5px] border-y border-white/30 bg-gradient-to-r from-[#EFE0C6] via-[#8E7F6E] to-[#3B332C] shadow-[-2px_2px_4px_rgba(0,0,0,0.65)]"
        />

        {/* Physical Right 3D Metallic Side Buttons (Power + Recessed Camera Control) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[4.5px] sm:-right-[5.5px] top-[27.5%] w-[4.5px] sm:w-[5.5px] h-14 sm:h-16 rounded-r-[3.5px] border-y border-white/25 bg-gradient-to-l from-[#E6D4B8] via-[#7A6D60] to-[#302923] shadow-[2px_3px_5px_rgba(0,0,0,0.68)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[4px] sm:-right-[5px] top-[52.5%] w-[3.5px] sm:w-[4.5px] h-9 sm:h-11 rounded-r-[3.5px] border-y border-[#FFD24C]/35 bg-gradient-to-l from-[#CDBAA1] via-[#5F544A] to-[#26201B] shadow-[2px_3px_5px_rgba(0,0,0,0.68)]"
        />

        {/* Outer Brushed Titanium 3D Unibody Chassis (iPhone 18 Pro) */}
        <div className="iphone-3d-chassis relative rounded-[42px] sm:rounded-[52px] p-[5px] sm:p-[6px]">
          {/* Chamfered Metallic Antenna Break Bands */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-14 -left-[0.5px] w-[5px] h-[2.5px] bg-[#1F1A17]/80"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-14 -right-[0.5px] w-[5px] h-[2.5px] bg-[#1F1A17]/80"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-14 -left-[0.5px] w-[5px] h-[2.5px] bg-[#1F1A17]/80"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-14 -right-[0.5px] w-[5px] h-[2.5px] bg-[#1F1A17]/80"
          />

          {/* Inner Glossy Ceramic Shield Bezel */}
          <div className="iphone-3d-bezel relative rounded-[37px] sm:rounded-[47px] p-[5.5px] sm:p-[7px]">
            {/* Top CNC Micro Earpiece Grille */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-[2px] sm:top-[2.5px] left-1/2 -translate-x-1/2 w-10 sm:w-12 h-[2px] rounded-full bg-[#24201D] shadow-[inset_0_1px_1px_rgba(0,0,0,0.95)]"
            />

            {/* Super Retina XDR OLED Full-Screen Viewport (9:19.5) */}
            <div className="relative w-full aspect-[9/19.5] rounded-[32px] sm:rounded-[40px] overflow-hidden bg-[#063825] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              {/* Full-Screen Live Tutorial Content */}
              {children}

              {/* Top iOS Status Bar + Compact 3D Dynamic Island Overlay */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3.5 sm:px-5 pt-2 sm:pt-2.5 flex items-center justify-between text-[10px] sm:text-[11px] font-bold tracking-tight text-[#FFFDF9]"
              >
                <span className="w-10 sm:w-11 text-center tabular-nums drop-shadow-sm">
                  9:41
                </span>

                {/* Sleek iPhone 18 Pro Compact 3D Dynamic Island with Multi-Lens Sapphire Optics */}
                <div className="relative w-[76px] sm:w-[96px] h-[19px] sm:h-[22px] rounded-full bg-gradient-to-b from-[#121215] via-[#040405] to-[#010101] border border-white/15 shadow-[0_3px_10px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.18)] flex items-center justify-between px-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#101828] ring-1 ring-white/10" />
                  <span className="relative w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-[radial-gradient(circle_at_32%_32%,#5B8CFF_0%,#1D397A_48%,#070C1A_100%)] ring-1 ring-white/25 shadow-inner flex items-center justify-center">
                    <span className="w-[3px] h-[3px] rounded-full bg-white/80 -translate-x-[1px] -translate-y-[1px]" />
                  </span>
                </div>

                {/* Clean Minimal Cellular + 5G + Battery */}
                <div className="w-10 sm:w-11 flex items-center justify-end gap-1 drop-shadow-sm">
                  <svg
                    viewBox="0 0 18 12"
                    className="w-3 sm:w-3.5 h-2 sm:h-2.5 fill-current"
                  >
                    <rect x="0" y="7" width="2.5" height="5" rx="0.8" />
                    <rect x="4" y="5" width="2.5" height="7" rx="0.8" />
                    <rect x="8" y="2.5" width="2.5" height="9.5" rx="0.8" />
                    <rect x="12" y="0" width="2.5" height="12" rx="0.8" />
                  </svg>
                  <div className="w-4 sm:w-5 h-2 sm:h-2.5 rounded-[3px] border border-white/85 p-[1.5px] flex items-center">
                    <div className="w-full h-full rounded-[1px] bg-white" />
                  </div>
                </div>
              </div>

              {/* Subtle Corner Edge Specular Rim (Zero Center Screen Contrast Loss) */}
              <div
                aria-hidden="true"
                className="iphone-3d-glass-reflection pointer-events-none absolute inset-0 z-10 rounded-[32px] sm:rounded-[40px] ring-1 ring-inset ring-white/15"
              />

              {/* Bottom iOS Home Indicator */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-1 sm:bottom-1.5 z-20 flex justify-center"
              >
                <div className="w-24 sm:w-32 h-1 rounded-full bg-white/80 shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
