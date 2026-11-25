export async function safeCopyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for restricted iframe/mobile contexts
  }

  try {
    if (typeof document === 'undefined' || !document.body) return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function safeOpenWalletScheme(wallet: 'dana' | 'gopay'): void {
  if (typeof document === 'undefined' || !document.body) return;
  const schemeUrl = wallet === 'dana' ? 'dana://' : 'gopay://';
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.src = schemeUrl;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      try {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      } catch {
        // ignore cleanup errors
      }
    }, 1200);
  } catch {
    // ignore scheme launch restrictions in browser/iframe
  }
}
