import { supabase } from "@/shared/lib/supabaseClient";
import { OUTREACH_MEDIA_BUCKET } from "@/5-3-instagram-outreach/lib/audience";

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 16 * 1024 * 1024;

export type OutreachAttachmentKind = "image" | "video";

export type OutreachFileValidation = "type" | "size" | null;

export function validateOutreachFile(file: File): OutreachFileValidation {
  const mime = file.type;
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") {
    return file.size > IMAGE_MAX_BYTES ? "size" : null;
  }
  if (mime === "video/mp4") {
    return file.size > VIDEO_MAX_BYTES ? "size" : null;
  }
  return "type";
}

export function outreachAttachmentKind(mime: string): OutreachAttachmentKind | null {
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") return "image";
  if (mime === "video/mp4") return "video";
  return null;
}

function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(0, 80) || "file";
}

export function buildOutreachStoragePath(args: {
  organizationId: string;
  campaignId: string;
  materialId: string;
  fileName: string;
}): string {
  return `${args.organizationId}/${args.campaignId}/${args.materialId}_${safeFileName(args.fileName)}`;
}

export async function uploadOutreachMaterialFile(args: {
  organizationId: string;
  campaignId: string;
  materialId: string;
  file: File;
}): Promise<{ storagePath: string; mime: string; fileName: string; kind: OutreachAttachmentKind }> {
  const validation = validateOutreachFile(args.file);
  if (validation) {
    throw new Error(validation);
  }
  const kind = outreachAttachmentKind(args.file.type);
  if (!kind) throw new Error("type");
  const storagePath = buildOutreachStoragePath(args);
  const { error } = await supabase.storage.from(OUTREACH_MEDIA_BUCKET).upload(storagePath, args.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: args.file.type,
  });
  if (error) throw error;
  return {
    storagePath,
    mime: args.file.type,
    fileName: args.file.name,
    kind,
  };
}

export async function removeOutreachMaterialFiles(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  if (unique.length === 0) return;
  await supabase.storage.from(OUTREACH_MEDIA_BUCKET).remove(unique);
}

export async function downloadOutreachMaterialFile(storagePath: string, fileName: string): Promise<void> {
  const { data, error } = await supabase.storage.from(OUTREACH_MEDIA_BUCKET).createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) throw error ?? new Error("signed-url");
  const response = await fetch(data.signedUrl);
  if (!response.ok) throw new Error("download");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName || "materi";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
