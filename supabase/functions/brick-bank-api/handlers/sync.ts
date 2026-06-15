import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readBrickEnv } from "../brickApi.ts";
import { brickJson } from "../brickAuth.ts";
import { handleBrickSyncAggregation } from "./syncAggregation.ts";

/**
 * Sync entry point: OAuth aggregation for linked bank accounts + credit cards,
 * plus VA/disburse polls and platform wallet snapshot.
 */
export async function handleBrickBankSync(
  admin: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const organizationId = String(body.organizationId ?? "");
  const env = readBrickEnv();
  if (!env) {
    return brickJson({
      error: "Brick is not configured. Set BRICK_CLIENT_ID and BRICK_CLIENT_SECRET (or BRICK_USE_MOCK=true).",
    }, 503);
  }

  return handleBrickSyncAggregation(admin, body);
}
