import { supabase } from "@/shared/lib/supabaseClient";
import { normalizePublicCode } from "@/synckerja-order/shared/lib/publicCode";
import type { PublicOrderWhatsApp } from "./orderWhatsApp";

/** Storefront (anon): the outlet's WhatsApp number + opening message, resolved from the public code. */
export async function fetchPublicOrderWhatsApp(code: string): Promise<PublicOrderWhatsApp> {
  const { data, error } = await supabase.rpc("get_public_synckerja_order_whatsapp", {
    p_code: normalizePublicCode(code),
  });
  if (error || !data) return { ok: false, error: error?.message ?? "not_found" };
  const payload = data as Partial<{ ok: boolean; phone_digits: string; prefill_message: string | null; error: string }>;
  if (!payload.ok || !payload.phone_digits) return { ok: false, error: payload.error };
  return { ok: true, phone_digits: payload.phone_digits, prefill_message: payload.prefill_message ?? null };
}
