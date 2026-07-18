/** Shared delivery link helpers (frontend + mirrored logic in edge API). */

export const LEAD_MAGNET_MAX_DELIVERY_LINKS = 3;
export const LEAD_MAGNET_MAX_BUTTON_LABEL_CHARS = 20;

export type LeadMagnetDeliveryLink = {
  label: string;
  url: string;
};

export const DEFAULT_DELIVERY_LINK_LABEL = 'Kirim link-nya 😊';

export function isValidHttpsDeliveryUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
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
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const label = truncateDeliveryButtonLabel(String(row.label ?? ''));
    const url = String(row.url ?? '').trim();
    if (!label && !url) continue;
    out.push({ label, url });
    if (out.length >= LEAD_MAGNET_MAX_DELIVERY_LINKS) break;
  }
  return out;
}

export function deliveryLinksFromLegacy(args: {
  delivery_button_label?: string | null;
  delivery_url?: string | null;
}): LeadMagnetDeliveryLink[] {
  const label = truncateDeliveryButtonLabel(
    String(args.delivery_button_label ?? '').trim() || DEFAULT_DELIVERY_LINK_LABEL,
  );
  const url = String(args.delivery_url ?? '').trim();
  if (!url && !args.delivery_button_label) return [];
  return [{ label, url }];
}

export function resolveDeliveryLinks(args: {
  delivery_links?: unknown;
  delivery_button_label?: string | null;
  delivery_url?: string | null;
}): LeadMagnetDeliveryLink[] {
  const fromJson = normalizeDeliveryLinks(args.delivery_links);
  if (fromJson.length > 0) return fromJson;
  return deliveryLinksFromLegacy(args);
}

export function mirrorDeliveryFieldsFromLinks(links: LeadMagnetDeliveryLink[]): {
  delivery_url: string;
  delivery_button_label: string;
} {
  const first = links[0];
  return {
    delivery_url: first?.url?.trim() ?? '',
    delivery_button_label: first?.label?.trim() || DEFAULT_DELIVERY_LINK_LABEL,
  };
}

/** Returns i18n error key suffix under leadMagnet.wizard.validation.*, or null if ok. */
export function validateDeliveryLinksForPublish(
  links: LeadMagnetDeliveryLink[],
): string | null {
  if (links.length === 0) return 'deliveryLinkRequired';
  if (links.length > LEAD_MAGNET_MAX_DELIVERY_LINKS) return 'deliveryLinksMax';
  for (const link of links) {
    if (!link.label.trim()) return 'deliveryLinkLabelRequired';
    if (!isValidHttpsDeliveryUrl(link.url)) return 'deliveryUrlHttps';
  }
  return null;
}

export function getDeliveryUrlAtIndex(
  links: LeadMagnetDeliveryLink[],
  index: number,
  fallbackUrl?: string | null,
): string | null {
  if (index >= 0 && index < links.length) {
    const url = links[index]?.url?.trim() ?? '';
    if (url) return url;
  }
  if (index === 0) {
    const fb = String(fallbackUrl ?? '').trim();
    return fb || null;
  }
  return null;
}
