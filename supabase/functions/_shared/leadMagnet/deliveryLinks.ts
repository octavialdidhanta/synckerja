/** Delivery multi-link helpers for Lead Magnet edge runtime. */

export const LEAD_MAGNET_MAX_DELIVERY_LINKS = 3;
export const LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS = 20;
export const DEFAULT_DELIVERY_LINK_LABEL = "Kirim link-nya 😊";

export type LeadMagnetDeliveryLink = {
  label: string;
  url: string;
};

export function isValidHttpsDeliveryUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://")) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function truncateDeliveryButtonLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS) return trimmed;
  return trimmed.slice(0, LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS);
}

export function normalizeDeliveryLinks(raw: unknown): LeadMagnetDeliveryLink[] {
  if (!Array.isArray(raw)) return [];
  const out: LeadMagnetDeliveryLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = truncateDeliveryButtonLabel(String(row.label ?? ""));
    const url = String(row.url ?? "").trim();
    if (!label && !url) continue;
    out.push({ label, url });
    if (out.length >= LEAD_MAGNET_MAX_DELIVERY_LINKS) break;
  }
  return out;
}

export function resolveCampaignDeliveryLinks(campaign: {
  delivery_links?: unknown;
  delivery_button_label?: string | null;
  delivery_url?: string | null;
}): LeadMagnetDeliveryLink[] {
  const fromJson = normalizeDeliveryLinks(campaign.delivery_links);
  if (fromJson.length > 0) return fromJson;
  const label = truncateDeliveryButtonLabel(
    String(campaign.delivery_button_label ?? "").trim() || DEFAULT_DELIVERY_LINK_LABEL,
  );
  const url = String(campaign.delivery_url ?? "").trim();
  if (!url) return [];
  return [{ label, url }];
}

export function mirrorDeliveryFieldsFromLinks(links: LeadMagnetDeliveryLink[]): {
  delivery_url: string;
  delivery_button_label: string;
} {
  const first = links[0];
  return {
    delivery_url: first?.url?.trim() ?? "",
    delivery_button_label: first?.label?.trim() || DEFAULT_DELIVERY_LINK_LABEL,
  };
}

/** Returns Indonesian error message for API responses, or null if ok. */
export function validateDeliveryLinksForPublish(
  links: LeadMagnetDeliveryLink[],
): string | null {
  if (links.length === 0) return "Minimal satu link delivery wajib diisi";
  if (links.length > LEAD_MAGNET_MAX_DELIVERY_LINKS) {
    return `Maksimal ${LEAD_MAGNET_MAX_DELIVERY_LINKS} link delivery`;
  }
  for (const link of links) {
    if (!link.label.trim()) return "Label tombol delivery wajib diisi";
    if (link.label.trim().length > LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS) {
      return `Label tombol maksimal ${LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS} karakter`;
    }
    if (!isValidHttpsDeliveryUrl(link.url)) {
      return "Setiap URL delivery harus HTTPS valid";
    }
  }
  return null;
}

export function validateDeliveryLinksLoose(
  links: LeadMagnetDeliveryLink[],
): string | null {
  for (const link of links) {
    if (link.url && !isValidHttpsDeliveryUrl(link.url)) {
      return "Setiap URL delivery harus HTTPS valid";
    }
    if (link.label.trim().length > LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS) {
      return `Label tombol maksimal ${LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS} karakter`;
    }
  }
  return null;
}

export function getDeliveryUrlAtIndex(
  links: LeadMagnetDeliveryLink[],
  index: number,
  fallbackUrl?: string | null,
): string | null {
  if (index >= 0 && index < links.length) {
    const url = links[index]?.url?.trim() ?? "";
    if (url) return url;
  }
  if (index === 0) {
    const fb = String(fallbackUrl ?? "").trim();
    return fb || null;
  }
  return null;
}

export function parseDownloadLinkIndex(raw: string | null | undefined): number {
  if (raw == null || raw === "") return 0;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, LEAD_MAGNET_MAX_DELIVERY_LINKS - 1);
}
