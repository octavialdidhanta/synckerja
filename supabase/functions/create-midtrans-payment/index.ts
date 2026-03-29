// deno-lint-ignore-file no-explicit-any
/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const requestBody = await req.json();
    const { planId, planName, amount, memberCount, billingCycle, proRateDetails } = requestBody;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Authorization header missing");

    const authResult = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = authResult.data.user;
    if (authResult.error || !user) {
      throw new Error(`Authentication failed: ${authResult.error?.message ?? "No user"}`);
    }

    const profileResult = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    const profile = profileResult.data;
    if (profileResult.error || !profile?.active_organization_id) {
      throw new Error("No active organization found");
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 11);
    const orderId = `ORD-${timestamp}-${randomStr}`;
    const grossAmount = Math.round(Number(amount));

    if (grossAmount <= 0) {
      throw new Error(
        "Payment amount must be greater than 0. All payments must be processed through Midtrans.",
      );
    }

    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    const _clientKey = Deno.env.get("MIDTRANS_CLIENT_KEY");
    if (!serverKey || !_clientKey) {
      throw new Error("Midtrans credentials not configured");
    }

    const paymentResult = await supabase
      .from("payments")
      .insert({
        order_id: orderId,
        user_id: user.id,
        organization_id: profile.active_organization_id,
        plan_id: planId,
        amount: grossAmount,
        member_count: memberCount,
        billing_cycle: billingCycle,
        status: "pending",
        payment_type: "midtrans",
        prorate_details: proRateDetails,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    const payment = paymentResult.data;
    if (paymentResult.error || !payment) {
      throw new Error(`Failed to create payment record: ${paymentResult.error?.message}`);
    }

    const planNameSafe = planName ?? "Subscription Plan";
    const itemName = `${planNameSafe} - ${memberCount} members (${billingCycle})`;
    const customerFirstName =
      (user.user_metadata as Record<string, string>)?.full_name ??
      user.email?.split("@")[0] ??
      "User";

    const appBaseUrl = (Deno.env.get("APP_BASE_URL") ?? "http://localhost:5173").replace(/\/+$/g, "");
    const successUrl = `${appBaseUrl}/subscription/overview`;
    const fallbackUrl = `${appBaseUrl}/subscription/plans`;

    const midtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      credit_card: {
        secure: true,
      },
      enabled_payments: [
        "credit_card",
        "gopay",
        "bca_va",
        "bni_va",
        "bri_va",
        "echannel",
        "permata_va",
        "other_va",
      ],
      gopay: {
        enable_callback: true,
        callback_url: fallbackUrl,
      },
      customer_details: {
        email: user.email,
        first_name: customerFirstName,
        phone: (user.user_metadata as Record<string, string>)?.phone ?? "+628123456789",
      },
      item_details: [
        {
          id: planId,
          price: grossAmount,
          quantity: 1,
          name: itemName,
        },
      ],
      callbacks: {
        finish: successUrl,
        unfinish: fallbackUrl,
        error: fallbackUrl,
      },
    };

    const webhookUrl = supabaseUrl ? `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/midtrans-webhook` : "";
    if (webhookUrl) {
      console.log("Midtrans Notification URL (Dashboard):", webhookUrl);
    }

    const isSandbox = serverKey.startsWith("SB-Mid-");
    const snapBaseUrl = isSandbox ? "https://app.sandbox.midtrans.com" : "https://app.midtrans.com";
    const authString = btoa(`${serverKey}:`);
    const midtransResponse = await fetch(`${snapBaseUrl}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authString}`,
        Accept: "application/json",
      },
      body: JSON.stringify(midtransPayload),
    });

    if (!midtransResponse.ok) {
      const errorText = await midtransResponse.text();
      await supabase.from("payments").delete().eq("id", payment.id);
      throw new Error(`Midtrans API error (${midtransResponse.status}): ${errorText}`);
    }

    const midtransResult = await midtransResponse.json();

    await supabase
      .from("payments")
      .update({
        midtrans_token: midtransResult.token,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({
        token: midtransResult.token,
        order_id: orderId,
        redirect_url: midtransResult.redirect_url,
        debug_info: {
          requested_payments: midtransPayload.enabled_payments,
          midtrans_response: midtransResult,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const err = error as Error;
    console.error("ERROR:", err.message);
    return new Response(
      JSON.stringify({
        error: "Payment creation failed",
        message: err.message,
        details: err.stack,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
