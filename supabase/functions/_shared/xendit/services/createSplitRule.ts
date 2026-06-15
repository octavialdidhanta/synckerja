import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest, xenditRequestProbe } from "../xenditClient.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";

type SplitRuleResponse = {
  id?: string;
};

/** Platform flat fee — env override with DB fallback. */
export async function getPlatformFlatFee(
  admin: SupabaseClient,
  env: XenditEnvConfig,
): Promise<number> {
  const { data } = await admin
    .from("xendit_platform_config")
    .select("flat_fee_amount, split_rule_id")
    .eq("id", 1)
    .maybeSingle();
  if (data?.flat_fee_amount != null && Number.isFinite(Number(data.flat_fee_amount))) {
    return Math.max(0, Math.floor(Number(data.flat_fee_amount)));
  }
  return env.flatFeeAmount;
}

function extractSplitRuleId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const id = record.id ?? record.split_rule_id;
  if (id == null) return null;
  const trimmed = String(id).trim();
  return trimmed || null;
}

async function probeSplitRuleExists(
  env: XenditEnvConfig,
  splitRuleId: string,
): Promise<boolean> {
  const probe = await xenditRequestProbe(env.secretKey, {
    method: "GET",
    path: `/split_rules/${encodeURIComponent(splitRuleId)}`,
  });
  return probe.ok;
}

async function createXenditSplitRule(
  env: XenditEnvConfig,
  flatFeeAmount: number,
): Promise<string> {
  const body: Record<string, unknown> = {
    name: "synckerja_platform_flat_fee",
    description: `Synckerja platform flat fee Rp ${flatFeeAmount} per VA transaction`,
    routes: [
      {
        flat_amount: flatFeeAmount,
        currency: "IDR",
        reference_id: "synckerja_platform_fee",
      },
    ],
  };

  const res = await xenditRequest<SplitRuleResponse>(env.secretKey, {
    method: "POST",
    path: "/split_rules",
    idempotencyKey: `synckerja-split-flat-${flatFeeAmount}`,
    body,
  });

  const splitRuleId = extractSplitRuleId(res);
  if (!splitRuleId) {
    throw new Error("xendit_api: split rule created but response missing id");
  }
  return splitRuleId;
}

export async function ensureSplitRule(
  admin: SupabaseClient,
  env: XenditEnvConfig,
): Promise<{ flatFeeAmount: number; splitRuleId: string | null; ready: boolean }> {
  const flatFeeAmount = await getPlatformFlatFee(admin, env);
  const { data } = await admin
    .from("xendit_platform_config")
    .select("split_rule_id")
    .eq("id", 1)
    .maybeSingle();

  let splitRuleId = data?.split_rule_id != null ? String(data.split_rule_id).trim() : null;

  if (flatFeeAmount <= 0) {
    await admin.from("xendit_platform_config").upsert({
      id: 1,
      flat_fee_amount: flatFeeAmount,
      split_rule_id: splitRuleId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    return { flatFeeAmount, splitRuleId, ready: true };
  }

  if (splitRuleId) {
    const exists = await probeSplitRuleExists(env, splitRuleId);
    if (!exists) {
      console.warn(`xendit: stored split_rule_id ${splitRuleId} not found — recreating`);
      splitRuleId = null;
    }
  }

  if (!splitRuleId) {
    splitRuleId = await createXenditSplitRule(env, flatFeeAmount);
  }

  await admin.from("xendit_platform_config").upsert({
    id: 1,
    flat_fee_amount: flatFeeAmount,
    split_rule_id: splitRuleId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  return { flatFeeAmount, splitRuleId, ready: Boolean(splitRuleId) };
}

export async function requirePlatformSplitRule(
  admin: SupabaseClient,
  env: XenditEnvConfig,
): Promise<{ splitRuleId: string; flatFeeAmount: number }> {
  const { flatFeeAmount, splitRuleId, ready } = await ensureSplitRule(admin, env);

  if (flatFeeAmount <= 0) {
    return { splitRuleId: splitRuleId ?? "", flatFeeAmount: 0 };
  }

  if (!ready || !splitRuleId) {
    throw new Error(
      "xendit_platform_split_not_ready: Platform fee split rule is not configured. Contact your platform administrator.",
    );
  }

  return { splitRuleId, flatFeeAmount };
}
