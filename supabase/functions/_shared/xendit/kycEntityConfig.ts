export type EntitySubtype =
  | "corporation"
  | "sole_proprietor"
  | "foundation"
  | "cooperative";

export type DocumentSlotKey =
  | "nib"
  | "company_npwp"
  | "director_npwp"
  | "akta"
  | "sk_menkeh"
  | "pp_establishment_statement"
  | "pp_registration_certificate"
  | "tdy"
  | "pse_certificate"
  | "proof_of_business";

export const XENDIT_DOC_TYPES: Record<DocumentSlotKey, string> = {
  nib: "ID_NIB",
  company_npwp: "ID_COMPANY_NPWP",
  director_npwp: "ID_INDIVIDUAL_NPWP",
  akta: "ID_AKTA",
  sk_menkeh: "ID_SKMENKEH",
  pp_establishment_statement: "ID_AKTA",
  pp_registration_certificate: "ID_SKMENKEH",
  tdy: "ID_FOUNDATION_LICENSE",
  pse_certificate: "ID_PSE_LICENSE",
  proof_of_business: "INVOICE_PURCHASE_ORDER_DOCUMENT",
};

export const ENTITY_SUBTYPE_OPTIONS: Array<{
  value: "individual" | EntitySubtype;
  businessType: "individual" | "company";
  entitySubtype: EntitySubtype | null;
  xenditEntityType: string;
}> = [
  { value: "individual", businessType: "individual", entitySubtype: null, xenditEntityType: "INDIVIDUAL" },
  { value: "corporation", businessType: "company", entitySubtype: "corporation", xenditEntityType: "CORPORATION" },
  { value: "sole_proprietor", businessType: "company", entitySubtype: "sole_proprietor", xenditEntityType: "SOLE_PROPRIETOR" },
  { value: "foundation", businessType: "company", entitySubtype: "foundation", xenditEntityType: "NON_PROFIT" },
  { value: "cooperative", businessType: "company", entitySubtype: "cooperative", xenditEntityType: "COOPERATIVE" },
];

const COMMON_COMPANY_SLOTS: DocumentSlotKey[] = ["nib", "company_npwp", "director_npwp"];

const ENTITY_DOC_SLOTS: Record<EntitySubtype, DocumentSlotKey[]> = {
  corporation: ["akta", "sk_menkeh"],
  sole_proprietor: ["pp_establishment_statement", "pp_registration_certificate"],
  foundation: ["akta", "sk_menkeh", "tdy"],
  cooperative: ["akta", "sk_menkeh", "pse_certificate"],
};

export function resolveEntitySubtype(
  businessType: string,
  entitySubtype: string | null | undefined,
): EntitySubtype | null {
  if (businessType === "individual") return null;
  const sub = String(entitySubtype ?? "corporation").trim() as EntitySubtype;
  if (sub in ENTITY_DOC_SLOTS) return sub;
  return "corporation";
}

export function xenditEntityTypeFor(
  businessType: string,
  entitySubtype: string | null | undefined,
): string {
  if (businessType === "individual") return "INDIVIDUAL";
  const match = ENTITY_SUBTYPE_OPTIONS.find(
    (o) => o.entitySubtype === resolveEntitySubtype(businessType, entitySubtype),
  );
  return match?.xenditEntityType ?? "CORPORATION";
}

export function requiredDocumentSlots(
  businessType: string,
  entitySubtype: string | null | undefined,
): DocumentSlotKey[] {
  if (businessType === "individual") return [];
  const sub = resolveEntitySubtype(businessType, entitySubtype);
  if (!sub) return [];
  return [...COMMON_COMPANY_SLOTS, ...ENTITY_DOC_SLOTS[sub]];
}

export type KycAddressInput = {
  street_line_1?: string | null;
  district?: string | null;
  sub_district?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
};

export type KycValidationInput = {
  business_type: string;
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
  service_agreement_storage_path?: string | null;
  business_address?: KycAddressInput | null;
  business_website?: string | null;
  proof_of_business_storage_path?: string | null;
};

