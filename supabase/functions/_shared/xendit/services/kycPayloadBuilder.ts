import type { UploadedXenditFile } from "./xenditFileUpload.ts";
import {
  type DocumentSlotKey,
  type KycAddressInput,
  XENDIT_DOC_TYPES,
  collectRegistrationDocSlots,
  xenditEntityTypeFor,
} from "../kycEntityConfig.ts";
import type { KycDocumentInput } from "./kycDocuments.ts";

type UploadedMap = Partial<Record<DocumentSlotKey, UploadedXenditFile>>;

function fileField(file: UploadedXenditFile): Record<string, string> {
  return { file_name: file.fileName, file_id: file.fileId };
}

function buildAddress(addr: KycAddressInput | null | undefined): Record<string, string> | null {
  if (!addr) return null;
  const street = String(addr.street_line_1 ?? "").trim();
  if (!street) return null;
  return {
    street_line_1: street,
    district: String(addr.district ?? "").trim(),
    sub_district: String(addr.sub_district ?? "").trim(),
    city: String(addr.city ?? "").trim(),
    province: String(addr.province ?? "").trim(),
    state: String(addr.province ?? "").trim(),
    postal_code: String(addr.postal_code ?? "").trim(),
    country_code: String(addr.country_code ?? "ID").trim() || "ID",
  };
}

export function buildXenditVerificationPayload(
  kyc: KycDocumentInput,
  files: {
    ktp: UploadedXenditFile;
    agreement: UploadedXenditFile;
    docs: UploadedMap;
    proofOfBusiness?: UploadedXenditFile | null;
  },
): { business_entity_type: string; kyc_details: Record<string, unknown> } {
  const nameParts = kyc.legal_name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? kyc.legal_name.trim();
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;
  const serviceAgreement = fileField(files.agreement);

  const stakeholderIdentification: Record<string, unknown>[] = [
    {
      type: "ID_NATIONAL_ID_KTP",
      number: String(kyc.identity_number ?? "").trim() || "0000000000000000",
      document_front: fileField(files.ktp),
    },
  ];

  if (files.docs.director_npwp) {
    stakeholderIdentification.push({
      type: "ID_INDIVIDUAL_NPWP",
      number: String(kyc.director_npwp ?? "").trim(),
      document_front: fileField(files.docs.director_npwp),
    });
  }

  const stakeholders = [
    {
      roles: ["BUSINESS_OWNER"],
      first_name: firstName,
      last_name: lastName,
      nationality: "ID",
      identification: stakeholderIdentification,
    },
  ];

  if (kyc.business_type === "individual") {
    return {
      business_entity_type: "INDIVIDUAL",
      kyc_details: {
        stakeholders,
        service_agreement_document: serviceAgreement,
      },
    };
  }

  const registrationSlots = collectRegistrationDocSlots(kyc.business_type, kyc.entity_subtype);
  const businessRegistrationDocuments = registrationSlots
    .filter((slot) => files.docs[slot])
    .map((slot) => ({
      type: XENDIT_DOC_TYPES[slot],
      ...fileField(files.docs[slot]!),
    }));

  const address = buildAddress(kyc.business_address);
  const website = String(kyc.business_website ?? "").trim();

  const kycDetails: Record<string, unknown> = {
    business_legal_name: kyc.legal_name.trim(),
    business_registration_number: String(kyc.nib ?? "").trim(),
    business_tax_number: String(kyc.npwp ?? "").trim(),
    business_registration_documents: businessRegistrationDocuments,
    stakeholders,
    service_agreement_document: serviceAgreement,
  };

  if (address) {
    kycDetails.business_address = address;
    kycDetails.legal_entity_address = address;
  }

  if (website) {
    kycDetails.proof_of_business_websites = { website };
  } else if (files.proofOfBusiness) {
    kycDetails.proof_of_business_documents = [
      {
        type: XENDIT_DOC_TYPES.proof_of_business,
        ...fileField(files.proofOfBusiness),
      },
    ];
  }

  return {
    business_entity_type: xenditEntityTypeFor(kyc.business_type, kyc.entity_subtype),
    kyc_details: kycDetails,
  };
}
