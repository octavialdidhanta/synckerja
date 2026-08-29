import { supabase } from "@/shared/lib/supabaseClient";

export type SendPosShiftRecapEmailArgs = {
  shiftId: string;
  language: string;
};

export type SendPosShiftRecapEmailResult =
  | { ok: true }
  | { ok: false; code: "dispatch_failed" | "update_failed"; message: string };

/**
 * Update dispatch language and invoke edge function (fire-and-forget friendly).
 * Enqueue happens server-side in pos_end_shift; failures are non-blocking for UX.
 */
export async function sendPosShiftRecapEmail(
  args: SendPosShiftRecapEmailArgs,
): Promise<SendPosShiftRecapEmailResult> {
  const lang = args.language === "en" ? "en" : "id";

  const { error: langErr } = await supabase.rpc("update_pos_shift_email_dispatch_language", {
    p_shift_id: args.shiftId,
    p_language: lang,
  });
  if (langErr) {
    return { ok: false, code: "update_failed", message: langErr.message };
  }

  const { error: dispatchErr } = await supabase.functions.invoke("dispatch-pos-shift-recap", {
    body: { shiftId: args.shiftId },
  });
  if (dispatchErr) {
    return { ok: false, code: "dispatch_failed", message: dispatchErr.message };
  }

  return { ok: true };
}

/** Non-blocking wrapper — never throws; swallow errors for shift close UX. */
export function sendPosShiftRecapEmailSilent(args: SendPosShiftRecapEmailArgs): void {
  void sendPosShiftRecapEmail(args).catch(() => undefined);
}
