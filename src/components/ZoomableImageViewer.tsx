import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface ZoomableImageViewerProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  stageBgClassName?: string;
  minScale?: number;
  maxScale?: number;
  showControls?: boolean;
  onZoomStateChange?: (isZoomed: boolean) => void;
}

interface Point {
  x: number;
  y: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function getTouchDistance(t1: React.Touch, t2: React.Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
}

/**
 * Smooth, solid, non-flickering interactive zoom & pan viewer for Lightboxes.
 * - Uses direct RAF-backed DOM transform during pinch/drag for 60fps fluidity
 * - Never applies backface-visibility:hidden clipping that causes disappearing/see-through bugs
 * - Clamps pan bounds so images can never vanish off-screen
 */
export const ZoomableImageViewer: React.FC<ZoomableImageViewerProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  stageBgClassName = 'bg-[#083B28]',
  minScale = 1,
  maxScale = 4,
  showControls = true,
  onZoomStateChange,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const transformLayerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const scaleRef = useRef<number>(1);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  const isPinchingRef = useRef<boolean>(false);
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(1);

  const isDraggingRef = useRef<boolean>(false);
  const dragStartPointerRef = useRef<Point>({ x: 0, y: 0 });
  const dragStartOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const lastTapTimeRef = useRef<number>(0);

  const [displayScale, setDisplayScale] = useState<number>(1);
  const [isDraggingUI, setIsDraggingUI] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  const clampOffset = useCallback((nextOffset: Point, scale: number): Point => {
    if (scale <= 1.01) {
      return { x: 0, y: 0 };
    }
    const vp = viewportRef.current;
    if (!vp) return nextOffset;
    const maxX = ((scale - 1) * vp.clientWidth) / 2;
    const maxY = ((scale - 1) * vp.clientHeight) / 2;
    return {
      x: clamp(nextOffset.x, -maxX, maxX),
      y: clamp(nextOffset.y, -maxY, maxY),
    };
  }, []);

