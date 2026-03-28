import { supabase } from "@/shared/lib/supabaseClient";

/** Ensures profiles row exists (RPC matches auth.users id + email). Safe if DB trigger already inserted. */
export async function ensureRegistrationProfile(userId: string, email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("ensure_registration_profile", {
    p_user_id: userId,
    p_email: email.trim(),
  });
  if (error) {
    console.warn("ensure_registration_profile", error);
    return false;
  }
  const row = data as { ok?: boolean };
  return row?.ok === true;
}
