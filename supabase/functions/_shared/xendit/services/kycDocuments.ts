import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest } from "../xenditClient.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import {
  type DocumentSlotKey,
  type KycAddressInput,
  kycEntityDocumentsComplete,
  validateKycBusinessProfile,
  validateKycEntityInput,
} from "../kycEntityConfig.ts";
import type { UploadedXenditFile } from "./xenditFileUpload.ts";
import { uploadFileToXendit } from "./xenditFileUpload.ts";
import { buildXenditVerificationPayload } from "./kycPayloadBuilder.ts";

export type KycDocumentInput = {
  business_type: "individual" | "company";
  entity_subtype?: string | null;
  legal_name: string;
  identity_number?: string | null;
  npwp?: string | null;
  nib?: string | null;
  director_npwp?: string | null;
  ktp_storage_path?: string | null;
  nib_storage_path?: string | null;
  npwp_storage_path?: string | null;
  director_npwp_storage_path?: string | null;
  akta_storage_path?: string | null;
  sk_menkeh_storage_path?: string | null;
  entity_extra_documents?: Record<string, string> | null;
  /** @deprecated Use nib_storage_path / npwp_storage_path */
  legal_doc_storage_path?: string | null;
  service_agreement_storage_path?: string | null;
  business_address?: KycAddressInput | null;
  business_website?: string | null;
  proof_of_business_storage_path?: string | null;
};

function parseExtraDocuments(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value) out[key] = String(value);
  }
  return out;
}

function parseAddress(raw: unknown): KycAddressInput | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  return {
    street_line_1: a.street_line_1 ? String(a.street_line_1) : null,
    district: a.district ? String(a.district) : null,
    sub_district: a.sub_district ? String(a.sub_district) : null,
    city: a.city ? String(a.city) : null,
    province: a.province ? String(a.province) : null,
    postal_code: a.postal_code ? String(a.postal_code) : null,
    country_code: a.country_code ? String(a.country_code) : "ID",
  };
}

export function kycRowToInput(kyc: Record<string, unknown>): KycDocumentInput {
  const nibPath = kyc.nib_storage_path
    ? String(kyc.nib_storage_path)
    : kyc.legal_doc_storage_path
      ? String(kyc.legal_doc_storage_path)
      : null;

  return {
    business_type: String(kyc.business_type ?? "individual") as "individual" | "company",
    entity_subtype: kyc.entity_subtype ? String(kyc.entity_subtype) : null,
    legal_name: String(kyc.legal_name ?? ""),
    identity_number: kyc.identity_number ? String(kyc.identity_number) : null,
    npwp: kyc.npwp ? String(kyc.npwp) : null,
    nib: kyc.nib ? String(kyc.nib) : null,
    director_npwp: kyc.director_npwp ? String(kyc.director_npwp) : null,
    ktp_storage_path: kyc.ktp_storage_path ? String(kyc.ktp_storage_path) : null,
    nib_storage_path: nibPath,
    npwp_storage_path: kyc.npwp_storage_path ? String(kyc.npwp_storage_path) : null,
    director_npwp_storage_path: kyc.director_npwp_storage_path
      ? String(kyc.director_npwp_storage_path)
      : null,
    akta_storage_path: kyc.akta_storage_path ? String(kyc.akta_storage_path) : null,
    sk_menkeh_storage_path: kyc.sk_menkeh_storage_path
      ? String(kyc.sk_menkeh_storage_path)
      : null,
    entity_extra_documents: parseExtraDocuments(kyc.entity_extra_documents),
    legal_doc_storage_path: kyc.legal_doc_storage_path
      ? String(kyc.legal_doc_storage_path)
      : null,
    service_agreement_storage_path: kyc.service_agreement_storage_path
      ? String(kyc.service_agreement_storage_path)
      : null,
    business_address: parseAddress(kyc.business_address),
    business_website: kyc.business_website ? String(kyc.business_website) : null,
    proof_of_business_storage_path: kyc.proof_of_business_storage_path
      ? String(kyc.proof_of_business_storage_path)
      : null,
  };
}

