import type { EntitySelectValue, XenditBusinessAddress } from "@/xendit/lib/xenditKycEntityConfig";
import {
  DOCUMENT_SLOT_STORAGE_FOLDER,
  entitySelectToTypes,
  isExtraDocumentSlot,
  isValidBusinessWebsite,
  requiredDocumentSlots,
  type DocumentSlotKey,
} from "@/xendit/lib/xenditKycEntityConfig";
import { uploadXenditKycFile } from "@/xendit/lib/xenditKycStorage";
import type { OrganizationKycDocument } from "@/xendit/types/xendit";

export type XenditKycFormState = {
  entitySelect: EntitySelectValue;
  legalName: string;
  identityNumber: string;
  npwp: string;
  nib: string;
  directorNpwp: string;
  businessName: string;
  email: string;
  businessAddress: XenditBusinessAddress;
  businessWebsite: string;
  linkedBankAccountId: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  useNewCompanyDeed: boolean;
  files: {
    ktp: File | null;
    serviceAgreement: File | null;
    documents: Partial<Record<DocumentSlotKey, File | null>>;
  };
};

export const INITIAL_KYC_FORM: XenditKycFormState = {
  entitySelect: "individual",
  legalName: "",
  identityNumber: "",
  npwp: "",
  nib: "",
  directorNpwp: "",
  businessName: "",
  email: "",
  businessAddress: {
    street_line_1: "",
    district: "",
    sub_district: "",
    city: "",
    province: "",
    postal_code: "",
    country_code: "ID",
  },
  businessWebsite: "",
  linkedBankAccountId: "__none__",
  bankCode: "",
  accountNumber: "",
  accountHolder: "",
  useNewCompanyDeed: false,
  files: {
    ktp: null,
    serviceAgreement: null,
    documents: {},
  },
};

export type ExistingKycPaths = {
  ktp?: string | null;
  serviceAgreement?: string | null;
  nib?: string | null;
  npwp?: string | null;
  directorNpwp?: string | null;
  akta?: string | null;
  skMenkeh?: string | null;
  entityExtra?: Record<string, string | null>;
  proofOfBusiness?: string | null;
};

export function existingPathsFromKyc(kyc: OrganizationKycDocument): ExistingKycPaths {
  return {
    ktp: kyc.ktp_storage_path,
    serviceAgreement: kyc.service_agreement_storage_path,
    nib: kyc.nib_storage_path ?? kyc.legal_doc_storage_path,
    npwp: kyc.npwp_storage_path,
    directorNpwp: kyc.director_npwp_storage_path,
    akta: kyc.akta_storage_path,
    skMenkeh: kyc.sk_menkeh_storage_path,
    entityExtra: kyc.entity_extra_documents ?? {},
    proofOfBusiness: kyc.proof_of_business_storage_path,
  };
}

export type UploadedKycPaths = {
  businessType: "individual" | "company";
  entitySubtype: string | null;
  legalName: string;
  identityNumber?: string;
  npwp?: string;
  nib?: string;
  directorNpwp?: string;
  ktpStoragePath: string;
  serviceAgreementStoragePath: string;
  nibStoragePath?: string;
  npwpStoragePath?: string;
  directorNpwpStoragePath?: string;
  aktaStoragePath?: string;
  skMenkehStoragePath?: string;
  entityExtraDocuments?: Record<string, string>;
  businessAddress?: XenditBusinessAddress;
  businessWebsite?: string;
  proofOfBusinessStoragePath?: string;
};

function existingPathForSlot(existing: ExistingKycPaths, slot: DocumentSlotKey): string | undefined {
  switch (slot) {
    case "nib":
      return existing.nib ?? undefined;
    case "company_npwp":
      return existing.npwp ?? undefined;
    case "director_npwp":
      return existing.directorNpwp ?? undefined;
    case "akta":
      return existing.akta ?? undefined;
    case "sk_menkeh":
      return existing.skMenkeh ?? undefined;
    case "proof_of_business":
      return existing.proofOfBusiness ?? undefined;
    default:
      return existing.entityExtra?.[slot] ?? undefined;
  }
}

export async function uploadKycFormFiles(
  organizationId: string,
  form: XenditKycFormState,
  existing: ExistingKycPaths = {},
): Promise<UploadedKycPaths> {
  const { businessType, entitySubtype } = entitySelectToTypes(form.entitySelect);

  if (!form.files.ktp && !existing.ktp) {
    throw new Error("Unggah foto KTP");
  }
  if (!form.files.serviceAgreement && !existing.serviceAgreement) {
    throw new Error("Unggah dokumen Service Agreement");
  }

  const ktpStoragePath = form.files.ktp
    ? await uploadXenditKycFile(organizationId, form.files.ktp, "kyc")
    : existing.ktp!;

  const serviceAgreementStoragePath = form.files.serviceAgreement
    ? await uploadXenditKycFile(organizationId, form.files.serviceAgreement, "agreement")
    : existing.serviceAgreement!;

  const result: UploadedKycPaths = {
    businessType,
    entitySubtype,
    legalName: form.legalName.trim(),
    identityNumber: form.identityNumber.trim() || undefined,
    npwp: form.npwp.trim() || undefined,
    nib: form.nib.trim() || undefined,
    directorNpwp: form.directorNpwp.trim() || undefined,
    ktpStoragePath,
    serviceAgreementStoragePath,
  };

  if (businessType === "company") {
    const slots = requiredDocumentSlots(businessType, entitySubtype);
    const entityExtra: Record<string, string> = { ...(existing.entityExtra ?? {}) };

    for (const slot of slots) {
      const file = form.files.documents[slot];
      const prev = existingPathForSlot(existing, slot);
      if (!file && !prev) {
        throw new Error(`Dokumen ${slot} wajib diunggah`);
      }
      const path = file
        ? await uploadXenditKycFile(organizationId, file, DOCUMENT_SLOT_STORAGE_FOLDER[slot])
        : prev!;

      if (slot === "nib") result.nibStoragePath = path;
      else if (slot === "company_npwp") result.npwpStoragePath = path;
      else if (slot === "director_npwp") result.directorNpwpStoragePath = path;
      else if (slot === "akta") result.aktaStoragePath = path;
      else if (slot === "sk_menkeh") result.skMenkehStoragePath = path;
      else if (isExtraDocumentSlot(slot)) entityExtra[slot] = path;
    }

    if (Object.keys(entityExtra).length > 0) {
      result.entityExtraDocuments = entityExtra;
    }

    result.businessAddress = form.businessAddress;
    result.businessWebsite = form.businessWebsite.trim() || undefined;

    const proofFile = form.files.documents.proof_of_business;
    if (proofFile) {
      result.proofOfBusinessStoragePath = await uploadXenditKycFile(
        organizationId,
        proofFile,
        "proof",
      );
    } else if (existing.proofOfBusiness) {
      result.proofOfBusinessStoragePath = existing.proofOfBusiness;
    }
  }

  return result;
}

