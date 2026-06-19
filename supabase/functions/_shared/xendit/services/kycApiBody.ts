import type { KycDocumentInput } from "./kycDocuments.ts";

function strOrNull(value: unknown): string | null {
  return value != null ? String(value) : null;
}

function strOrUndef(value: unknown): string | undefined {
  return value != null ? String(value) : undefined;
}

function parseExtraDocuments(body: Record<string, unknown>): Record<string, string> | undefined {
  const raw = body.entity_extra_documents;
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value != null) out[key] = String(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseAddress(body: Record<string, unknown>): KycDocumentInput["business_address"] {
  const raw = body.business_address;
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as Record<string, unknown>;
  return {
    street_line_1: strOrNull(a.street_line_1),
    district: strOrNull(a.district),
    sub_district: strOrNull(a.sub_district),
    city: strOrNull(a.city),
    province: strOrNull(a.province),
    postal_code: strOrNull(a.postal_code),
    country_code: strOrNull(a.country_code) ?? "ID",
  };
}

export function parseKycDocumentInputFromBody(
  body: Record<string, unknown>,
  partial = false,
): KycDocumentInput | Partial<KycDocumentInput> {
  const input: Partial<KycDocumentInput> = {};

  if (!partial || body.business_type != null) {
    input.business_type = String(body.business_type ?? "individual") as "individual" | "company";
  }
  if (!partial || body.entity_subtype != null) {
    input.entity_subtype = strOrNull(body.entity_subtype);
  }
  if (!partial || body.legal_name != null) {
    input.legal_name = String(body.legal_name ?? body.business_name ?? "");
  }
  if (!partial || body.identity_number != null) input.identity_number = strOrNull(body.identity_number);
  if (!partial || body.npwp != null) input.npwp = strOrNull(body.npwp);
  if (!partial || body.nib != null) input.nib = strOrNull(body.nib);
  if (!partial || body.director_npwp != null) input.director_npwp = strOrNull(body.director_npwp);
  if (!partial || body.ktp_storage_path != null) {
    input.ktp_storage_path = strOrNull(body.ktp_storage_path);
  }
  if (!partial || body.nib_storage_path != null) {
    input.nib_storage_path = strOrNull(body.nib_storage_path);
  }
  if (!partial || body.npwp_storage_path != null) {
    input.npwp_storage_path = strOrNull(body.npwp_storage_path);
  }
  if (!partial || body.director_npwp_storage_path != null) {
    input.director_npwp_storage_path = strOrNull(body.director_npwp_storage_path);
  }
  if (!partial || body.akta_storage_path != null) {
    input.akta_storage_path = strOrNull(body.akta_storage_path);
  }
  if (!partial || body.sk_menkeh_storage_path != null) {
    input.sk_menkeh_storage_path = strOrNull(body.sk_menkeh_storage_path);
  }
  if (!partial || body.entity_extra_documents != null) {
    input.entity_extra_documents = parseExtraDocuments(body);
  }
  if (!partial || body.service_agreement_storage_path != null) {
    input.service_agreement_storage_path = strOrNull(body.service_agreement_storage_path);
  }
  if (!partial || body.business_address != null) {
    input.business_address = parseAddress(body);
  }
  if (!partial || body.business_website != null) {
    input.business_website = strOrUndef(body.business_website) ?? null;
  }
  if (!partial || body.proof_of_business_storage_path != null) {
    input.proof_of_business_storage_path = strOrNull(body.proof_of_business_storage_path);
  }

  return input;
}

export function parseFullKycFromBody(body: Record<string, unknown>): KycDocumentInput {
  return parseKycDocumentInputFromBody(body, false) as KycDocumentInput;
}

export function parsePartialKycFromBody(body: Record<string, unknown>): Partial<KycDocumentInput> {
  return parseKycDocumentInputFromBody(body, true);
}
