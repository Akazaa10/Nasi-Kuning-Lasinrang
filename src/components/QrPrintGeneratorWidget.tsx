import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Check,
  RotateCcw,
  Printer,
  Globe,
  ExternalLink,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { StoreConfig } from '../types';
import { safeCopyToClipboard } from '../utils/safeBrowser';

const OFFICIAL_LOGO_URL = '/assets/aistudio/file_000000004bd48211a316832fba565d37_46611b00.png';
const QR_CUSTOM_URL_KEY = 'nkl_qr_custom_url_v1';

interface QrPrintGeneratorWidgetProps {
  storeConfig: StoreConfig;
  cloudCustomUrl?: string;
  onSaveCloudCustomUrl?: (url: string) => void;
}

function getLiveWebsiteUrl(): string {
  if (typeof window === 'undefined') return 'https://nasikuninglasinrang.id';
  const cleanPath =
    window.location.pathname && window.location.pathname !== '/'
      ? window.location.pathname.replace(/\/$/, '')
      : '';
  return `${window.location.origin}${cleanPath}`;
}

function getSuggestedPublishedUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.startsWith('ais-dev-')) {
      u.hostname = u.hostname.replace(/^ais-dev-/, 'ais-pre-');
      return u.toString().replace(/\/$/, '');
    }
  } catch {
    // ignore invalid URL
  }
  return null;
}

function isDevOrLocalUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return (
      u.hostname.startsWith('ais-dev-') ||
      u.hostname === 'localhost' ||
      u.hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

function loadLogoImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export const QrPrintGeneratorWidget: React.FC<QrPrintGeneratorWidgetProps> = ({
  storeConfig,
  cloudCustomUrl,
  onSaveCloudCustomUrl,
}) => {
  const [liveUrl, setLiveUrl] = useState<string>(() => {
    if (cloudCustomUrl && cloudCustomUrl.trim()) return cloudCustomUrl.trim();
    try {
      const saved = localStorage.getItem(QR_CUSTOM_URL_KEY);
      if (saved && saved.trim()) return saved.trim();
    } catch {
      // ignore
    }
    return getLiveWebsiteUrl();
  });
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (cloudCustomUrl && cloudCustomUrl.trim()) {
      setLiveUrl(cloudCustomUrl.trim());
    }
  }, [cloudCustomUrl]);

  const effectiveUrl = liveUrl.trim() || getLiveWebsiteUrl();
  const isPreviewOrLocal = isDevOrLocalUrl(effectiveUrl);
  const suggestedPublishedUrl = getSuggestedPublishedUrl(effectiveUrl);

  const handleUpdateLiveUrl = (nextUrl: string) => {
    setLiveUrl(nextUrl);
    const trimmed = nextUrl.trim();
    try {
      const detected = getLiveWebsiteUrl();
      if (!trimmed || trimmed === detected) {
        localStorage.removeItem(QR_CUSTOM_URL_KEY);
      } else {
        localStorage.setItem(QR_CUSTOM_URL_KEY, trimmed);
      }
    } catch {
      // ignore
    }
    onSaveCloudCustomUrl?.(trimmed);
  };

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    try {
      const qr = QRCode.create(effectiveUrl, {
        errorCorrectionLevel: 'H',
      });
      setQrError(null);

      const moduleCount = qr.modules.size;
      const quietZone = 4;
      const totalModules = moduleCount + quietZone * 2;
      const scale = 12;
      const size = totalModules * scale;

      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = '#000000';
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.modules.get(row, col)) {
            ctx.fillRect(
              (col + quietZone) * scale,
              (row + quietZone) * scale,
              scale,
              scale
            );
          }
        }
      }
    } catch {
      setQrError('URL terlalu panjang atau tidak valid untuk QR Code Level H. Persingkat URL atau klik Reset URL Live.');
    }
  }, [effectiveUrl]);

  const drawPrintReadyPosterCanvas = async (): Promise<HTMLCanvasElement> => {
    const width = 2400;
    const height = 2960;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = '#F7F3E9';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#D9A52E';
    ctx.lineWidth = 20;
    ctx.strokeRect(70, 70, width - 140, height - 140);

    ctx.strokeStyle = '#193D2B';
    ctx.lineWidth = 5;
    ctx.strokeRect(102, 102, width - 204, height - 204);

    // Header band in Architectural Forest Green (#193D2B)
    ctx.fillStyle = '#193D2B';
    ctx.fillRect(104, 104, width - 208, 410);

    // Subtle Turmeric Gold accent bar under header
    ctx.fillStyle = '#D9A52E';
    ctx.fillRect(104, 514, width - 208, 22);

    // Draw Official Circular Logo in Top Left/Center Lockup if loaded
    const logoImg = await loadLogoImage(OFFICIAL_LOGO_URL);
    const hasLogo = Boolean(logoImg);
    if (logoImg) {
      const logoSize = 270;
      const logoX = 210;
      const logoY = 174;
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 12, 0, Math.PI * 2);
      ctx.fillStyle = '#D9A52E';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(logoX, logoY, logoSize, logoSize);
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      ctx.restore();
    }

    const textCenterX = hasLogo ? width / 2 + 135 : width / 2;
    const headerTextMaxW = hasLogo ? width - 740 : width - 320;

    ctx.fillStyle = '#E8C56E';
    ctx.font = 'bold 88px Georgia, "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(storeConfig.brandName.toUpperCase(), textCenterX, 255, headerTextMaxW);

    ctx.fillStyle = '#F7F3E9';
    ctx.font = '600 34px "Plus Jakarta Sans", Arial, sans-serif';
    const posterSub = (storeConfig.pickupCoordinatesText || storeConfig.locationAddress || 'PINRANG').toUpperCase();
    ctx.fillText(
      posterSub.length > 56 ? `${posterSub.slice(0, 53)}...` : posterSub,
      textCenterX,
      362,
      headerTextMaxW
    );

    const qr = QRCode.create(effectiveUrl, {
      errorCorrectionLevel: 'H',
    });
    const moduleCount = qr.modules.size;
    const targetQrBox = 1600;
    const moduleSize = Math.floor(targetQrBox / moduleCount);
    const actualQrSize = moduleSize * moduleCount;
    const qrStartX = Math.floor((width - actualQrSize) / 2);
    const qrStartY = 630;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrStartX - 60, qrStartY - 60, actualQrSize + 120, actualQrSize + 120);

    ctx.fillStyle = '#000000';
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.modules.get(row, col)) {
          ctx.fillRect(
            qrStartX + col * moduleSize,
            qrStartY + row * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }

    const ctaTopY = qrStartY + actualQrSize + 120;

    const footerTextMaxW = width - 280;

    ctx.fillStyle = '#193D2B';
    ctx.font = 'bold 62px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText('SCAN UNTUK LIHAT MENU & PESAN ONLINE', width / 2, ctaTopY, footerTextMaxW);

    ctx.fillStyle = '#9A7013';
    ctx.font = 'bold 38px "JetBrains Mono", monospace';
    const displayUrl =
      effectiveUrl.length > 68 ? `${effectiveUrl.slice(0, 65)}...` : effectiveUrl;
    ctx.fillText(displayUrl, width / 2, ctaTopY + 92, footerTextMaxW);

    ctx.fillStyle = '#4A3C34';
    ctx.font = '600 36px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(
      `${storeConfig.operatingHours}  •  Order WA: ${storeConfig.whatsappDisplay}`,
      width / 2,
      ctaTopY + 175,
      footerTextMaxW
    );

    return canvas;
  };

  const drawPureQrCanvas = (): HTMLCanvasElement => {
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    const qr = QRCode.create(effectiveUrl, {
      errorCorrectionLevel: 'H',
    });
    const moduleCount = qr.modules.size;
    const quietModules = 4;
    const totalModules = moduleCount + quietModules * 2;
    const moduleSize = Math.floor(size / totalModules);
    const totalDrawSize = moduleSize * moduleCount;
    const offset = Math.floor((size - totalDrawSize) / 2);

    ctx.fillStyle = '#000000';
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.modules.get(row, col)) {
          ctx.fillRect(
            offset + col * moduleSize,
            offset + row * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }

    return canvas;
  };

  const triggerPngDownload = (canvas: HTMLCanvasElement, filename: string, msg: string) => {
    const finishDownload = (href: string, revoke?: () => void) => {
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (revoke) setTimeout(revoke, 1000);
      setDownloadStatus(msg);
      setTimeout(() => setDownloadStatus(null), 3500);
    };

    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          finishDownload(url, () => URL.revokeObjectURL(url));
        } else {
          finishDownload(canvas.toDataURL('image/png'));
        }
      }, 'image/png');
    } else {
      finishDownload(canvas.toDataURL('image/png'));
    }
  };

  const handleDownloadPosterQr = async () => {
    try {
      const canvas = await drawPrintReadyPosterCanvas();
      triggerPngDownload(
        canvas,
        'QR-Siap-Cetak-Nasi-Kuning-Lasinrang.png',
        'File PNG Siap Cetak (2400×2960 px) berhasil diunduh!'
      );
    } catch {
      setQrError('Gagal membuat poster QR. Pastikan URL tidak terlalu panjang lalu coba lagi.');
    }
  };

  const handleDownloadPureQr = () => {
    try {
      const canvas = drawPureQrCanvas();
      triggerPngDownload(
        canvas,
        'QR-Polos-HD-Nasi-Kuning-Lasinrang.png',
        'QR Polos HD (2048×2048 px) berhasil diunduh!'
      );
    } catch {
      setQrError('Gagal membuat QR polos. Pastikan URL tidak terlalu panjang lalu coba lagi.');
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#30251F]/12 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#30251F]/10 pb-3">
        <div>
          <h4 className="text-base font-bold text-[#193D2B] font-serif-display flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#9A7013]" />
            <span>Generator QR Code Siap Cetak</span>
          </h4>
          <p className="text-xs text-[#6E5D53] mt-0.5">
            Otomatis membaca URL live website saat ini · Resolusi tinggi siap cetak untuk baliho, spanduk, & stiker kemasan.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-[#193D2B] text-xs font-bold self-start sm:self-auto shrink-0">
          <Printer className="w-3.5 h-3.5 text-[#9A7013]" />
          <span>HD Print Ready PNG</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Clean & Sharp Barcode Preview Card Matched to Luxury Brand Identity */}
        <div className="md:col-span-5 flex justify-center">
          <div className="w-full max-w-[260px] bg-white rounded-2xl p-4 border-2 border-[#D9A52E] shadow-md text-center space-y-2.5">
            <div className="bg-[#193D2B] text-[#E8C56E] rounded-xl py-2 px-3 flex items-center gap-2 text-left border-b-2 border-[#D9A52E]">
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Logo Nasi Kuning Lasinrang"
                loading="lazy"
                decoding="async"
                draggable={false}
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                }}
                className="w-8 h-8 rounded-full object-contain bg-white ring-1 ring-[#D9A52E] shrink-0"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-bold font-serif-display tracking-wide truncate">
                  {storeConfig.brandName.toUpperCase()}
                </div>
                <div className="text-[9px] text-[#F7F3E9]/90 tracking-wider truncate">
                  {storeConfig.tagline}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center bg-white p-1">
              <canvas
                ref={previewCanvasRef}
                aria-label="Pratinjau QR Code Website Nasi Kuning Lasinrang"
                className="w-44 h-44 sm:w-48 sm:h-48"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>

            <div className="pt-1 border-t border-[#30251F]/10 space-y-0.5">
              <div className="text-[11px] font-extrabold text-[#193D2B] tracking-tight">
                SCAN MENU & PESAN ONLINE
              </div>
              <div className="text-[9px] font-mono text-[#9A7013] truncate px-1 font-semibold">
                {effectiveUrl}
              </div>
            </div>
          </div>
        </div>

        {/* Live URL & Print Download Controls */}
        <div className="md:col-span-7 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="live-qr-url-input"
                className="text-xs font-semibold text-[#30251F] flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5 text-[#193D2B]" />
                <span>URL Live Website Otomatis</span>
              </label>
              <button
                type="button"
                onClick={() => handleUpdateLiveUrl(getLiveWebsiteUrl())}
                className="text-[11px] text-[#A83A2D] hover:text-[#8C2D22] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset URL Live</span>
              </button>
            </div>
            <input
              id="live-qr-url-input"
              type="url"
              value={liveUrl}
              onChange={(e) => handleUpdateLiveUrl(e.target.value)}
              className="w-full bg-[#F7F3E9] border border-[#30251F]/18 focus:border-[#193D2B] rounded-xl px-3.5 py-2.5 text-xs font-mono-tabular text-[#30251F] focus:outline-none"
            />
            {isPreviewOrLocal ? (
              <div className="p-2.5 rounded-xl bg-[#F7F3E9] border border-[#D9A52E]/50 text-[#30251F] text-[11px] space-y-1.5">
                <div className="flex items-start gap-1.5 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#9A7013] shrink-0 mt-0.5" />
                  <span>
                    URL ini masih mode preview/lokal. Sebelum mencetak baliho, gunakan URL Publish publik agar semua HP pelanggan langsung masuk ke menu tanpa login.
                  </span>
                </div>
                {suggestedPublishedUrl && (
                  <button
                    type="button"
                    onClick={() => handleUpdateLiveUrl(suggestedPublishedUrl)}
                    className="px-2.5 py-1 rounded-lg bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] font-bold text-[10.5px] cursor-pointer"
                  >
                    Pakai URL Publish Publik ({suggestedPublishedUrl})
                  </button>
                )}
              </div>
            ) : (
              <div className="px-2.5 py-1.5 rounded-lg bg-[#E9F0EC] border border-[#193D2B]/20 text-[#193D2B] text-[11px] font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>URL Publish Publik Terdeteksi — Siap Pindai di Semua Kamera HP!</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <a
                href={effectiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#EFE9DC] border border-[#30251F]/16 text-[#30251F] text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3 h-3 text-[#193D2B]" />
                <span>Uji Buka Link Barcode</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  void safeCopyToClipboard(effectiveUrl);
                  setCopiedUrl(true);
                  setTimeout(() => setCopiedUrl(false), 2200);
                }}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#EFE9DC] border border-[#30251F]/16 text-[#30251F] text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3 h-3 text-[#193D2B]" />
                    <span className="text-[#193D2B]">Link Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-[#6E5D53]" />
                    <span>Salin URL Barcode</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-[#6E5D53] leading-relaxed">
              Barcode menggunakan koreksi kesalahan tingkat tinggi (Level H 30%) dan quiet zone 4 modul agar tetap cepat terpindai meski ditempel di baliho luar ruangan atau stiker kotak makanan.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleDownloadPosterQr}
              className="w-full py-3.5 px-4 rounded-xl bg-[#D9A52E] hover:bg-[#C69422] text-[#193D2B] font-extrabold text-xs sm:text-sm shadow-sm border border-[#9A7013]/25 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Unduh Barcode Siap Cetak (Untuk Baliho, Spanduk &amp; Stiker)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPureQr}
              className="w-full py-2.5 px-4 rounded-xl bg-[#EFE9DC] hover:bg-[#E4DCCB] border border-[#30251F]/12 text-[#30251F] font-semibold text-xs transition-colors cursor-pointer"
            >
              Unduh QR Polos Saja (2048×2048 px PNG untuk Desain Bebas)
            </button>
          </div>

          {qrError && (
            <div className="px-3.5 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{qrError}</span>
            </div>
          )}

          {downloadStatus && (
            <div className="px-3.5 py-2 rounded-xl bg-[#E9F0EC] border border-[#193D2B]/20 text-[#193D2B] text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{downloadStatus}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
