/**
 * Upload limits per Storage bucket (Storage P1 "Rem biaya", approved 28 Nov 2026).
 * Same values as migration 20261128130000_storage_bucket_limits.sql (a test keeps them in step).
 * Supabase enforces them for every upload, edge functions included; the Office only uses them for messages.
 */

const MB = 1024 * 1024;

const IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/bmp"];
const PDF = ["application/pdf"];
const OFFICE = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];
/** Browsers send this when the OS does not know the type (often .docx / .rar without Office installed). */
const UNKNOWN = ["application/octet-stream"];

export type BucketLimit = {
  maxBytes: number;
  /** null: any type. */
  mimeTypes: string[] | null;
  /** What to tell the user, in Indonesian. */
  typesLabel: string;
};

export const BUCKET_LIMITS: Record<string, BucketLimit> = {
  "whatsapp-media": { maxBytes: 100 * MB, mimeTypes: null, typesLabel: "semua jenis file" },
  "brief-visual-images": {
    maxBytes: 50 * MB,
    mimeTypes: [...IMAGES, "video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/wave"],
    typesLabel: "gambar, video MP4, atau audio MP3/WAV",
  },
  "social-media-story": {
    maxBytes: 50 * MB,
    mimeTypes: [...IMAGES, "video/mp4", "video/quicktime"],
    typesLabel: "gambar atau video MP4",
  },
  "lead-magnet-assets": {
    maxBytes: 25 * MB,
    mimeTypes: [
      ...PDF,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    typesLabel: "PDF, DOCX, XLSX, atau PPTX",
  },
  "task-files": {
    maxBytes: 10 * MB,
    mimeTypes: [
      ...IMAGES,
      ...PDF,
      ...OFFICE,
      "application/zip",
      "application/x-zip-compressed",
      "application/vnd.rar",
      "application/x-rar-compressed",
      "audio/*",
      "video/*",
      ...UNKNOWN,
    ],
    typesLabel: "gambar, PDF, dokumen Office, ZIP/RAR, audio, atau video",
  },
  "recruitment-files": {
    maxBytes: 5 * MB,
    mimeTypes: [...PDF, "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ...IMAGES, ...UNKNOWN],
    typesLabel: "PDF, DOC/DOCX, atau gambar",
  },
  "social-media-carousel": { maxBytes: 10 * MB, mimeTypes: IMAGES, typesLabel: "gambar" },
  "digital-asset-character-images": { maxBytes: 10 * MB, mimeTypes: IMAGES, typesLabel: "gambar" },
  "catalog-product-photos": { maxBytes: 10 * MB, mimeTypes: IMAGES, typesLabel: "gambar" },
  "expense-receipts": { maxBytes: 10 * MB, mimeTypes: [...IMAGES, ...PDF], typesLabel: "gambar atau PDF" },
  "income-receipts": { maxBytes: 10 * MB, mimeTypes: [...IMAGES, ...PDF], typesLabel: "gambar atau PDF" },
  "debt-payment-receipts": { maxBytes: 10 * MB, mimeTypes: [...IMAGES, ...PDF], typesLabel: "gambar atau PDF" },
  "purchase-documents": { maxBytes: 10 * MB, mimeTypes: [...IMAGES, ...PDF], typesLabel: "gambar atau PDF" },
  "sales-receipts": { maxBytes: 10 * MB, mimeTypes: [...IMAGES, ...PDF], typesLabel: "gambar atau PDF" },
  "employee-documents": { maxBytes: 10 * MB, mimeTypes: [...IMAGES, ...PDF, ...OFFICE, ...UNKNOWN], typesLabel: "gambar, PDF, atau dokumen Office" },
  "company-files": { maxBytes: 10 * MB, mimeTypes: [...IMAGES, ...PDF, ...OFFICE, ...UNKNOWN], typesLabel: "gambar, PDF, atau dokumen Office" },
  "kol-profile-photos": { maxBytes: 5 * MB, mimeTypes: IMAGES, typesLabel: "gambar" },
  "employee-profiles": { maxBytes: 5 * MB, mimeTypes: IMAGES, typesLabel: "gambar" },
  "company-profiles": { maxBytes: 5 * MB, mimeTypes: IMAGES, typesLabel: "gambar" },
  "invoice-template-logos": { maxBytes: 5 * MB, mimeTypes: IMAGES, typesLabel: "gambar" },
  "sniping-images": { maxBytes: 5 * MB, mimeTypes: IMAGES, typesLabel: "gambar" },
  "digital-asset-company-logos": { maxBytes: 5 * MB, mimeTypes: IMAGES, typesLabel: "gambar" },
  "attendance-photos": { maxBytes: 2 * MB, mimeTypes: ["image/jpeg", "image/png", "image/webp"], typesLabel: "foto JPG/PNG" },
};

function formatMb(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`;
}

/** Bucket id from a Storage upload URL (…/storage/v1/object/<bucket>/<path>). */
export function bucketFromStorageUrl(url: string): string | null {
  const hit = /\/storage\/v1\/object\/(?:upload\/sign\/)?([^/?#]+)\//.exec(url);
  if (!hit) return null;
  const bucket = decodeURIComponent(hit[1]);
  return ["public", "sign", "authenticated", "info", "list", "move", "copy"].includes(bucket) ? null : bucket;
}

export type StorageRejection = "too_large" | "bad_type";

/** Classify a Storage error body (Supabase answers 400/413/415 with statusCode, error, message). */
export function storageRejection(status: number, body: unknown): StorageRejection | null {
  const b = (body && typeof body === "object" ? body : {}) as { statusCode?: unknown; error?: unknown; message?: unknown };
  const code = String(b.statusCode ?? status);
  const text = `${String(b.error ?? "")} ${String(b.message ?? "")}`.toLowerCase();
  if (code === "413" || status === 413 || text.includes("payload too large") || text.includes("exceeded the maximum allowed size")) {
    return "too_large";
  }
  if (code === "415" || status === 415 || text.includes("invalid_mime_type") || text.includes("mime type")) return "bad_type";
  return null;
}

/** Indonesian message for a rejected upload, with the bucket's limit when known. */
export function storageRejectionMessage(kind: StorageRejection, bucket: string | null): string {
  const limit = bucket ? BUCKET_LIMITS[bucket] : undefined;
  if (kind === "too_large") {
    return limit ? `File terlalu besar. Maksimal ${formatMb(limit.maxBytes)}.` : "File terlalu besar untuk diunggah.";
  }
  return limit && limit.mimeTypes
    ? `Jenis file tidak didukung. Gunakan ${limit.typesLabel}.`
    : "Jenis file tidak didukung.";
}
