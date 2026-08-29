import { supabase } from "@/shared/lib/supabaseClient";
import { storageUploadOptions } from "@/shared/lib/storageCacheControl";

export const OUTLET_RECEIPT_ASSETS_BUCKET = "outlet-receipt-assets";

export function outletReceiptLogoObjectPath(
  organizationId: string,
  outletId: string,
  fileName: string,
): string {
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^\w]+/g, "") || "jpg";
  return `${organizationId}/outlets/${outletId}/logo.${ext}`;
}

export async function uploadOutletReceiptLogo(args: {
  organizationId: string;
  outletId: string;
  file: File;
}): Promise<string> {
  const path = outletReceiptLogoObjectPath(args.organizationId, args.outletId, args.file.name);
  const { error } = await supabase.storage.from(OUTLET_RECEIPT_ASSETS_BUCKET).upload(path, args.file, {
    ...storageUploadOptions({ upsert: true, contentType: args.file.type || "image/jpeg" }),
  });
  if (error) throw error;
  return path;
}

export async function removeOutletReceiptLogo(path: string): Promise<void> {
  const trimmed = path.trim();
  if (!trimmed) return;
  const { error } = await supabase.storage.from(OUTLET_RECEIPT_ASSETS_BUCKET).remove([trimmed]);
  if (error) throw error;
}

export async function signOutletReceiptLogo(path: string | null | undefined): Promise<string | null> {
  const trimmed = (path ?? "").trim();
  if (!trimmed) return null;
  const { data, error } = await supabase.storage
    .from(OUTLET_RECEIPT_ASSETS_BUCKET)
    .createSignedUrl(trimmed, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
