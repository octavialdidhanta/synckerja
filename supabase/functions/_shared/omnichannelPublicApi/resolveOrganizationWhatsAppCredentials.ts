import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type OrganizationWhatsAppCredentials = {
  whatsappAccountId: string;
  phoneNumberId: string;
  accessToken: string;
};

export async function resolveOrganizationWhatsAppCredentials(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true; credentials: OrganizationWhatsAppCredentials } | { ok: false; error: string }> {
  const { data: waAccount } = await admin
    .from("organization_whatsapp_accounts")
    .select("id, phone_number_id, meta_access_token, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!waAccount?.phone_number_id) {
    return { ok: false, error: "WhatsApp belum dikonfigurasi." };
  }

  let accessToken = String(waAccount.meta_access_token ?? "").trim();
  if (!accessToken) {
    const { data: orgMeta } = await admin
      .from("organization_meta_config")
      .select("meta_access_token")
      .eq("organization_id", organizationId)
      .maybeSingle();
    accessToken = String(orgMeta?.meta_access_token ?? "").trim();
  }

  if (!accessToken) {
    return { ok: false, error: "Token Meta WhatsApp tidak ditemukan." };
  }

  return {
    ok: true,
    credentials: {
      whatsappAccountId: String(waAccount.id),
      phoneNumberId: String(waAccount.phone_number_id),
      accessToken,
    },
  };
}