export function kycHasCompleteDocuments(input: KycDocumentInput): boolean {
  return kycEntityDocumentsComplete(input);
}

export function validateKycInput(input: KycDocumentInput): void {
  validateKycEntityInput(input);
  if (input.business_type !== "individual") {
    validateKycBusinessProfile(input);
  }
}

function storagePathForSlot(input: KycDocumentInput, slot: DocumentSlotKey): string | null {
  switch (slot) {
    case "nib":
      return input.nib_storage_path ?? null;
    case "company_npwp":
      return input.npwp_storage_path ?? null;
    case "director_npwp":
      return input.director_npwp_storage_path ?? null;
    case "akta":
      return input.akta_storage_path ?? null;
    case "sk_menkeh":
      return input.sk_menkeh_storage_path ?? null;
    case "pp_establishment_statement":
    case "pp_registration_certificate":
    case "tdy":
    case "pse_certificate":
      return input.entity_extra_documents?.[slot] ?? null;
    case "proof_of_business":
      return input.proof_of_business_storage_path ?? null;
    default:
      return null;
  }
}

const ALL_STORAGE_PATH_KEYS: Array<keyof KycDocumentInput | "entity_extra"> = [
  "ktp_storage_path",
  "nib_storage_path",
  "npwp_storage_path",
  "director_npwp_storage_path",
  "akta_storage_path",
  "sk_menkeh_storage_path",
  "service_agreement_storage_path",
  "proof_of_business_storage_path",
  "legal_doc_storage_path",
];

export function listKycStoragePaths(input: KycDocumentInput): string[] {
  const paths: string[] = [];
  for (const key of ALL_STORAGE_PATH_KEYS) {
    const value = input[key as keyof KycDocumentInput];
    if (typeof value === "string" && value.trim()) paths.push(value.trim());
  }
  if (input.entity_extra_documents) {
    for (const value of Object.values(input.entity_extra_documents)) {
      if (value.trim()) paths.push(value.trim());
    }
  }
  return paths;
}

