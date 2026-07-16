export const LEAD_MAGNET_ASSETS_BUCKET = "lead-magnet-assets";

export const LEAD_MAGNET_DELIVERY_MAX_BYTES = 25 * 1024 * 1024;

export const LEAD_MAGNET_DELIVERY_ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const LEAD_MAGNET_DELIVERY_ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
]);

export type LeadMagnetDeliveryMode = "link" | "upload";

export function parseLeadMagnetDeliveryMode(raw: unknown): LeadMagnetDeliveryMode {
  return String(raw ?? "").trim().toLowerCase() === "upload" ? "upload" : "link";
}

export function buildLeadMagnetAssetPublicUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/${LEAD_MAGNET_ASSETS_BUCKET}/${encoded}`;
}

export function isAllowedLeadMagnetDeliveryMime(mime: string): boolean {
  return LEAD_MAGNET_DELIVERY_ALLOWED_MIMES.has(mime.trim().toLowerCase());
}

export function isAllowedLeadMagnetDeliveryFileName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  for (const ext of LEAD_MAGNET_DELIVERY_ALLOWED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

export function sanitizeLeadMagnetAssetFileName(name: string): string {
  const base = name.trim().replace(/[/\\?%*:|"<>]/g, "_").replace(/\s+/g, "_");
  return base.slice(0, 120) || "framework";
}
