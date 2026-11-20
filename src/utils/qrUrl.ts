export interface NormalizedQrUrl {
  url: string;
  valid: boolean;
  reason?: 'empty' | 'invalid';
  isPrivatePreview: boolean;
  isLocalhost: boolean;
}

const STORAGE_KEY = 'merdo_qr_menu_base_url';

export function isAiStudioPreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.startsWith('ais-dev-') || host.startsWith('ais-pre-');
}

export function isLocalOnlyHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local')
  );
}

export function normalizeMenuQrUrl(rawInput: string): NormalizedQrUrl {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      url: '',
      valid: false,
      reason: 'empty',
      isPrivatePreview: false,
      isLocalhost: false,
    };
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        url: '',
        valid: false,
        reason: 'invalid',
        isPrivatePreview: false,
        isLocalhost: false,
      };
    }

    if (!parsed.hostname || (!parsed.hostname.includes('.') && !isLocalOnlyHost(parsed.hostname))) {
      return {
        url: '',
        valid: false,
        reason: 'invalid',
        isPrivatePreview: false,
        isLocalhost: isLocalOnlyHost(parsed.hostname),
      };
    }

    // Strip internal navigation view params so scanning always opens the customer menu
    parsed.searchParams.delete('view');
    parsed.hash = '';

    // Normalize root path without trailing query artifacts
    const cleanPath = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '');
    const query = parsed.searchParams.toString();
    const finalUrl = `${parsed.origin}${cleanPath}${query ? `?${query}` : ''}`;

    return {
      url: finalUrl,
      valid: true,
      isPrivatePreview: isAiStudioPreviewHost(parsed.hostname),
      isLocalhost: isLocalOnlyHost(parsed.hostname),
    };
  } catch {
    return {
      url: '',
      valid: false,
      reason: 'invalid',
      isPrivatePreview: false,
      isLocalhost: false,
    };
  }
}

export function getInitialQrBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const currentOrigin = window.location.origin;

  try {
    const currentHost = window.location.hostname;
    const isCurrentPublic = !isAiStudioPreviewHost(currentHost) && !isLocalOnlyHost(currentHost);
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const normalizedSaved = normalizeMenuQrUrl(saved);
      if (normalizedSaved.valid) {
        // If the app is now opened on a real public/deployed URL and saved was only a preview/local URL,
        // prefer the real public origin automatically.
        if (
          isCurrentPublic &&
          (normalizedSaved.isPrivatePreview || normalizedSaved.isLocalhost)
        ) {
          return currentOrigin;
        }
        return saved;
      }
    }
  } catch {
    // Ignore storage access errors
  }

  return currentOrigin;
}

export function saveQrBaseUrl(value: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = value.trim();
    if (trimmed) {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}
