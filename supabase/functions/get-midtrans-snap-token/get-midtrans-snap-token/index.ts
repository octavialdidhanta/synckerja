// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    const { order_id } = await req.json();
    if (!order_id || typeof order_id !== "string") {
      throw new Error("Missing or invalid order_id");
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(
        `
        id,
        order_id,
        amount,
        plan_id,
        member_count,
        billing_cycle,
        organization_id,
        status,
        subscription_plans (
          id,
          name
        )
      `,
      )
      .eq("order_id", order_id)
      .eq("organization_id", profile.active_organization_id)
      .eq("status", "pending")
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: "Payment not found", message: "No pending payment found for this order" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const grossAmount = Math.round(Number(payment.amount) || 0);
    if (grossAmount <= 0) {
      throw new Error("Invalid payment amount");
    }

    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!serverKey) {
      throw new Error("MIDTRANS_SERVER_KEY not configured");
    }

    const planName =
      (payment.subscription_plans as { name?: string } | null)?.name ?? "Subscription Plan";
    const memberCount = Number(payment.member_count) || 1;
    const billingCycle = payment.billing_cycle ?? "monthly";
    const planId = payment.plan_id ?? "plan";
    const itemName = `${planName} - ${memberCount} members (${billingCycle})`;
    const customerFirstName =
      user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";

    const appBaseUrl = (Deno.env.get("APP_BASE_URL") ?? "https://app.profitloop.id").replace(
      /\/+$/g,
      "",
    );
    const successUrl = `${appBaseUrl}/subscription/overview`;
    const fallbackUrl = `${appBaseUrl}/subscription/plans`;

    const midtransPayload = {
      transaction_details: {
        order_id: payment.order_id,
        gross_amount: grossAmount,
      },
      credit_card: { secure: true },
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
      gopay: { enable_callback: true, callback_url: fallbackUrl },
      customer_details: {
        email: user.email,
        first_name: customerFirstName,
        phone: user.user_metadata?.phone ?? "+628123456789",
      },
      item_details: [
        { id: planId, price: grossAmount, quantity: 1, name: itemName },
      ],
      callbacks: {
        finish: successUrl,
        unfinish: fallbackUrl,
        error: fallbackUrl,
      },
    };

    const isSandbox = serverKey.startsWith("SB-Mid-");
    const snapBaseUrl = isSandbox
      ? "https://app.sandbox.midtrans.com"
      : "https://app.midtrans.com";
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
      console.error("Midtrans Snap error:", midtransResponse.status, errorText);
      throw new Error(
        `Midtrans API error (${midtransResponse.status}). You may need to create a new payment instead.`,
      );
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
        order_id: payment.order_id,
        redirect_url: midtransResult.redirect_url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("get-midtrans-snap-token error:", (error as Error).message);
    return new Response(
      JSON.stringify({
        error: "Failed to get payment token",
        message: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
