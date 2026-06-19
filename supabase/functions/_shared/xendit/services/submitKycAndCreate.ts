import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { assertKycStoragePathOwnedByOrg } from "./xenditFileUpload.ts";
import { createTenantSubAccount } from "./createSubAccount.ts";
import {
  type KycDocumentInput,
  applyDocumentUploadResult,
  getOrgKycDocument,
  kycRowToInput,
  listKycStoragePaths,
  upsertOrgKycDocument,
  uploadKycDocumentsToXendit,
} from "./kycDocuments.ts";
import { getSubAccountById } from "./resolveSubAccount.ts";

function assertKycStoragePaths(input: KycDocumentInput, organizationId: string): void {
  for (const path of listKycStoragePaths(input)) {
    assertKycStoragePathOwnedByOrg(path, organizationId);
  }
}

export function mergeKycInput(
  existing: KycDocumentInput,
  patch: Partial<KycDocumentInput>,
): KycDocumentInput {
  return {
    business_type: patch.business_type ?? existing.business_type,
    entity_subtype: patch.entity_subtype !== undefined ? patch.entity_subtype : existing.entity_subtype,
    legal_name: patch.legal_name?.trim() ? patch.legal_name.trim() : existing.legal_name,
    identity_number:
      patch.identity_number !== undefined ? patch.identity_number : existing.identity_number,
    npwp: patch.npwp !== undefined ? patch.npwp : existing.npwp,
    nib: patch.nib !== undefined ? patch.nib : existing.nib,
    director_npwp: patch.director_npwp !== undefined ? patch.director_npwp : existing.director_npwp,
    ktp_storage_path:
      patch.ktp_storage_path !== undefined ? patch.ktp_storage_path : existing.ktp_storage_path,
    nib_storage_path:
      patch.nib_storage_path !== undefined ? patch.nib_storage_path : existing.nib_storage_path,
    npwp_storage_path:
      patch.npwp_storage_path !== undefined ? patch.npwp_storage_path : existing.npwp_storage_path,
    director_npwp_storage_path:
      patch.director_npwp_storage_path !== undefined
        ? patch.director_npwp_storage_path
        : existing.director_npwp_storage_path,
    akta_storage_path:
      patch.akta_storage_path !== undefined ? patch.akta_storage_path : existing.akta_storage_path,
    sk_menkeh_storage_path:
      patch.sk_menkeh_storage_path !== undefined
        ? patch.sk_menkeh_storage_path
        : existing.sk_menkeh_storage_path,
    entity_extra_documents:
      patch.entity_extra_documents !== undefined
        ? patch.entity_extra_documents
        : existing.entity_extra_documents,
    legal_doc_storage_path:
      patch.legal_doc_storage_path !== undefined
        ? patch.legal_doc_storage_path
        : existing.legal_doc_storage_path,
    service_agreement_storage_path:
      patch.service_agreement_storage_path !== undefined
        ? patch.service_agreement_storage_path
        : existing.service_agreement_storage_path,
    business_address:
      patch.business_address !== undefined ? patch.business_address : existing.business_address,
    business_website:
      patch.business_website !== undefined ? patch.business_website : existing.business_website,
    proof_of_business_storage_path:
      patch.proof_of_business_storage_path !== undefined
        ? patch.proof_of_business_storage_path
        : existing.proof_of_business_storage_path,
  };
}

