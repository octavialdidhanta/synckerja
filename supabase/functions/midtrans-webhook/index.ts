/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Public Midtrans HTTP notification URL. Verifies SHA512 signature, then forwards
 * the JSON body to `process-midtrans-payment` (single source of truth for DB updates).
 *
 * Set `MIDTRANS_WEBHOOK_SKIP_SIGNATURE=true` only for local/dashboard experiments
 * where Midtrans does not send a valid signature_key.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  receivedSignature: string,
  serverKey: string,
): Promise<boolean> {
  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-512", encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expected = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === receivedSignature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error", message: "Missing Supabase env" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const notification = (await req.json()) as Record<string, unknown>;
    const orderId = notification.order_id != null ? String(notification.order_id) : "";
    const statusCode = notification.status_code != null ? String(notification.status_code) : "";
    const grossAmount = notification.gross_amount != null ? String(notification.gross_amount) : "";
    const signatureKey =
      notification.signature_key != null ? String(notification.signature_key) : "";

    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY") ?? "";
    if (!serverKey) {
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
          message: "MIDTRANS_SERVER_KEY is not configured",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const skipSignature = Deno.env.get("MIDTRANS_WEBHOOK_SKIP_SIGNATURE") === "true";
    if (!skipSignature) {
      if (!signatureKey) {
        return new Response(JSON.stringify({ error: "Missing signature_key" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifyMidtransSignature(
        orderId,
        statusCode,
        grossAmount,
        signatureKey,
        serverKey,
      );
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
    return new Response(bodyText, {
      status: forward.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const err = error as Error;
    console.error("midtrans-webhook error:", err.message);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: err.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
