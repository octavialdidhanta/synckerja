// Daftar Klaim guard for AI Employee runs (Claim Process #4).
// - The model is given only the claims the brief allows: approved claims that are brand-wide, picked in the brief
//   ("Klaim yang boleh dipakai", product_claim_uses module ai_employee ref "brief:<employee id>"), or behind the
//   brief's Fokus angle (module thinking_lab ref "angle:<id>").
// - After a plan is saved its text is checked against that list. A claim outside it keeps the plan out of auto
//   approve: it goes back to Need Review with a note in the brief comments. Used claims are logged as jejak pemakaian.
import {
  allowedFactsBlock,
  claimHoldNote,
  gayaClaimWords,
  guardClaims,
  type RegistryClaim,
} from "../_shared/claimMatch.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

export type ClaimGuard = {
  allowed: RegistryClaim[];
  words: string[];
  /** Appended to every generation prompt. */
  block: string;
};

const EMPTY: ClaimGuard = { allowed: [], words: [], block: allowedFactsBlock([]) };

function todayWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function loadClaimGuard(
  admin: Admin,
  organizationId: string,
  employeeId: string,
  angleIds: string[],
): Promise<ClaimGuard> {
  try {
    const today = todayWib();
    const claimsRes = await admin
      .from("product_claims")
      .select("id,code,text,status,valid_until")
      .eq("organization_id", organizationId)
      .eq("status", "approved");
    if (claimsRes.error) return EMPTY;
    const approved = ((claimsRes.data ?? []) as Array<{ id: string; code: string; text: string; valid_until: string | null }>)
      .filter((c) => !c.valid_until || c.valid_until >= today);
    if (!approved.length) return EMPTY;
    const ids = approved.map((c) => c.id);
    const refs = [`brief:${employeeId}`, ...angleIds.map((id) => `angle:${id}`)];
    const [scopesRes, usesRes, settingsRes, styleRes] = await Promise.all([
      admin.from("product_claim_scopes").select("claim_id,scope").eq("organization_id", organizationId).in("claim_id", ids),
      admin
        .from("product_claim_uses")
        .select("claim_id")
        .eq("organization_id", organizationId)
        .in("module", ["ai_employee", "thinking_lab"])
        .in("ref_id", refs),
      admin.from("organization_catalog_settings").select("industry_template_code").eq("organization_id", organizationId).maybeSingle(),
      admin.from("catalog_style_fields").select("field_key,body").eq("organization_id", organizationId),
    ]);
    const brand = new Set(
      ((scopesRes.data ?? []) as Array<{ claim_id: string; scope: string }>).filter((s) => s.scope === "brand").map((s) => s.claim_id),
    );
    const picked = new Set(((usesRes.data ?? []) as Array<{ claim_id: string }>).map((u) => u.claim_id));
    const allowedRows = approved.filter((c) => brand.has(c.id) || picked.has(c.id));
    const allowed: RegistryClaim[] = allowedRows.map((c) => ({ code: c.code, text: c.text, status: "approved", scopes: [] }));

    const words: string[] = [];
    const code = settingsRes.data?.industry_template_code as string | undefined;
    if (code) {
      const tpl = await admin.from("catalog_industry_templates").select("claim_words").eq("code", code).maybeSingle();
      words.push(...(((tpl.data?.claim_words as string[] | undefined) ?? [])));
    }
    const boxes = Object.fromEntries(((styleRes.data ?? []) as Array<{ field_key: string; body: string }>).map((r) => [r.field_key, r.body]));
    words.push(...gayaClaimWords(boxes));

    return { allowed, words, block: allowedFactsBlock(allowedRows) };
  } catch {
    return EMPTY;
  }
}

/** The text fields of a saved draft, as parts to check. Ids, dates and colours are skipped. */
export function draftTextParts(draft: Record<string, unknown>): Array<{ where: string; text: string }> {
  const skip = /(^id$|_id$|_ids$|date|palette|font|color|colour|fields$)/i;
  return Object.entries(draft)
    .filter(([key, value]) => typeof value === "string" && value.trim() && !skip.test(key))
    .map(([key, value]) => ({ where: key, text: value as string }));
}

/**
 * Check a saved plan. A claim outside the allowed list: the plan leaves auto approve (Need Review) and a note goes to
 * its brief comments. Allowed claims it uses are logged on the plan.
 */
export async function guardSavedPlan(
  admin: Admin,
  input: {
    organizationId: string;
    employeeId: string;
    employeeName: string;
    planId: string;
    draft: Record<string, unknown>;
    guard: ClaimGuard;
  },
): Promise<{ held: boolean; offending: number; used: string[] }> {
  try {
    const { offending, used } = guardClaims(draftTextParts(input.draft), input.guard.allowed, input.guard.words);
    if (used.length) {
      const claimRows = await admin
        .from("product_claims")
        .select("id")
        .eq("organization_id", input.organizationId)
        .in("code", used);
      const rows = ((claimRows.data ?? []) as Array<{ id: string }>).map((c) => ({
        organization_id: input.organizationId,
        claim_id: c.id,
        module: "brief",
        ref_id: input.planId,
        label: typeof input.draft.title === "string" ? String(input.draft.title).slice(0, 300) : null,
      }));
      if (rows.length) await admin.from("product_claim_uses").upsert(rows, { onConflict: "claim_id,module,ref_id", ignoreDuplicates: true });
    }
    if (!offending.length) return { held: false, offending: 0, used };

    await admin
      .from("social_media_plans")
      .update({ approved: false, status: "Need Review", completion_date: null })
      .eq("id", input.planId)
      .eq("organization_id", input.organizationId)
      .eq("author_employee_id", input.employeeId)
      .eq("approved", true);
    await admin.from("link_comments").insert({
      social_media_plan_id: input.planId,
      link_url: "brief",
      comment_text: claimHoldNote(offending),
      commenter_display_name: `${input.employeeName || "AI Employee"} · Cek klaim`,
    });
    console.log(JSON.stringify({ event: "claim_guard_held", plan_id: input.planId, offending: offending.map((f) => f.claim) }));
    return { held: true, offending: offending.length, used };
  } catch (error) {
    console.error("claim_guard_failed", error instanceof Error ? error.message : String(error));
    return { held: false, offending: 0, used: [] };
  }
}
