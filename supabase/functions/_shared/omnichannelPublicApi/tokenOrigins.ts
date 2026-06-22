const ORIGIN_PATTERN = /^https?:\/\/.+/i;

export function parseAllowedOriginsInput(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((o) => String(o).trim())
    .filter((o) => o.length > 0);
}

function isValidOriginUrl(origin: string): boolean {
  return ORIGIN_PATTERN.test(origin);
}

/** Returns error message or null if valid. */
export function validateSdkAllowedOrigins(origins: string[]): string | null {
  if (origins.length === 0) {
    return "allowed_origins wajib diisi untuk token tipe SDK.";
  }

  for (const origin of origins) {
    if (!isValidOriginUrl(origin)) {
      return `Origin tidak valid: "${origin}". Gunakan format http:// atau https:// (mis. https://toko-anda.com).`;
    }
  }

  return null;
}
