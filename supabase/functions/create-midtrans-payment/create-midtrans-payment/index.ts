// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const addBillingInterval = (baseDate: Date, billingCycle: string) => {
  const result = new Date(baseDate);
  if (billingCycle === "yearly") {
    result.setFullYear(result.getFullYear() + 1);
  } else {
    result.setMonth(result.getMonth() + 1);
  }
  return result;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Payment creation started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const requestBody = await req.json();
    console.log("Request data:", requestBody);

    const { planId, planName, amount, memberCount, billingCycle, proRateDetails } = requestBody;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Authorization header missing");

    const authResult = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = authResult.data.user;
    if (authResult.error || !user) {
      console.error("Auth error:", authResult.error);
      throw new Error(`Authentication failed: ${authResult.error?.message ?? "No user"}`);
    }
    console.log("User authenticated:", user.email);

    const profileResult = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    const profile = profileResult.data;
    if (profileResult.error || !profile?.active_organization_id) {
      console.error("Profile error:", profileResult.error);
      throw new Error("No active organization found");
    }
    console.log("Organization found:", profile.active_organization_id);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const orderId = `ORD-${timestamp}-${randomStr}`;
    const grossAmount = Math.round(amount);
    console.log("Order details:", { orderId, grossAmount });

    // All payments must go through Midtrans - reject zero amount payments
    if (grossAmount <= 0) {
      console.error("❌ Zero or negative amount not allowed - all payments must go through Midtrans");
      throw new Error("Payment amount must be greater than 0. All payments must be processed through Midtrans.");
    }

    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    const clientKey = Deno.env.get("MIDTRANS_CLIENT_KEY");
    if (!serverKey || !clientKey) {
      console.error("Midtrans credentials missing");
      throw new Error("Midtrans credentials not configured");
    }
    console.log("Midtrans credentials found");

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
      console.error("Payment record error:", paymentResult.error);
      throw new Error(`Failed to create payment record: ${paymentResult.error?.message}`);
    }
    console.log("Payment record created:", payment.id);

    const planNameSafe = planName ?? "Subscription Plan";
    const itemName = `${planNameSafe} - ${memberCount} members (${billingCycle})`;
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
        phone: user.user_metadata?.phone ?? "+628123456789",
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

    const webhookUrl = supabaseUrl ? `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/process-midtrans-payment` : "";
    if (webhookUrl) {
      console.log("Configure this Notification URL in Midtrans Dashboard (Settings > Config):", webhookUrl);
    }

    console.log("=== MIDTRANS REQUEST DEBUG ===");
    console.log("Enabled payments:", JSON.stringify(midtransPayload.enabled_payments));
    console.log("GoPay config:", JSON.stringify(midtransPayload.gopay));
    console.log("Callback URLs:", midtransPayload.callbacks);

    const authString = btoa(`${serverKey}:`);
    const midtransResponse = await fetch("https://app.midtrans.com/snap/v1/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authString}`,
        Accept: "application/json",
      },
      body: JSON.stringify(midtransPayload),
    });

    console.log("Midtrans response status:", midtransResponse.status);
    if (!midtransResponse.ok) {
      const errorText = await midtransResponse.text();
      console.error("Midtrans error:", errorText);
      await supabase.from("payments").delete().eq("id", payment.id);
      throw new Error(`Midtrans API error (${midtransResponse.status}): ${errorText}`);
    }

    const midtransResult = await midtransResponse.json();
    console.log("=== MIDTRANS RESPONSE DEBUG ===");
    console.log("Full response:", JSON.stringify(midtransResult));

    await supabase
      .from("payments")
      .update({
        midtrans_token: midtransResult.token,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    console.log("Payment creation completed successfully");

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
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("ERROR:", (error as Error).message);
    console.error("STACK:", (error as Error).stack);
    return new Response(
      JSON.stringify({
        error: "Payment creation failed",
        message: (error as Error).message,
        details: (error as Error).stack,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});