function pathForSlot(input: KycValidationInput, slot: DocumentSlotKey): string {
  switch (slot) {
    case "nib":
      return String(input.nib_storage_path ?? "").trim();
    case "company_npwp":
      return String(input.npwp_storage_path ?? "").trim();
    case "director_npwp":
      return String(input.director_npwp_storage_path ?? "").trim();
    case "akta":
      return String(input.akta_storage_path ?? "").trim();
    case "sk_menkeh":
      return String(input.sk_menkeh_storage_path ?? "").trim();
    case "pp_establishment_statement":
    case "pp_registration_certificate":
    case "tdy":
    case "pse_certificate":
      return String(input.entity_extra_documents?.[slot] ?? "").trim();
    case "proof_of_business":
      return String(input.proof_of_business_storage_path ?? "").trim();
    default:
      return "";
  }
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateKycEntityInput(input: KycValidationInput): void {
  const legalName = input.legal_name.trim();
  if (!legalName) throw new Error("Nama legal wajib diisi");

  if (!String(input.service_agreement_storage_path ?? "").trim()) {
    throw new Error("Dokumen Service Agreement wajib diunggah");
  }

  if (!String(input.ktp_storage_path ?? "").trim()) {
    throw new Error("Foto KTP wajib diunggah");
  }

  if (input.business_type === "individual") {
    if (!String(input.identity_number ?? "").trim()) {
      throw new Error("Nomor KTP wajib diisi untuk perorangan");
    }
    return;
  }

  if (!String(input.identity_number ?? "").trim()) {
    throw new Error("Nomor KTP penanggung jawab wajib diisi");
  }
  if (!String(input.nib ?? "").trim()) throw new Error("Nomor NIB wajib diisi");
  if (!String(input.npwp ?? "").trim()) throw new Error("NPWP perusahaan wajib diisi");
  if (!String(input.director_npwp ?? "").trim()) {
    throw new Error("NPWP direktur/pemilik wajib diisi");
  }

  for (const slot of requiredDocumentSlots(input.business_type, input.entity_subtype)) {
    if (!pathForSlot(input, slot)) {
      const labels: Record<DocumentSlotKey, string> = {
        nib: "Dokumen NIB",
        company_npwp: "Dokumen NPWP perusahaan",
        director_npwp: "Dokumen NPWP direktur",
        akta: "Dokumen Akta",
        sk_menkeh: "Dokumen SK Menkeh",
        pp_establishment_statement: "Surat Pernyataan Pendirian PP",
        pp_registration_certificate: "Sertifikat Pendaftaran PP",
        tdy: "Dokumen TDY",
        pse_certificate: "Sertifikat/Izin PSE",
        proof_of_business: "Dokumen bukti usaha",
      };
      throw new Error(`${labels[slot]} wajib diunggah`);
    }
  }

  const addr = input.business_address;
  if (addr) {
    const required = ["street_line_1", "district", "sub_district", "city", "province", "postal_code"] as const;
    for (const field of required) {
      if (!String(addr[field] ?? "").trim()) {
        throw new Error("Alamat bisnis belum lengkap");
      }
    }
  }
}

export function validateKycBusinessProfile(input: KycValidationInput): void {
  if (input.business_type === "individual") return;

  const addr = input.business_address;
  const required = ["street_line_1", "district", "sub_district", "city", "province", "postal_code"] as const;
  for (const field of required) {
    if (!String(addr?.[field] ?? "").trim()) {
      throw new Error("Alamat bisnis belum lengkap");
    }
  }

  const website = String(input.business_website ?? "").trim();
  const proofPath = String(input.proof_of_business_storage_path ?? "").trim();
  const hasWebsite = website && isValidUrl(website);
  if (!hasWebsite && !proofPath) {
    throw new Error("Isi website bisnis yang valid atau unggah dokumen bukti usaha");
  }
}

export function kycEntityDocumentsComplete(input: KycValidationInput): boolean {
  try {
    validateKycEntityInput(input);
    return true;
  } catch {
    return false;
  }
}

export function kycFullyComplete(input: KycValidationInput): boolean {
  try {
    validateKycEntityInput(input);
    validateKycBusinessProfile(input);
    return true;
  } catch {
    return false;
  }
}

export function collectRegistrationDocSlots(
  businessType: string,
  entitySubtype: string | null | undefined,
): DocumentSlotKey[] {
  if (businessType === "individual") return [];
  const sub = resolveEntitySubtype(businessType, entitySubtype);
  if (!sub) return [];
  return ["nib", "company_npwp", "director_npwp", ...ENTITY_DOC_SLOTS[sub]];
}
