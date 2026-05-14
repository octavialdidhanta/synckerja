// deno-lint-ignore-file no-explicit-any
/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Inlined (hosted bundle sometimes omits sibling `midtransEnv.ts`). Same logic as other Midtrans edge functions. */
function envBool(name: string): boolean | undefined {
  const v = (Deno.env.get(name) ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

function midtransIsSandbox(): boolean {
  const envName = (Deno.env.get("MIDTRANS_ENV") ?? "").trim().toLowerCase();
  if (envName === "sandbox" || envName === "dev" || envName === "development") return true;
  if (envName === "production" || envName === "prod") return false;

  const explicit = envBool("MIDTRANS_USE_SANDBOX");
  if (explicit !== undefined) return explicit;

  const serverKey = (Deno.env.get("MIDTRANS_SERVER_KEY") ?? "").trim();
  if (serverKey.startsWith("SB-Mid-")) return true;

  return false;
}

function midtransCoreApiBaseUrl(): string {
  const override = (Deno.env.get("MIDTRANS_CORE_API_BASE_URL") ?? "").trim().replace(/\/+$/, "");
  if (override) return override;
  return midtransIsSandbox() ? "https://api.sandbox.midtrans.com" : "https://api.midtrans.com";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Poll Midtrans Core API for transaction status, then forward the payload to
 * `process-midtrans-payment` so subscription + omnichannel seat entitlement stay
 * in one code path (same as HTTP notification webhook).
 *
 * Previously this function duplicated only part of `process-midtrans-payment` and
 * skipped `purchase_kind: omnichannel_seats`, so paid omnichannel seats stayed at 0.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { order_id } = await req.json();
    if (!order_id) {
      throw new Error("Missing order_id");
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, order_id")
      .eq("order_id", order_id)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found for order_id: ${order_id}`);
    }

    const serverKey = (Deno.env.get("MIDTRANS_SERVER_KEY") ?? "").trim();
    if (!serverKey) {
      throw new Error("MIDTRANS_SERVER_KEY not configured");
    }

    const baseUrl = midtransCoreApiBaseUrl();
    const authString = btoa(`${serverKey}:`);
    const midtransResponse = await fetch(`${baseUrl}/v2/${order_id}/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authString}`,
        Accept: "application/json",
      },
    });

    if (!midtransResponse.ok) {
      const errorText = await midtransResponse.text();
      throw new Error(`Midtrans API error (${midtransResponse.status}): ${errorText}`);
    }

    const raw = (await midtransResponse.json()) as Record<string, unknown>;
    /** Core API status shape matches HTTP notification fields `process-midtrans-payment` expects; ensure order_id is present. */
    const notification = {
      ...raw,
      order_id: raw.order_id != null ? String(raw.order_id) : order_id,
    };

    const processorUrl = `${supabaseUrl}/functions/v1/process-midtrans-payment`;
    const forward = await fetch(processorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify(notification),
    });

    const bodyText = await forward.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      /* ignore */
    }

    const transaction_status =
      typeof notification["transaction_status"] === "string" ? notification["transaction_status"] : "";

    let finalStatus = "pending";
    if (
      transaction_status === "settlement" ||
      transaction_status === "capture" ||
      transaction_status === "success"
    ) {
      finalStatus = "success";
    } else if (transaction_status === "pending") {
      finalStatus = "pending";
    } else if (
      transaction_status === "cancel" ||
      transaction_status === "expire" ||
      transaction_status === "deny"
    ) {
      finalStatus = "failed";
    }

    if (!forward.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: parsed?.error ?? "process-midtrans-payment failed",
          message: parsed?.message ?? bodyText,
          status: finalStatus,
          transaction_status,
        }),
        { status: forward.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment status checked and updated",
        status: finalStatus,
        transaction_status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const err = error as Error;
    console.error("Error checking payment status:", err);
    return new Response(
      JSON.stringify({ error: "Failed to check payment status", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
