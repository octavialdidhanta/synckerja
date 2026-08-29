import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { isInternalXenditOrg } from "../internalOrg.ts";
import { getOrgKycDocument, kycHasCompleteDocuments, kycRowToInput, orgHasUsableKyc } from "./kycDocuments.ts";
import { getOrgXenditSettings } from "./resolveSubAccount.ts";

export type RequestSubAccountResult = {
  require_kyc: boolean;
  can_create: boolean;
  is_internal: boolean;
  account_type: "OWNED" | "MANAGED";
  kyc_status: string | null;
  message?: string;
};

/** Gate check before opening KYC modal or create dialog. */
export async function requestSubAccount(
  admin: SupabaseClient,
  organizationId: string,
  opts?: { isSandbox?: boolean },
): Promise<RequestSubAccountResult> {
  const settings = await getOrgXenditSettings(admin, organizationId);
  if (!settings?.is_enabled) {
    throw new Error("Aktifkan Xendit untuk organisasi ini terlebih dahulu");
  }

  const isInternal = isInternalXenditOrg(organizationId);
  if (isInternal) {
    // Live Indonesia rejects OWNED (UNSUPPORTED_COUNTRY). Sandbox keeps OWNED for QA.
    return {
      require_kyc: false,
      can_create: true,
      is_internal: true,
      account_type: opts?.isSandbox === true ? "OWNED" : "MANAGED",
      kyc_status: null,
    };
  }

  const kyc = await getOrgKycDocument(admin, organizationId);
  if (orgHasUsableKyc(kyc)) {
    return {
      require_kyc: false,
      can_create: true,
      is_internal: false,
      account_type: "MANAGED",
      kyc_status: kyc ? String(kyc.status ?? null) : null,
    };
  }

  if (kyc && !kycHasCompleteDocuments(kycRowToInput(kyc))) {
    return {
      require_kyc: true,
      can_create: false,
      is_internal: false,
      account_type: "MANAGED",
      kyc_status: String(kyc.status ?? null),
      message:
        "Lengkapi dokumen legalitas (termasuk Service Agreement) sebelum membuat akun Xendit",
    };
  }

  return {
    require_kyc: true,
    can_create: false,
    is_internal: false,
    account_type: "MANAGED",
    kyc_status: null,
    message: "Lengkapi data legalitas bisnis sebelum membuat akun Xendit",
  };
}

export async function ensureXenditEnabled(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const settings = await getOrgXenditSettings(admin, organizationId);
  if (!settings?.is_enabled) {
    throw new Error("Xendit not enabled for this organization");
  }
}
