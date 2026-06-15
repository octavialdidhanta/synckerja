import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readBrickEnv } from "../../_shared/brick/brickApi.ts";
import { brickJson, recordBrickDisburseRateLimit } from "../brickAuth.ts";
import { executeTenantBrickDisbursement } from "../../_shared/brick/services/executeBrickDisbursement.ts";

export async function handleBrickExecuteDisbursement(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const organizationId = String(body.organizationId ?? "");
  const env = readBrickEnv();
  if (!env) {
    return brickJson({
      error: "Brick is not configured. Set BRICK_CLIENT_ID and BRICK_CLIENT_SECRET (or BRICK_USE_MOCK=true).",
    }, 503);
  }

  try {
    const result = await executeTenantBrickDisbursement(admin, env, organizationId, userId, body);
    await recordBrickDisburseRateLimit(admin, organizationId);
    return brickJson({
      ok: true,
      processed: result.processed,
      failed: result.failed,
      disbursements: result.rows,
    }, 200);
  } catch (e) {
    const message = humanizeBrickDisbursementError(e instanceof Error ? e.message : "Disbursement failed");
    return brickJson({ error: message }, 400);
  }
}

function humanizeBrickDisbursementError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("upstream server") || lower.includes("service is not available")) {
    return "Brick sandbox tidak merespons (upstream error). Tunggu 1–2 menit lalu coba lagi. Pastikan saldo Brick sandbox cukup, rekening tujuan MANDIRI 12345678 / PROD ONLY, nominal kecil (mis. Rp 10.000).";
  }
  if (lower.includes("insufficient") || lower.includes("balance")) {
    return "Saldo Brick sandbox tidak cukup. Top up saldo di Brick Dashboard lalu coba lagi.";
  }
  return message;
}
