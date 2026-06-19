export type EntitySubtype =
  | "corporation"
  | "sole_proprietor"
  | "foundation"
  | "cooperative";

export type EntitySelectValue = "individual" | EntitySubtype;

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

export type KycStorageFolder =
  | "kyc"
  | "agreement"
  | "nib"
  | "npwp"
  | "director_npwp"
  | "akta"
  | "sk_menkeh"
  | "pp"
  | "tdy"
  | "pse"
  | "proof";

export const DOCUMENT_SLOT_STORAGE_FOLDER: Record<DocumentSlotKey, KycStorageFolder> = {
  nib: "nib",
  company_npwp: "npwp",
  director_npwp: "director_npwp",
  akta: "akta",
  sk_menkeh: "sk_menkeh",
  pp_establishment_statement: "pp",
  pp_registration_certificate: "pp",
  tdy: "tdy",
  pse_certificate: "pse",
  proof_of_business: "proof",
};

export const ENTITY_SUBTYPE_OPTIONS: Array<{
  value: EntitySelectValue;
  businessType: "individual" | "company";
  entitySubtype: EntitySubtype | null;
  labelKey: string;
  labelDefault: string;
}> = [
  { value: "individual", businessType: "individual", entitySubtype: null, labelKey: "xendit.kyc.individual", labelDefault: "Perorangan" },
  { value: "corporation", businessType: "company", entitySubtype: "corporation", labelKey: "xendit.kyc.entityCorporation", labelDefault: "PT / CV / PMA" },
  { value: "sole_proprietor", businessType: "company", entitySubtype: "sole_proprietor", labelKey: "xendit.kyc.entitySoleProprietor", labelDefault: "Perseroan Perorangan (PP)" },
  { value: "foundation", businessType: "company", entitySubtype: "foundation", labelKey: "xendit.kyc.entityFoundation", labelDefault: "Yayasan" },
  { value: "cooperative", businessType: "company", entitySubtype: "cooperative", labelKey: "xendit.kyc.entityCooperative", labelDefault: "Koperasi" },
];

const COMMON_COMPANY_SLOTS: DocumentSlotKey[] = ["nib", "company_npwp", "director_npwp"];

const ENTITY_DOC_SLOTS: Record<EntitySubtype, DocumentSlotKey[]> = {
  corporation: ["akta", "sk_menkeh"],
  sole_proprietor: ["pp_establishment_statement", "pp_registration_certificate"],
  foundation: ["akta", "sk_menkeh", "tdy"],
  cooperative: ["akta", "sk_menkeh", "pse_certificate"],
};

export const DOCUMENT_SLOT_LABELS: Record<DocumentSlotKey, { key: string; default: string }> = {
  nib: { key: "xendit.kyc.nibDocUpload", default: "Unggah dokumen NIB (PDF disarankan)" },
  company_npwp: { key: "xendit.kyc.npwpDocUpload", default: "Unggah dokumen NPWP perusahaan (PDF disarankan)" },
  director_npwp: { key: "xendit.kyc.directorNpwpDocUpload", default: "Unggah dokumen NPWP direktur (PDF disarankan)" },
  akta: { key: "xendit.kyc.aktaDocUpload", default: "Unggah dokumen Akta (PDF disarankan)" },
  sk_menkeh: { key: "xendit.kyc.skMenkehDocUpload", default: "Unggah dokumen SK Menkeh (PDF disarankan)" },
  pp_establishment_statement: { key: "xendit.kyc.ppStatementUpload", default: "Unggah Surat Pernyataan Pendirian PP" },
  pp_registration_certificate: { key: "xendit.kyc.ppCertificateUpload", default: "Unggah Sertifikat Pendaftaran PP" },
  tdy: { key: "xendit.kyc.tdyDocUpload", default: "Unggah Tanda Daftar Yayasan (TDY)" },
  pse_certificate: { key: "xendit.kyc.pseDocUpload", default: "Unggah Sertifikat/Izin PSE" },
  proof_of_business: { key: "xendit.kyc.proofOfBusinessUpload", default: "Unggah bukti usaha (invoice/foto toko)" },
};

export function entitySelectToTypes(value: EntitySelectValue): {
  businessType: "individual" | "company";
  entitySubtype: EntitySubtype | null;
} {
  const opt = ENTITY_SUBTYPE_OPTIONS.find((o) => o.value === value);
  return {
    businessType: opt?.businessType ?? "individual",
    entitySubtype: opt?.entitySubtype ?? null,
  };
}

export function typesToEntitySelect(
  businessType: string,
  entitySubtype: string | null | undefined,
): EntitySelectValue {
  if (businessType === "individual") return "individual";
  const sub = String(entitySubtype ?? "corporation") as EntitySubtype;
  if (sub in ENTITY_DOC_SLOTS) return sub;
  return "corporation";
}

export function requiredDocumentSlots(
  businessType: string,
  entitySubtype: string | null | undefined,
): DocumentSlotKey[] {
  if (businessType === "individual") return [];
  const sub = (entitySubtype ?? "corporation") as EntitySubtype;
  if (!(sub in ENTITY_DOC_SLOTS)) return [...COMMON_COMPANY_SLOTS, ...ENTITY_DOC_SLOTS.corporation];
  return [...COMMON_COMPANY_SLOTS, ...ENTITY_DOC_SLOTS[sub]];
}

export function isExtraDocumentSlot(slot: DocumentSlotKey): boolean {
  return [
    "pp_establishment_statement",
    "pp_registration_certificate",
    "tdy",
    "pse_certificate",
  ].includes(slot);
}

export type XenditBusinessAddress = {
  street_line_1: string;
  district: string;
  sub_district: string;
  city: string;
  province: string;
  postal_code: string;
  country_code: "ID";
};

export const EMPTY_BUSINESS_ADDRESS: XenditBusinessAddress = {
  street_line_1: "",
  district: "",
  sub_district: "",
  city: "",
  province: "",
  postal_code: "",
  country_code: "ID",
};

export function isValidBusinessWebsite(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
