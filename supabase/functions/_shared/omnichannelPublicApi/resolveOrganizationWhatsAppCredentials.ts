import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeWebId } from "./urlParams.ts";

export type OrganizationWhatsAppCredentials = {
  whatsappAccountId: string;
  phoneNumberId: string;
  accessToken: string;
};

export const WA_ACCOUNT_NOT_MAPPED_CODE = "WA_ACCOUNT_NOT_MAPPED";
export const WA_ACCOUNT_NOT_MAPPED_ERROR = "wa_account_not_mapped";

type WaAccountRow = {
  id: string;
  phone_number_id: string;
  meta_access_token: string | null;
  is_active: boolean;
};

async function resolveAccessToken(
  admin: SupabaseClient,
  organizationId: string,
  waAccount: WaAccountRow,
): Promise<string | null> {
  let accessToken = String(waAccount.meta_access_token ?? "").trim();
  if (!accessToken) {
    const { data: orgMeta } = await admin
      .from("organization_meta_config")
      .select("meta_access_token")
      .eq("organization_id", organizationId)
      .maybeSingle();
    accessToken = String(orgMeta?.meta_access_token ?? "").trim();
  }
  return accessToken || null;
}

function credentialsFromRow(
  waAccount: WaAccountRow,
  accessToken: string,
): OrganizationWhatsAppCredentials {
  return {
    whatsappAccountId: String(waAccount.id),
    phoneNumberId: String(waAccount.phone_number_id),
    accessToken,
  };
}

export async function resolveOrganizationWhatsAppCredentials(
  admin: SupabaseClient,
  organizationId: string,
  options?: { webId?: string | null },
): Promise<
  | { ok: true; credentials: OrganizationWhatsAppCredentials }
  | { ok: false; error: string; code?: string }
> {
  const normalizedWebId = options?.webId != null ? normalizeWebId(String(options.webId)) : "";

  if (!normalizedWebId) {
    return {
      ok: false,
      error: WA_ACCOUNT_NOT_MAPPED_ERROR,
      code: WA_ACCOUNT_NOT_MAPPED_CODE,
    };
  }

  const { data: mapping, error: mapErr } = await admin
    .from("organization_whatsapp_web_id_accounts")
    .select("whatsapp_account_id, is_active")
    .eq("organization_id", organizationId)
    .eq("web_id", normalizedWebId)
    .eq("is_active", true)
    .maybeSingle();

  if (mapErr) {
    console.error("resolveOrganizationWhatsAppCredentials mapping:", mapErr);
    return { ok: false, error: mapErr.message };
  }

  if (!mapping?.whatsapp_account_id) {
    return {
      ok: false,
      error: WA_ACCOUNT_NOT_MAPPED_ERROR,
      code: WA_ACCOUNT_NOT_MAPPED_CODE,
    };
  }

  const { data: waAccount, error: accErr } = await admin
    .from("organization_whatsapp_accounts")
    .select("id, phone_number_id, meta_access_token, is_active")
    .eq("id", mapping.whatsapp_account_id)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (accErr) {
    console.error("resolveOrganizationWhatsAppCredentials account:", accErr);
    return { ok: false, error: accErr.message };
  }

  if (!waAccount?.phone_number_id) {
    return {
      ok: false,
      error: WA_ACCOUNT_NOT_MAPPED_ERROR,
      code: WA_ACCOUNT_NOT_MAPPED_CODE,
    };
  }

  const accessToken = await resolveAccessToken(admin, organizationId, waAccount);
  if (!accessToken) {
    return { ok: false, error: "Token Meta WhatsApp tidak ditemukan." };
  }

  return {
    ok: true,
    credentials: credentialsFromRow(waAccount, accessToken),
  };
}
