import { supabase } from "@/shared/lib/supabaseClient";
import type { KycStorageFolder } from "@/xendit/lib/xenditKycEntityConfig";

export const XENDIT_KYC_BUCKET = "xendit-kyc-documents";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024;

function extForFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  return "jpg";
}

export function validateKycFile(file: File, kind: "ktp" | "legal" | "agreement"): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    if (kind === "ktp") return "KTP harus berformat JPG atau PNG";
    if (kind === "agreement") {
      return "Service Agreement harus berformat PDF (disarankan), JPG, atau PNG";
    }
    return "Dokumen legalitas harus berformat PDF (disarankan), JPG, atau PNG";
  }
  if (file.size > MAX_BYTES) {
    return "Ukuran file maksimal 10 MB";
  }
  return null;
}

export async function uploadXenditKycFile(
  organizationId: string,
  file: File,
  folder: KycStorageFolder | "sub",
): Promise<string> {
  const validationKind =
    folder === "kyc" ? "ktp" : folder === "agreement" ? "agreement" : "legal";
  const validationError = validateKycFile(file, validationKind);
  if (validationError) throw new Error(validationError);

  const ext = extForFile(file);
  const path = `${organizationId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(XENDIT_KYC_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return path;
}
