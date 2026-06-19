import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditApiBase } from "../xenditEnv.ts";
import { formatXenditApiError } from "../xenditErrors.ts";
import { xenditBasicAuthHeader } from "../xenditKeyUtils.ts";

const KYC_BUCKET = "xendit-kyc-documents";

export type UploadedXenditFile = {
  fileId: string;
  fileName: string;
  raw: Record<string, unknown>;
};

/** Upload a KYC file from Supabase Storage to Xendit Files API. */
export async function uploadFileToXendit(
  secretKey: string,
  storagePath: string,
  admin: SupabaseClient,
  fileName: string,
): Promise<UploadedXenditFile> {
  const normalizedPath = storagePath.trim().replace(/^\/+/, "");
  if (!normalizedPath) throw new Error("Missing storage path");

  const { data: blob, error: dlErr } = await admin.storage.from(KYC_BUCKET).download(normalizedPath);
  if (dlErr || !blob) {
    throw new Error(`Gagal membaca dokumen dari storage: ${dlErr?.message ?? "file tidak ditemukan"}`);
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = blob.type || guessMimeFromName(fileName);
  const form = new FormData();
  form.append("purpose", "KYC_DOCUMENT");
  form.append("file", new Blob([bytes], { type: mime }), fileName);

  const res = await fetch(`${xenditApiBase()}/files`, {
    method: "POST",
    headers: {
      Authorization: xenditBasicAuthHeader(secretKey),
    },
    body: form,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    throw new Error(formatXenditApiError(res.status, json));
  }

  const fileId = String(json.id ?? "").trim();
  if (!fileId) throw new Error("xendit_api: missing file id after upload");

  return { fileId, fileName, raw: json };
}

function guessMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export function assertKycStoragePathOwnedByOrg(
  storagePath: string,
  organizationId: string,
): void {
  const normalized = storagePath.trim().replace(/^\/+/, "");
  const prefix = `${organizationId}/`;
  if (!normalized.startsWith(prefix)) {
    throw new Error("Path dokumen tidak valid untuk organisasi ini");
  }
}