  const applyTransformNow = useCallback((animate = false) => {
    const el = transformLayerRef.current;
    if (!el) return;
    const s = scaleRef.current;
    const { x, y } = offsetRef.current;
    el.style.transition = animate
      ? 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)'
      : 'none';
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
  }, []);

  const scheduleTransform = useCallback(
    (animate = false) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        applyTransformNow(animate);
      });
    },
    [applyTransformNow]
  );

  const commitScaleAndOffset = useCallback(
    (nextScale: number, nextOffset: Point, animate = false) => {
      const boundedScale = clamp(nextScale, minScale, maxScale);
      const boundedOffset = clampOffset(nextOffset, boundedScale);
      scaleRef.current = boundedScale;
      offsetRef.current = boundedOffset;
      scheduleTransform(animate);
      setDisplayScale(Math.round(boundedScale * 100) / 100);
      onZoomStateChange?.(boundedScale > 1.02);
    },
    [clampOffset, maxScale, minScale, onZoomStateChange, scheduleTransform]
  );

  // Reset zoom cleanly when switching image source
  useEffect(() => {
    const alreadyComplete = Boolean(imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0);
    setIsLoaded(alreadyComplete);
    setRetryCount(0);
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    isPinchingRef.current = false;
    isDraggingRef.current = false;
    setDisplayScale(1);
    setIsDraggingUI(false);
    onZoomStateChange?.(false);
    applyTransformNow(false);
  }, [src, applyTransformNow, onZoomStateChange]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = clamp(scaleRef.current + 0.5, minScale, maxScale);
    commitScaleAndOffset(next, offsetRef.current, true);
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = clamp(scaleRef.current - 0.5, minScale, maxScale);
    commitScaleAndOffset(next, next <= 1.02 ? { x: 0, y: 0 } : offsetRef.current, true);
  };

  const handleResetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    commitScaleAndOffset(1, { x: 0, y: 0 }, true);
  };

  const handleDoubleAction = () => {
    if (scaleRef.current > 1.15) {
      commitScaleAndOffset(1, { x: 0, y: 0 }, true);
    } else {
      commitScaleAndOffset(2.25, { x: 0, y: 0 }, true);
    }
  };

  // Mouse wheel zoom (desktop)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    const next = clamp(scaleRef.current + delta, minScale, maxScale);
    commitScaleAndOffset(next, next <= 1.02 ? { x: 0, y: 0 } : offsetRef.current, false);
  };

  // Mouse drag pan when zoomed
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || scaleRef.current <= 1.02) return;
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    setIsDraggingUI(true);
    dragStartPointerRef.current = { x: e.clientX, y: e.clientY };
    dragStartOffsetRef.current = { ...offsetRef.current };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStartPointerRef.current.x;
    const dy = e.clientY - dragStartPointerRef.current.y;
    const nextOffset = clampOffset(
      {
        x: dragStartOffsetRef.current.x + dx,
        y: dragStartOffsetRef.current.y + dy,
      },
      scaleRef.current
    );
    offsetRef.current = nextOffset;
    scheduleTransform(false);
  };

  const endMouseDrag = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDraggingUI(false);
  };

  // Touch pinch-to-zoom + 1-finger pan when zoomed + double-tap
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      e.stopPropagation();
      isPinchingRef.current = true;
      isDraggingRef.current = false;
      pinchStartDistRef.current = getTouchDistance(e.touches[0], e.touches[1]);
      pinchStartScaleRef.current = scaleRef.current;
      onZoomStateChange?.(true);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 280) {
        lastTapTimeRef.current = 0;
        e.stopPropagation();
        handleDoubleAction();
        return;
      }
      lastTapTimeRef.current = now;

      if (scaleRef.current > 1.02) {
        e.stopPropagation();
        isDraggingRef.current = true;
        setIsDraggingUI(true);
        dragStartPointerRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        dragStartOffsetRef.current = { ...offsetRef.current };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isPinchingRef.current && e.touches.length === 2) {
      e.stopPropagation();
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      if (pinchStartDistRef.current > 0) {
        const ratio = dist / pinchStartDistRef.current;
        const nextScale = clamp(pinchStartScaleRef.current * ratio, minScale, maxScale);
        const nextOffset = clampOffset(offsetRef.current, nextScale);
        scaleRef.current = nextScale;
        offsetRef.current = nextOffset;
        scheduleTransform(false);
        setDisplayScale(Math.round(nextScale * 100) / 100);
      }
    } else if (isDraggingRef.current && e.touches.length === 1 && scaleRef.current > 1.02) {
      e.stopPropagation();
      const dx = e.touches[0].clientX - dragStartPointerRef.current.x;
      const dy = e.touches[0].clientY - dragStartPointerRef.current.y;
      offsetRef.current = clampOffset(
        {
          x: dragStartOffsetRef.current.x + dx,
          y: dragStartOffsetRef.current.y + dy,
        },
        scaleRef.current
      );
      scheduleTransform(false);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isPinchingRef.current && e.touches.length < 2) {
      isPinchingRef.current = false;
      if (scaleRef.current <= 1.04) {
        commitScaleAndOffset(1, { x: 0, y: 0 }, true);
      } else {
        onZoomStateChange?.(true);
      }
    }
    if (isDraggingRef.current && e.touches.length === 0) {
      isDraggingRef.current = false;
      setIsDraggingUI(false);
    }
  };

  const zoomPercent = Math.round(displayScale * 100);
  const isZoomed = displayScale > 1.02;

  return (
    <div
      ref={viewportRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endMouseDrag}
      onMouseLeave={endMouseDrag}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleDoubleAction();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        touchAction: isZoomed ? 'none' : 'pan-y pinch-zoom',
      }}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none ${stageBgClassName} ${
        isZoomed
          ? isDraggingUI
            ? 'cursor-grabbing'
            : 'cursor-grab'
          : 'cursor-zoom-in'
      } ${className}`}
    >
      <div
        ref={transformLayerRef}
        className="w-full h-full flex items-center justify-center origin-center"
        style={{
          transform: 'translate3d(0px, 0px, 0) scale(1)',
        }}
      >
        <img
          ref={imgRef}
          src={
            retryCount > 0 && src && !src.startsWith('data:')
              ? `${src}${src.includes('?') ? '&' : '?'}hd_v=${retryCount}`
              : src
          }
          alt={alt}
          loading="eager"
          decoding="sync"
          fetchPriority="high"
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            if (retryCount < 2) {
              setRetryCount((prev) => prev + 1);
            } else {
              setIsLoaded(true);
            }
          }}
          className={`block opacity-100 select-none culinary-photo hd-4k-image ${imgClassName}`}
          style={{
            opacity: 1,
            visibility: 'visible',
          }}
        />
      </div>

      {!isLoaded && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="px-3 py-1.5 rounded-full bg-[#23150D] text-[#FFE066] border border-[#F5B700]/40 text-xs font-bold">
            Memuat foto...
          </span>
        </div>
      )}

      {showControls && (
        <div
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-[#12241A]/95 border border-[#D9A52E]/45 rounded-full px-1.5 py-1 shadow-xl backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={displayScale <= minScale + 0.01}
            aria-label="Perkecil gambar"
            title="Perkecil"
            className="w-7 h-7 rounded-full bg-[#193D2B] hover:bg-[#D9A52E] disabled:opacity-35 text-[#E8C56E] hover:text-[#193D2B] flex items-center justify-center cursor-pointer disabled:cursor-default transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="px-1.5 text-[11px] font-mono-tabular font-bold text-[#E8C56E] min-w-[44px] text-center">
            {zoomPercent}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={displayScale >= maxScale - 0.01}
            aria-label="Perbesar gambar"
            title="Perbesar"
            className="w-7 h-7 rounded-full bg-[#193D2B] hover:bg-[#D9A52E] disabled:opacity-35 text-[#E8C56E] hover:text-[#193D2B] flex items-center justify-center cursor-pointer disabled:cursor-default transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {isZoomed && (
            <button
              type="button"
              onClick={handleResetZoom}
              aria-label="Reset zoom ke 100%"
              title="Reset 100%"
              className="w-7 h-7 rounded-full bg-[#A83A2D] hover:bg-[#8C2D22] text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
