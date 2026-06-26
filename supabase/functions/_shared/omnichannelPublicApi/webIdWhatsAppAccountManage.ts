import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isOmnichannelApiTokenExpired } from "./auth.ts";
import { normalizeWebId } from "./urlParams.ts";

type ManageJson = (body: unknown, status?: number) => Response;

function normalizeWebIdArg(value: unknown): string {
  return normalizeWebId(String(value ?? ""));
}

export async function handleWebIdWhatsAppAccountAction(
  admin: SupabaseClient,
  body: Record<string, unknown>,
  organizationId: string,
  json: ManageJson,
): Promise<Response | null> {
  const action = String(body.action ?? "").trim();

  if (action === "listWebIdWhatsAppAccounts") {
    const { data, error } = await admin
      .from("organization_whatsapp_web_id_accounts")
      .select(
        "id, web_id, whatsapp_account_id, is_active, updated_at, organization_whatsapp_accounts(id, whatsapp_business_name, display_phone_number, phone_number_id, is_active)",
      )
      .eq("organization_id", organizationId)
      .order("web_id", { ascending: true });

    if (error) return json({ success: false, error: error.message }, 500);

    const { data: tokens } = await admin
      .from("organization_omnichannel_api_tokens")
      .select("web_id, is_active, expires_at")
      .eq("organization_id", organizationId);

    const candidateWebIds = new Set<string>();
    for (const row of tokens ?? []) {
      if (!row.is_active) continue;
      if (isOmnichannelApiTokenExpired(row.expires_at as string | null)) continue;
      const wid = normalizeWebIdArg(row.web_id);
      if (wid) candidateWebIds.add(wid);
    }

    return json({
      success: true,
      mappings: data ?? [],
      candidate_web_ids: [...candidateWebIds].sort(),
    });
  }

  if (action === "getWebIdWhatsAppAccount") {
    const webId = normalizeWebIdArg(body.web_id);
    if (!webId) return json({ success: false, error: "web_id wajib." }, 400);

    const { data, error } = await admin
      .from("organization_whatsapp_web_id_accounts")
      .select(
        "id, web_id, whatsapp_account_id, is_active, updated_at, organization_whatsapp_accounts(id, whatsapp_business_name, display_phone_number, phone_number_id, is_active)",
      )
      .eq("organization_id", organizationId)
      .eq("web_id", webId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, mapping: data ?? null });
  }

  if (action === "upsertWebIdWhatsAppAccount") {
    const webId = normalizeWebIdArg(body.web_id);
    const whatsappAccountId = String(body.whatsapp_account_id ?? "").trim();

    if (!webId || !whatsappAccountId) {
      return json({ success: false, error: "web_id dan whatsapp_account_id wajib." }, 400);
    }

    const { data: account, error: accErr } = await admin
      .from("organization_whatsapp_accounts")
      .select("id, is_active")
      .eq("id", whatsappAccountId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (accErr) return json({ success: false, error: accErr.message }, 500);
    if (!account?.id || !account.is_active) {
      return json({ success: false, error: "Akun WhatsApp tidak ditemukan atau tidak aktif." }, 422);
    }

    const now = new Date().toISOString();
    const patch = {
      organization_id: organizationId,
      web_id: webId,
      whatsapp_account_id: whatsappAccountId,
      is_active: true,
      updated_at: now,
    };

    const { data, error } = await admin
      .from("organization_whatsapp_web_id_accounts")
      .upsert(patch, { onConflict: "organization_id,web_id" })
      .select(
        "id, web_id, whatsapp_account_id, is_active, updated_at, organization_whatsapp_accounts(id, whatsapp_business_name, display_phone_number, phone_number_id, is_active)",
      )
      .single();

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, mapping: data });
  }

  if (action === "deleteWebIdWhatsAppAccount") {
    const webId = normalizeWebIdArg(body.web_id);
    if (!webId) return json({ success: false, error: "web_id wajib." }, 400);

    const { error } = await admin
      .from("organization_whatsapp_web_id_accounts")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("web_id", webId);

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  }

  return null;
}