export async function submitKycAndCreate(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  userId: string,
  input: {
    business_name: string;
    email: string;
    linked_bank_account_id?: string | null;
    payout_bank_code: string;
    payout_account_number: string;
    payout_account_holder_name: string;
    kyc: KycDocumentInput;
  },
): Promise<{
  ok: boolean;
  sub_account_id: string;
  sub_account_row: Record<string, unknown>;
  kyc: Record<string, unknown>;
  document_upload_ok: boolean;
  document_upload_error?: string;
}> {
  const kycInput = input.kyc;
  assertKycStoragePaths(kycInput, organizationId);

  const kycRow = await upsertOrgKycDocument(admin, organizationId, userId, kycInput);

  const { subAccountId, row } = await createTenantSubAccount(admin, env, organizationId, userId, {
    business_name: input.business_name,
    email: input.email,
    type: "MANAGED",
    linked_bank_account_id: input.linked_bank_account_id ?? null,
    payout_bank_code: input.payout_bank_code,
    payout_account_number: input.payout_account_number,
    payout_account_holder_name: input.payout_account_holder_name,
    document_upload_status: "pending",
    skip_kyc_gate: true,
  });

  const uploadResult = await uploadKycDocumentsToXendit(
    admin,
    env,
    organizationId,
    subAccountId,
    kycInput,
  );

  const updatedRow = await applyDocumentUploadResult(
    admin,
    String(row.id),
    organizationId,
    row,
    uploadResult,
  );

  if (uploadResult.verificationResponse) {
    await admin
      .from("organization_kyc_documents")
      .update({
        metadata: {
          ...(kycRow.metadata && typeof kycRow.metadata === "object"
            ? (kycRow.metadata as Record<string, unknown>)
            : {}),
          xendit_verification: uploadResult.verificationResponse,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);
  }

  return {
    ok: true,
    sub_account_id: subAccountId,
    sub_account_row: updatedRow,
    kyc: kycRow,
    document_upload_ok: uploadResult.ok,
    document_upload_error: uploadResult.error,
  };
}

export async function uploadKycForManagedSubAccount(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  subAccountRowId: string,
  subAccountId: string,
  row: Record<string, unknown>,
): Promise<{
  document_upload_ok: boolean;
  document_upload_error?: string;
  row: Record<string, unknown>;
}> {
  const kyc = await getOrgKycDocument(admin, organizationId);
  if (!kyc) {
    throw new Error("Data KYC organisasi tidak ditemukan");
  }

  const kycInput = kycRowToInput(kyc);
  const uploadResult = await uploadKycDocumentsToXendit(
    admin,
    env,
    organizationId,
    subAccountId,
    kycInput,
  );

  const updatedRow = await applyDocumentUploadResult(
    admin,
    subAccountRowId,
    organizationId,
    row,
    uploadResult,
  );

  if (uploadResult.verificationResponse) {
    await admin
      .from("organization_kyc_documents")
      .update({
        metadata: {
          ...(kyc.metadata && typeof kyc.metadata === "object"
            ? (kyc.metadata as Record<string, unknown>)
            : {}),
          xendit_verification: uploadResult.verificationResponse,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);
  }

  return {
    document_upload_ok: uploadResult.ok,
    document_upload_error: uploadResult.error,
    row: updatedRow,
  };
}

export async function updateKycAndRetryDocuments(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  userId: string,
  input: {
    sub_account_row_id: string;
    kyc: Partial<KycDocumentInput>;
  },
): Promise<{
  ok: boolean;
  row: Record<string, unknown>;
  kyc: Record<string, unknown>;
  document_upload_ok: boolean;
  document_upload_error?: string;
}> {
  const row = await getSubAccountById(admin, organizationId, input.sub_account_row_id);
  if (!row) throw new Error("Akun tidak ditemukan");

  const subAccountId = String(row.xendit_sub_account_id ?? "").trim();
  if (!subAccountId) throw new Error("Akun Xendit belum terhubung");

  const existingKyc = await getOrgKycDocument(admin, organizationId);
  const baseInput: KycDocumentInput = existingKyc
    ? kycRowToInput(existingKyc)
    : {
        business_type: input.kyc.business_type ?? "individual",
        legal_name: input.kyc.legal_name ?? "",
      };

  const merged = mergeKycInput(baseInput, input.kyc);
  assertKycStoragePaths(merged, organizationId);

  const kycRow = await upsertOrgKycDocument(admin, organizationId, userId, merged);

  const uploadResult = await uploadKycDocumentsToXendit(
    admin,
    env,
    organizationId,
    subAccountId,
    merged,
  );

  const updatedRow = await applyDocumentUploadResult(
    admin,
    input.sub_account_row_id,
    organizationId,
    row,
    uploadResult,
    { document_retry_at: new Date().toISOString() },
  );

  if (uploadResult.verificationResponse) {
    await admin
      .from("organization_kyc_documents")
      .update({
        metadata: {
          ...(kycRow.metadata && typeof kycRow.metadata === "object"
            ? (kycRow.metadata as Record<string, unknown>)
            : {}),
          xendit_verification: uploadResult.verificationResponse,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);
  }

  return {
    ok: uploadResult.ok,
    row: updatedRow,
    kyc: kycRow,
    document_upload_ok: uploadResult.ok,
    document_upload_error: uploadResult.error,
  };
}
