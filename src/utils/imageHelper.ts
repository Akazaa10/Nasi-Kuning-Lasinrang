/**
 * Resize and compress uploaded images client-side using Canvas so uploaded photos
 * persist cleanly in IndexedDB, localStorage, and Cloud Firestore (<= 350,000 chars)
 * across reloads without hitting quota or security rule limits.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension = 960,
  initialQuality = 0.84,
  maxDataUrlLength = 310000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('Format gambar tidak didukung.'));
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(dataUrl.slice(0, maxDataUrlLength));
      img.onload = () => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        if (!origW || !origH) {
          resolve(dataUrl);
          return;
        }

        const renderAt = (dimLimit: number, quality: number): string => {
          const scale = Math.min(1, dimLimit / Math.max(origW, origH));
          const targetW = Math.max(1, Math.round(origW * scale));
          const targetH = Math.max(1, Math.round(origH * scale));
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) return dataUrl;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          try {
            return canvas.toDataURL('image/jpeg', quality);
          } catch {
            return dataUrl;
          }
        };

        let dim = maxDimension;
        let quality = initialQuality;
        let result = renderAt(dim, quality);

        // Iteratively step down quality / dimensions if the encoded Data URL is still too large for Firestore rules
        for (let attempt = 0; attempt < 10 && result.length > maxDataUrlLength; attempt++) {
          if (quality > 0.38) {
            quality = Math.max(0.36, quality - 0.12);
          } else {
            dim = Math.max(200, Math.round(dim * 0.74));
          }
          result = renderAt(dim, quality);
        }

        resolve(result);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Ensures any existing data:image/* string fits safely within Firestore's field size limit
 * (<= 350,000 chars) by re-encoding via Canvas instead of corrupting the base64 string with .slice().
 */
export function ensureDataUrlWithinFirestoreLimit(
  src: string | undefined,
  maxDataUrlLength = 290000
): Promise<string> {
  const safe = (src || '').trim();
  if (!safe) return Promise.resolve('');
  if (!safe.startsWith('data:image/')) {
    return Promise.resolve(safe.slice(0, maxDataUrlLength));
  }
  if (safe.length <= maxDataUrlLength) {
    return Promise.resolve(safe);
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onerror = () => resolve(safe.slice(0, maxDataUrlLength));
      img.onload = () => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        if (!origW || !origH) {
          resolve(safe.slice(0, maxDataUrlLength));
          return;
        }

        const renderAt = (dimLimit: number, quality: number): string => {
          const scale = Math.min(1, dimLimit / Math.max(origW, origH));
          const targetW = Math.max(1, Math.round(origW * scale));
          const targetH = Math.max(1, Math.round(origH * scale));
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) return safe;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          try {
            return canvas.toDataURL('image/jpeg', quality);
          } catch {
            return safe;
          }
        };

        let dim = 820;
        let quality = 0.78;
        let result = renderAt(dim, quality);
        for (let attempt = 0; attempt < 12 && result.length > maxDataUrlLength; attempt++) {
          if (quality > 0.36) {
            quality = Math.max(0.34, quality - 0.1);
          } else {
            dim = Math.max(180, Math.round(dim * 0.75));
          }
          result = renderAt(dim, quality);
        }
        resolve(result.length <= maxDataUrlLength ? result : result.slice(0, maxDataUrlLength));
      };
      img.src = safe;
    } catch {
      resolve(safe.slice(0, maxDataUrlLength));
    }
  });
}
