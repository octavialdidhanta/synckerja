// deno-lint-ignore-file no-explicit-any
/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function envBool(name: string): boolean | undefined {
  const v = (Deno.env.get(name) ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

/** True when Snap + Core API calls should hit Midtrans sandbox hosts. */
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

/** e.g. https://app.sandbox.midtrans.com or https://app.midtrans.com (no path). */
function midtransSnapApiBaseUrl(): string {
  const override = (Deno.env.get("MIDTRANS_SNAP_API_BASE_URL") ?? "").trim().replace(/\/+$/, "");
  if (override) return override;
  return midtransIsSandbox() ? "https://app.sandbox.midtrans.com" : "https://app.midtrans.com";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** HR subscription row billing_cycle → omnichannel seat top-up RPC (ignore client tampering). */
function coerceOrgBillingCycle(raw: unknown): "monthly" | "yearly" {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "yearly" ? "yearly" : "monthly";
}

function coerceBillingTermMonths(raw: unknown, billingCycle?: string): number {
  const n = Number(raw);
  if (n === 1 || n === 3 || n === 6 || n === 12) return n;
  return billingCycle === "yearly" ? 12 : 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const requestBody = await req.json();
    const {
      planId,
      planName,
      amount,
      memberCount,
      billingCycle,
      billingTermMonths,
      proRateDetails,
      itemDetails,
      purchaseKind,
      additionalSeats,
      checkoutSuccessRelativePath,
    } = requestBody as {
      planId?: string;
      planName?: string;
      amount?: number;
      memberCount?: number;
      billingCycle?: string;
      billingTermMonths?: number;
      proRateDetails?: unknown;
      itemDetails?: Array<{ id?: string; name?: string; price?: number; quantity?: number }>;
      purchaseKind?: string;
      additionalSeats?: number;
      checkoutSuccessRelativePath?: string;
    };

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

    const orgId = profile.active_organization_id;
    /** Persisted on `payments.billing_cycle`; for omnichannel seat top-up, overridden from `organization_subscriptions`. */
    let billingCycleForPayment: "monthly" | "yearly" = coerceOrgBillingCycle(billingCycle);
    let billingTermMonthsForPayment = coerceBillingTermMonths(billingTermMonths, billingCycleForPayment);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 11);
    const orderId = `ORD-${timestamp}-${randomStr}`;

    let resolvedPlanId = planId;
    let resolvedPlanName = planName ?? "Subscription Plan";
    let resolvedMemberCount = memberCount;
    let resolvedProRate: unknown = proRateDetails;
    let resolvedItemDetails: Array<{ id?: string; name?: string; price?: number; quantity?: number }> | undefined =
      itemDetails;
    let grossAmount = Math.round(Number(amount));

    if (purchaseKind === "omnichannel_seats") {
      const seats = Math.round(Number(additionalSeats ?? 0));
      if (seats < 1 || !Number.isFinite(seats)) {
        throw new Error("additionalSeats must be a positive integer");
      }

      const { data: orgSubRow, error: orgSubErr } = await supabase
        .from("organization_subscriptions")
        .select("subscription_plan_id, billing_cycle")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (orgSubErr || !orgSubRow?.subscription_plan_id) {
        throw new Error("No subscription plan for organization");
      }
      const effectiveBillingCycle = coerceOrgBillingCycle(
        (orgSubRow as { billing_cycle?: unknown }).billing_cycle,
      );
      billingCycleForPayment = effectiveBillingCycle;

      const { data: expectedAmount, error: amtErr } = await supabase.rpc(
        "compute_omnichannel_seat_topup_amount_service",
        {
          p_org_id: orgId,
          p_additional_seats: seats,
          p_billing_cycle: effectiveBillingCycle,
          p_verified_user_id: user.id,
        },
      );
      if (amtErr) throw new Error(amtErr.message || "Could not compute seat purchase amount");
      const expected = Math.round(Number(expectedAmount));
      if (!Number.isFinite(expected) || expected <= 0) {
        throw new Error("Invalid computed amount for omnichannel seats");
      }
      if (amount != null && Number.isFinite(Number(amount))) {
        const clientAmt = Math.round(Number(amount));
        if (Math.abs(clientAmt - expected) > 2) {
          throw new Error("Payment amount does not match server price");
        }
      }
      grossAmount = expected;

      resolvedPlanId = orgSubRow.subscription_plan_id as string;
      resolvedPlanName = planName ?? "Omnichannel roster seats";
      resolvedMemberCount = seats;
      resolvedProRate = {
        purchase_kind: "omnichannel_seats",
        additional_seats: seats,
      };
      resolvedItemDetails = [
        {
          id: "omnichannel-seats",
          name: `${resolvedPlanName} — +${seats} seat (${effectiveBillingCycle})`,
          price: grossAmount,
          quantity: 1,
        },
      ];
    } else if (purchaseKind === "lead_magnet_addon") {
      const { data: orgSubRow, error: orgSubErr } = await supabase
        .from("organization_subscriptions")
        .select("subscription_plan_id, billing_cycle")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (orgSubErr || !orgSubRow?.subscription_plan_id) {
        throw new Error("No subscription plan for organization");
      }
      const effectiveBillingCycle = coerceOrgBillingCycle(
        (orgSubRow as { billing_cycle?: unknown }).billing_cycle,
      );
      billingCycleForPayment = effectiveBillingCycle;

      const { data: expectedAmount, error: amtErr } = await supabase.rpc(
        "compute_lead_magnet_addon_amount_service",
        {
          p_org_id: orgId,
          p_billing_cycle: effectiveBillingCycle,
          p_verified_user_id: user.id,
        },
      );
      if (amtErr) throw new Error(amtErr.message || "Could not compute lead magnet add-on amount");
      const expected = Math.round(Number(expectedAmount));
      if (!Number.isFinite(expected) || expected <= 0) {
        throw new Error("Invalid computed amount for lead magnet add-on");
      }
      if (amount != null && Number.isFinite(Number(amount))) {
        const clientAmt = Math.round(Number(amount));
        if (Math.abs(clientAmt - expected) > 2) {
          throw new Error("Payment amount does not match server price");
        }
      }
      grossAmount = expected;

      resolvedPlanId = orgSubRow.subscription_plan_id as string;
      resolvedPlanName = planName ?? "Lead Magnet add-on";
      resolvedMemberCount = 1;
      resolvedProRate = {
        purchase_kind: "lead_magnet_addon",
      };
      resolvedItemDetails = [
        {
          id: "lead-magnet-addon",
          name: `${resolvedPlanName} (${effectiveBillingCycle})`,
          price: grossAmount,
          quantity: 1,
        },
      ];
    } else {
      if (!planId || typeof planId !== "string") {
        throw new Error("planId is required");
      }
      if (memberCount == null || !Number.isFinite(Number(memberCount))) {
        throw new Error("memberCount is required");
      }
      if (billingCycle !== "monthly" && billingCycle !== "yearly") {
        throw new Error("billingCycle must be monthly or yearly");
      }
      billingCycleForPayment = billingCycle as "monthly" | "yearly";
      billingTermMonthsForPayment = coerceBillingTermMonths(billingTermMonths, billingCycleForPayment);
      if (grossAmount <= 0) {
        throw new Error(
          "Payment amount must be greater than 0. All payments must be processed through Midtrans.",
        );
      }
    }

    const serverKey = (Deno.env.get("MIDTRANS_SERVER_KEY") ?? "").trim();
    const _clientKey = (Deno.env.get("MIDTRANS_CLIENT_KEY") ?? "").trim();
    if (!serverKey || !_clientKey) {
      throw new Error("Midtrans credentials not configured");
    }

    // Safe diagnostics (no secrets): helps confirm env + host + key shape.
    const snapBaseUrl = midtransSnapApiBaseUrl();
    console.log("Midtrans env:", {
      isSandbox: midtransIsSandbox(),
      snapBaseUrl,
      serverKeyPrefix: `${serverKey.slice(0, 8)}…`,
      serverKeyLen: serverKey.length,
      clientKeyPrefix: `${_clientKey.slice(0, 8)}…`,
      clientKeyLen: _clientKey.length,
    });

    const paymentResult = await supabase
      .from("payments")
      .insert({
        order_id: orderId,
        user_id: user.id,
        organization_id: orgId,
        plan_id: resolvedPlanId,
        amount: grossAmount,
        member_count: resolvedMemberCount,
        billing_cycle: billingCycleForPayment,
        billing_term_months: billingTermMonthsForPayment,
        status: "pending",
        payment_type: "midtrans",
        prorate_details: resolvedProRate,
        omnichannel_seats_applied: false,
        bundled_omnichannel_units_applied: false,
        lead_magnet_applied: false,
        bundled_lead_magnet_applied: false,
        pos_outlets_applied: false,
        bundled_pos_outlets_applied: false,
        bundled_pos_addon_applied: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    const payment = paymentResult.data;
    if (paymentResult.error || !payment) {
      throw new Error(`Failed to create payment record: ${paymentResult.error?.message}`);
    }

    const planNameSafe = resolvedPlanName;
    const itemName = `${planNameSafe} - ${resolvedMemberCount} members (${billingTermMonthsForPayment} month${billingTermMonthsForPayment === 1 ? "" : "s"})`;

    const normalizedItemDetails = Array.isArray(resolvedItemDetails)
      ? resolvedItemDetails
          .map((row) => ({
            id: String(row?.id ?? "item"),
            name: String(row?.name ?? "Item"),
            price: Math.round(Number(row?.price ?? 0)),
            quantity: Math.max(1, Math.round(Number(row?.quantity ?? 1))),
          }))
          .filter((row) => row.price > 0 && row.quantity > 0)
      : [];
    const itemSum = normalizedItemDetails.reduce((acc, row) => acc + row.price * row.quantity, 0);
    const useSplitItems = normalizedItemDetails.length > 0 && itemSum === grossAmount;

    const customerFirstName =
      (user.user_metadata as Record<string, string>)?.full_name ??
      user.email?.split("@")[0] ??
      "User";

    // Default matches legacy create-midtrans-payment (prod) when APP_BASE_URL is unset in Supabase secrets.
    const appBaseUrl = (Deno.env.get("APP_BASE_URL") ?? "https://app.profitloop.id").replace(/\/+$/g, "");
    const successPath =
      typeof checkoutSuccessRelativePath === "string" && checkoutSuccessRelativePath.startsWith("/")
        ? checkoutSuccessRelativePath
        : "/subscription/overview";
    const successUrl = `${appBaseUrl}${successPath}`;
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
      item_details: useSplitItems
        ? normalizedItemDetails
        : [
            {
              id: resolvedPlanId,
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
      if (midtransResponse.status === 401) {
        throw new Error(
          `Midtrans API error (401): ${errorText}\n` +
            "Hint: use MIDTRANS_SERVER_KEY (Server Key), not the Client Key. If sandbox keys look like Mid-server-…, set secret MIDTRANS_USE_SANDBOX=true " +
            "(or legacy SB-Mid-server-… keys auto-detect sandbox). Match dashboard environment; trim secrets (no quotes/spaces).",
        );
      }
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
    const msg = err.message ?? String(error);
    console.error("ERROR:", msg);

    /** Helps dashboards distinguish user/input errors from infra/upstream (still returns JSON body). */
    const status = (() => {
      if (
        msg.includes("Authorization header missing") ||
        msg.includes("Authentication failed") ||
        msg.includes("No active organization") ||
        msg.includes("planId is required") ||
        msg.includes("memberCount is required") ||
        msg.includes("billingCycle must be") ||
        msg.includes("Payment amount must be greater than 0") ||
        msg.includes("Payment amount does not match") ||
        msg.includes("additionalSeats must be") ||
        msg.includes("Invalid computed amount") ||
        msg.includes("No subscription plan for organization") ||
        msg.includes("violates foreign key constraint") ||
        msg.includes("Could not compute seat purchase amount")
      ) {
        return 400;
      }
      if (msg.startsWith("Midtrans API error")) return 502;
      if (msg.includes("Midtrans credentials not configured")) return 503;
      return 500;
    })();

    const body: Record<string, unknown> = {
      error: "Payment creation failed",
      message: msg,
    };
    if (status >= 500) {
      body.details = err.stack;
    }

    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
