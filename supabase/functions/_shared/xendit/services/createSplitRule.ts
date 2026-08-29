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

function splitRuleRoutesValid(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const routes = (body as Record<string, unknown>).routes;
  if (!Array.isArray(routes) || routes.length === 0) return false;
  return routes.every((route) => {
    if (!route || typeof route !== "object") return false;
    const destination = String((route as Record<string, unknown>).destination_account_id ?? "").trim();
    const referenceId = String((route as Record<string, unknown>).reference_id ?? "").trim();
    return Boolean(destination) && /^[a-zA-Z0-9 ]+$/.test(referenceId);
  });
}

export async function resolvePlatformBusinessId(
  admin: SupabaseClient,
  env: XenditEnvConfig,
): Promise<string> {
  const envId = Deno.env.get("XENDIT_PLATFORM_BUSINESS_ID")?.trim();
  if (envId) return envId;

  const { data } = await admin
    .from("xendit_platform_config")
    .select("master_account_id")
    .eq("id", 1)
    .maybeSingle();
  const stored = data?.master_account_id != null ? String(data.master_account_id).trim() : "";
  if (stored) return stored;

  throw new Error(
    "xendit_platform_business_id_missing: Set XENDIT_PLATFORM_BUSINESS_ID in Supabase secrets (Master Business ID from Xendit Dashboard).",
  );
}

async function probeSplitRuleExists(
  env: XenditEnvConfig,
  splitRuleId: string,
): Promise<{ ok: boolean; body: unknown }> {
  const probe = await xenditRequestProbe(env.secretKey, {
    method: "GET",
    path: `/split_rules/${encodeURIComponent(splitRuleId)}`,
  });
  return { ok: probe.ok, body: probe.body };
}

async function createXenditSplitRule(
  env: XenditEnvConfig,
  flatFeeAmount: number,
  destinationAccountId: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    name: "synckerja_platform_flat_fee",
    description: `Synckerja platform flat fee Rp ${flatFeeAmount} per transaction`,
    routes: [
      {
        flat_amount: flatFeeAmount,
        currency: "IDR",
        destination_account_id: destinationAccountId,
        reference_id: "synckerjaPlatformFee",
      },
    ],
  };

  const res = await xenditRequest<SplitRuleResponse>(env.secretKey, {
    method: "POST",
    path: "/split_rules",
    idempotencyKey: `synckerja-split-flat-v2-${flatFeeAmount}`,
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
    const probe = await probeSplitRuleExists(env, splitRuleId);
    if (!probe.ok || !splitRuleRoutesValid(probe.body)) {
      console.warn(`xendit: stored split_rule_id ${splitRuleId} invalid or outdated — recreating`);
      splitRuleId = null;
    }
  }

  if (!splitRuleId) {
    const destinationAccountId = await resolvePlatformBusinessId(admin, env);
    splitRuleId = await createXenditSplitRule(env, flatFeeAmount, destinationAccountId);
    await admin.from("xendit_platform_config").upsert({
      id: 1,
      master_account_id: destinationAccountId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
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
