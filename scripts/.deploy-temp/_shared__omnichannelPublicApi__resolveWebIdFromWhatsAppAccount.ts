import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeWebId } from "./urlParams.ts";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Reverse lookup: Meta phone_number_id → web_id via organization_whatsapp_web_id_accounts. */
export async function resolveWebIdFromPhoneNumberId(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumberId: string | null | undefined,
): Promise<string | null> {
  const pnId = String(phoneNumberId ?? "").trim();
  if (!pnId) return null;

  const { data: account, error: accErr } = await admin
    .from("organization_whatsapp_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("phone_number_id", pnId)
    .eq("is_active", true)
    .maybeSingle();

  if (accErr || !account?.id) {
    if (accErr) console.warn("resolveWebIdFromPhoneNumberId account:", accErr.message);
    return null;
  }

  const { data: mapping, error: mapErr } = await admin
    .from("organization_whatsapp_web_id_accounts")
    .select("web_id")
    .eq("organization_id", organizationId)
    .eq("whatsapp_account_id", account.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (mapErr) {
    console.warn("resolveWebIdFromPhoneNumberId mapping:", mapErr.message);
    return null;
  }

  const webId = mapping?.web_id;
  return webId != null ? normalizeWebId(String(webId)) || null : null;
}

/** Reverse lookup via display_phone_number on organization_whatsapp_accounts. */
export async function resolveWebIdFromDisplayPhoneNumberDb(
  admin: SupabaseClient,
  organizationId: string,
  displayPhoneNumber: string | null | undefined,
): Promise<string | null> {
  const digits = digitsOnly(String(displayPhoneNumber ?? ""));
  if (!digits) return null;

  const { data: accounts, error: accErr } = await admin
    .from("organization_whatsapp_accounts")
    .select("id, phone_number_id, display_phone_number, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (accErr) {
    console.warn("resolveWebIdFromDisplayPhoneNumberDb accounts:", accErr.message);
    return null;
  }

  const match = (accounts ?? []).find((row) => {
    const display = digitsOnly(String(row.display_phone_number ?? ""));
    const pn = digitsOnly(String(row.phone_number_id ?? ""));
    return display === digits || pn === digits;
  });

  if (!match?.id) return null;

  const { data: mapping, error: mapErr } = await admin
    .from("organization_whatsapp_web_id_accounts")
    .select("web_id")
    .eq("organization_id", organizationId)
    .eq("whatsapp_account_id", match.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (mapErr) {
    console.warn("resolveWebIdFromDisplayPhoneNumberDb mapping:", mapErr.message);
    return null;
  }

  const webId = mapping?.web_id;
  return webId != null ? normalizeWebId(String(webId)) || null : null;
}

/** Prefer phone_number_id; fall back to display number. */
export async function resolveWebIdForInboundWhatsApp(args: {
  admin: SupabaseClient;
  organizationId: string;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
}): Promise<string | null> {
  const fromPn = await resolveWebIdFromPhoneNumberId(
    args.admin,
    args.organizationId,
    args.phoneNumberId,
  );
  if (fromPn) return fromPn;

  return resolveWebIdFromDisplayPhoneNumberDb(
    args.admin,
    args.organizationId,
    args.displayPhoneNumber,
  );
}
