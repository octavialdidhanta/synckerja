import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import {
  kycHasCompleteDocuments,
  kycRowToInput,
  uploadKycDocumentsToXendit,
  applyDocumentUploadResult,
} from "./kycDocuments.ts";
import { getSubAccountById } from "./resolveSubAccount.ts";

export async function retrySubAccountDocuments(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  subAccountRowId: string,
): Promise<{ ok: boolean; row: Record<string, unknown>; error?: string }> {
  const row = await getSubAccountById(admin, organizationId, subAccountRowId);
  if (!row) throw new Error("Akun tidak ditemukan");

  const subAccountId = String(row.xendit_sub_account_id ?? "").trim();
  if (!subAccountId) throw new Error("Akun Xendit belum terhubung");

  const { data: kyc, error: kycErr } = await admin
    .from("organization_kyc_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (kycErr) throw new Error(kycErr.message);
  if (!kyc) throw new Error("Data KYC organisasi tidak ditemukan");

  const kycInput = kycRowToInput(kyc as Record<string, unknown>);
  if (!kycHasCompleteDocuments(kycInput)) {
    return {
      ok: false,
      row: row as Record<string, unknown>,
      error: "Dokumen Service Agreement belum diunggah. Gunakan Lengkapi dokumen.",
    };
  }

  const uploadResult = await uploadKycDocumentsToXendit(
    admin,
    env,
    organizationId,
    subAccountId,
    kycInput,
  );

  const updated = await applyDocumentUploadResult(
    admin,
    subAccountRowId,
    organizationId,
    row as Record<string, unknown>,
    uploadResult,
    { document_retry_at: new Date().toISOString() },
  );

  return {
    ok: uploadResult.ok,
    row: updated,
    error: uploadResult.error,
  };
}
