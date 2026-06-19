import type { OrganizationKycDocument } from "@/xendit/types/xendit";
import {
  isValidBusinessWebsite,
  requiredDocumentSlots,
  type DocumentSlotKey,
  type EntitySelectValue,
  typesToEntitySelect,
} from "@/xendit/lib/xenditKycEntityConfig";

function pathForSlot(kyc: OrganizationKycDocument, slot: DocumentSlotKey): string {
  switch (slot) {
    case "nib":
      return kyc.nib_storage_path?.trim() || kyc.legal_doc_storage_path?.trim() || "";
    case "company_npwp":
      return kyc.npwp_storage_path?.trim() || "";
    case "director_npwp":
      return kyc.director_npwp_storage_path?.trim() || "";
    case "akta":
      return kyc.akta_storage_path?.trim() || "";
    case "sk_menkeh":
      return kyc.sk_menkeh_storage_path?.trim() || "";
    case "pp_establishment_statement":
    case "pp_registration_certificate":
    case "tdy":
    case "pse_certificate":
      return kyc.entity_extra_documents?.[slot]?.trim() || "";
    case "proof_of_business":
      return kyc.proof_of_business_storage_path?.trim() || "";
    default:
      return "";
  }
}

export function kycLegalDocumentsComplete(kyc: OrganizationKycDocument | null | undefined): boolean {
  if (!kyc) return false;
  if (!kyc.service_agreement_storage_path?.trim()) return false;
  if (!kyc.ktp_storage_path?.trim()) return false;
  if (!kyc.legal_name?.trim()) return false;

  if (kyc.business_type === "individual") {
    return Boolean(kyc.identity_number?.trim());
  }

  if (!kyc.identity_number?.trim()) return false;
  if (!kyc.nib?.trim()) return false;
  if (!kyc.npwp?.trim()) return false;
  if (!kyc.director_npwp?.trim()) return false;

  for (const slot of requiredDocumentSlots(kyc.business_type, kyc.entity_subtype)) {
    if (!pathForSlot(kyc, slot)) return false;
  }
  return true;
}

export function kycDocumentsComplete(kyc: OrganizationKycDocument | null | undefined): boolean {
  if (!kycLegalDocumentsComplete(kyc)) return false;
  if (kyc!.business_type === "individual") return true;

  const addr = kyc!.business_address;
  if (!addr) return false;
  const required = ["street_line_1", "district", "sub_district", "city", "province", "postal_code"] as const;
  for (const field of required) {
    if (!String(addr[field] ?? "").trim()) return false;
  }

  const website = kyc!.business_website?.trim() || "";
  const proof = kyc!.proof_of_business_storage_path?.trim() || "";
  if (!website && !proof) return false;
  if (website && !isValidBusinessWebsite(website)) return false;
  return true;
}

/** Mirrors backend `orgHasUsableKyc` — org may create additional akun. */
export function kycUsableForSubAccount(kyc: OrganizationKycDocument | null | undefined): boolean {
  if (!kyc) return false;
  const status = String(kyc.status ?? "").toUpperCase();
  if (status !== "PENDING" && status !== "APPROVED") return false;
  return kycDocumentsComplete(kyc);
}

export function entitySelectFromKyc(kyc: OrganizationKycDocument | null | undefined): EntitySelectValue {
  if (!kyc) return "individual";
  return typesToEntitySelect(kyc.business_type, kyc.entity_subtype);
}