export function uploadedPathsToApiBody(paths: UploadedKycPaths): Record<string, unknown> {
  return {
    business_type: paths.businessType,
    entity_subtype: paths.entitySubtype,
    legal_name: paths.legalName,
    identity_number: paths.identityNumber ?? null,
    npwp: paths.npwp ?? null,
    nib: paths.nib ?? null,
    director_npwp: paths.directorNpwp ?? null,
    ktp_storage_path: paths.ktpStoragePath,
    nib_storage_path: paths.nibStoragePath ?? null,
    npwp_storage_path: paths.npwpStoragePath ?? null,
    director_npwp_storage_path: paths.directorNpwpStoragePath ?? null,
    akta_storage_path: paths.aktaStoragePath ?? null,
    sk_menkeh_storage_path: paths.skMenkehStoragePath ?? null,
    entity_extra_documents: paths.entityExtraDocuments ?? null,
    service_agreement_storage_path: paths.serviceAgreementStoragePath,
    business_address: paths.businessAddress ?? null,
    business_website: paths.businessWebsite ?? null,
    proof_of_business_storage_path: paths.proofOfBusinessStoragePath ?? null,
  };
}

function hasExistingOrFile(
  file: File | null | undefined,
  existing?: string | null,
): boolean {
  return Boolean(file || existing?.trim());
}

export function validateKycFormStep(
  form: XenditKycFormState,
  step: 1 | 2 | 3,
  existing: ExistingKycPaths = {},
  mode: "create" | "edit" = "create",
): string | null {
  const { businessType, entitySubtype } = entitySelectToTypes(form.entitySelect);
  const isIndividual = businessType === "individual";

  if (step === 1) {
    if (!form.legalName.trim()) return "Nama legal wajib diisi";
    if (!form.identityNumber.trim()) return isIndividual ? "Nomor KTP wajib diisi" : "Nomor KTP penanggung jawab wajib diisi";
    if (!isIndividual && !form.directorNpwp.trim()) return "NPWP direktur/pemilik wajib diisi";
    if (!hasExistingOrFile(form.files.ktp, existing.ktp)) return "Unggah foto KTP";
    if (!isIndividual && !hasExistingOrFile(form.files.documents.director_npwp, existing.directorNpwp)) {
      return "Unggah dokumen NPWP direktur";
    }
    return null;
  }

  if (step === 2) {
    if (!hasExistingOrFile(form.files.serviceAgreement, existing.serviceAgreement)) {
      return "Unggah dokumen Service Agreement";
    }
    if (isIndividual) return null;
    if (!form.nib.trim()) return "Nomor NIB wajib diisi";
    if (!form.npwp.trim()) return "NPWP perusahaan wajib diisi";
    if (!hasExistingOrFile(form.files.documents.nib, existing.nib)) {
      return "Unggah dokumen NIB";
    }
    if (!hasExistingOrFile(form.files.documents.company_npwp, existing.npwp)) {
      return "Unggah dokumen NPWP perusahaan";
    }
    for (const slot of requiredDocumentSlots(businessType, entitySubtype)) {
      if (slot === "nib" || slot === "company_npwp" || slot === "director_npwp") continue;
      const file = form.files.documents[slot];
      const prev = existingPathForSlot(existing, slot);
      if (!hasExistingOrFile(file, prev)) {
        return `Dokumen ${slot} wajib diunggah`;
      }
    }
    return null;
  }

  if (step === 3 && mode === "edit" && isIndividual) return null;

  if (!form.email.trim() && mode === "create") return "Email bisnis wajib diisi";
  if (mode === "create") {
    if (!form.bankCode.trim() || !form.accountNumber.trim() || !form.accountHolder.trim()) {
      return "Lengkapi data rekening payout";
    }
  }
  if (!isIndividual) {
    const addr = form.businessAddress;
    const required = ["street_line_1", "district", "sub_district", "city", "province", "postal_code"] as const;
    for (const field of required) {
      if (!addr[field].trim()) return "Alamat bisnis belum lengkap";
    }
    const website = form.businessWebsite.trim();
    if (!website && !hasExistingOrFile(form.files.documents.proof_of_business, existing.proofOfBusiness)) {
      return "Isi website bisnis yang valid atau unggah dokumen bukti usaha";
    }
    if (website && !isValidBusinessWebsite(website)) {
      return "Website bisnis harus berupa URL yang valid (https://...)";
    }
  }
  return null;
}
