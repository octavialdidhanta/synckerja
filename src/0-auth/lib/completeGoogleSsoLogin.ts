import type { User } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabaseClient";
import { ensureRegistrationProfile } from "@/0-register/utils/ensureRegistrationProfile";

function googleDisplayName(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const raw =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    "";
  return raw || null;
}

/** After Supabase Google OAuth session exists: profile, metadata, verification gate, ready for routeAfterLogin. */
export async function completeGoogleSsoLogin(user: User): Promise<{ ok: boolean; error?: string }> {
  const email = (user.email ?? "").trim();
  if (!email) {
    return { ok: false, error: "missing_email" };
  }

  const profileOk = await ensureRegistrationProfile(user.id, email);
  if (!profileOk) {
    console.warn("completeGoogleSsoLogin: ensure_registration_profile failed");
  }

  const displayName = googleDisplayName(user);
  const existingName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  if (displayName && !existingName) {
    const { error: updateErr } = await supabase.auth.updateUser({
      data: { full_name: displayName },
    });
    if (updateErr) {
      console.warn("completeGoogleSsoLogin: updateUser full_name", updateErr.message);
    }
  }

  const { data: markData, error: markErr } = await supabase.rpc("mark_oauth_registration_verified", {
    p_user_id: user.id,
    p_email: email,
  });

  if (markErr) {
    console.warn("mark_oauth_registration_verified:", markErr.message);
    return { ok: false, error: markErr.message };
  }

  const row = markData as { ok?: boolean; error?: string } | null;
  if (row?.ok !== true) {
    const err = row?.error ?? "mark_verified_failed";
    if (err !== "not_google_identity") {
      return { ok: false, error: err };
    }
  }

  return { ok: true };
}