export async function upsertOrgKycDocument(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  input: KycDocumentInput,
): Promise<Record<string, unknown>> {
  validateKycInput(input);

  const entitySubtype =
    input.business_type === "company"
      ? (input.entity_subtype?.trim() || "corporation")
      : null;

  const payload = {
    organization_id: organizationId,
    business_type: input.business_type,
    entity_subtype: entitySubtype,
    legal_name: input.legal_name.trim(),
    identity_number: input.identity_number?.trim() || null,
    npwp: input.npwp?.trim() || null,
    nib: input.nib?.trim() || null,
    director_npwp: input.director_npwp?.trim() || null,
    ktp_storage_path: input.ktp_storage_path?.trim() || null,
    nib_storage_path: input.nib_storage_path?.trim() || null,
    npwp_storage_path: input.npwp_storage_path?.trim() || null,
    director_npwp_storage_path: input.director_npwp_storage_path?.trim() || null,
    akta_storage_path: input.akta_storage_path?.trim() || null,
    sk_menkeh_storage_path: input.sk_menkeh_storage_path?.trim() || null,
    entity_extra_documents: input.entity_extra_documents ?? {},
    legal_doc_storage_path: input.legal_doc_storage_path?.trim() || null,
    service_agreement_storage_path: input.service_agreement_storage_path?.trim() || null,
    business_address: input.business_address ?? null,
    business_website: input.business_website?.trim() || null,
    proof_of_business_storage_path: input.proof_of_business_storage_path?.trim() || null,
    status: "PENDING",
    submitted_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("organization_kyc_documents")
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function getOrgKycDocument(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from("organization_kyc_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) ?? null;
}

export function orgHasUsableKyc(kyc: Record<string, unknown> | null): boolean {
  if (!kyc) return false;
  const status = String(kyc.status ?? "").toUpperCase();
  if (status !== "PENDING" && status !== "APPROVED") return false;
  return kycHasCompleteDocuments(kycRowToInput(kyc));
}

type VerificationResult = {
  ok: boolean;
  uploadedFiles: UploadedXenditFile[];
  verificationResponse?: Record<string, unknown>;
  error?: string;
};

/** Upload KYC files to Xendit and submit ID account verification. */
export async function uploadKycDocumentsToXendit(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  subAccountId: string,
  kyc: KycDocumentInput,
): Promise<VerificationResult> {
  const uploadedFiles: UploadedXenditFile[] = [];

  try {
    validateKycInput(kyc);

    const ktpPath = String(kyc.ktp_storage_path ?? "").trim();
    const ktpFile = await uploadFileToXendit(
      env.secretKey,
      ktpPath,
      admin,
      ktpPath.split("/").pop() ?? "ktp.jpg",
    );
    uploadedFiles.push(ktpFile);

    const agreementPath = String(kyc.service_agreement_storage_path ?? "").trim();
    const agreementFile = await uploadFileToXendit(
      env.secretKey,
      agreementPath,
      admin,
      agreementPath.split("/").pop() ?? "service-agreement.pdf",
    );
    uploadedFiles.push(agreementFile);

    const docSlots: DocumentSlotKey[] = [
      "nib",
      "company_npwp",
      "director_npwp",
      "akta",
      "sk_menkeh",
      "pp_establishment_statement",
      "pp_registration_certificate",
      "tdy",
      "pse_certificate",
    ];

    const docs: Partial<Record<DocumentSlotKey, UploadedXenditFile>> = {};
    for (const slot of docSlots) {
      const path = storagePathForSlot(kyc, slot);
      if (!path) continue;
      const uploaded = await uploadFileToXendit(
        env.secretKey,
        path,
        admin,
        path.split("/").pop() ?? `${slot}.pdf`,
      );
      uploadedFiles.push(uploaded);
      docs[slot] = uploaded;
    }

    let proofOfBusiness: UploadedXenditFile | null = null;
    const proofPath = String(kyc.proof_of_business_storage_path ?? "").trim();
    if (proofPath) {
      proofOfBusiness = await uploadFileToXendit(
        env.secretKey,
        proofPath,
        admin,
        proofPath.split("/").pop() ?? "proof.pdf",
      );
      uploadedFiles.push(proofOfBusiness);
    }

    const { business_entity_type, kyc_details } = buildXenditVerificationPayload(kyc, {
      ktp: ktpFile,
      agreement: agreementFile,
      docs,
      proofOfBusiness,
    });

    const verificationBody = {
      country_of_incorporation: "ID",
      business_entity_type,
      business_industry_code: "OTHER",
      kyc_details,
    };

    const verificationResponse = await xenditRequest<Record<string, unknown>>(env.secretKey, {
      method: "POST",
      path: "/account_verification",
      forUserId: subAccountId,
      body: verificationBody,
    });

    return { ok: true, uploadedFiles, verificationResponse };
  } catch (err) {
    return {
      ok: false,
      uploadedFiles,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function applyDocumentUploadResult(
  admin: SupabaseClient,
  subAccountRowId: string,
  organizationId: string,
  row: Record<string, unknown>,
  uploadResult: Awaited<ReturnType<typeof uploadKycDocumentsToXendit>>,
  extraMetadata: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const prevMeta =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};

  const { data: updatedRow, error: updErr } = await admin
    .from("xendit_sub_accounts")
    .update({
      document_upload_status: uploadResult.ok ? "completed" : "failed",
      document_upload_error: uploadResult.ok ? null : uploadResult.error ?? "Upload dokumen gagal",
      metadata: {
        ...prevMeta,
        document_upload: uploadResult,
        ...extraMetadata,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", subAccountRowId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (updErr) throw new Error(updErr.message);
  return (updatedRow ?? row) as Record<string, unknown>;
}
