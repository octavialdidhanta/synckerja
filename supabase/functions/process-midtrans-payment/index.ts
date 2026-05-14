/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addMonths, addYears } from "https://esm.sh/date-fns@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const addBillingInterval = (baseDate: Date, billingCycle: string): Date => {
  if (billingCycle === "yearly") {
    return addYears(baseDate, 1);
  }
  return addMonths(baseDate, 1);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const notification = await req.json();
    const {
      order_id,
      transaction_status,
      transaction_id,
      fraud_status,
      settlement_time,
      transaction_time,
      payment_type,
      bank,
      approval_code,
    } = notification;

    if (!order_id) {
      throw new Error("Missing order_id in notification");
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", order_id)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found for order_id: ${order_id}`);
    }

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

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: finalStatus,
        transaction_id,
        fraud_status,
        settlement_time,
        transaction_time,
        payment_type,
        bank,
        approval_code,
        webhook_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (updateError) {
      throw new Error("Failed to update payment status");
    }

    if (finalStatus === "success") {
      const prorateDetails = payment.prorate_details as {
        is_member_upgrade?: boolean;
        purchase_kind?: string;
        additional_seats?: number;
      } | null;

      const isOmnichannelSeatPurchase = prorateDetails?.purchase_kind === "omnichannel_seats";

      if (isOmnichannelSeatPurchase) {
        const alreadyApplied = (payment as { omnichannel_seats_applied?: boolean }).omnichannel_seats_applied === true;
        if (!alreadyApplied) {
          const delta = Math.round(
            Number(prorateDetails?.additional_seats ?? payment.member_count ?? 0),
          );
          if (delta > 0) {
            const { data: claimedRows } = await supabase
              .from("payments")
              .update({ omnichannel_seats_applied: true })
              .eq("id", payment.id)
              .eq("omnichannel_seats_applied", false)
              .select("id");

            if (claimedRows && claimedRows.length > 0) {
              const { data: curSub } = await supabase
                .from("organization_subscriptions")
                .select("omnichannel_paid_seat_count")
                .eq("organization_id", payment.organization_id)
                .maybeSingle();

              const cur = Number((curSub as { omnichannel_paid_seat_count?: number } | null)?.omnichannel_paid_seat_count ?? 0);
              await supabase
                .from("organization_subscriptions")
                .update({
                  omnichannel_paid_seat_count: cur + delta,
                  last_payment_id: payment.id,
                  updated_at: new Date().toISOString(),
                })
                .eq("organization_id", payment.organization_id);
            }
          }
        }
      } else {
        const isMemberUpgradeOnly = prorateDetails?.is_member_upgrade === true;

        const { data: existingSubscription } = await supabase
          .from("organization_subscriptions")
          .select("id, subscription_start_date, subscription_end_date")
          .eq("organization_id", payment.organization_id)
          .maybeSingle();

        if (existingSubscription && isMemberUpgradeOnly) {
          await supabase
            .from("organization_subscriptions")
            .update({
              subscription_plan_id: payment.plan_id,
              member_count: payment.member_count,
              last_payment_id: payment.id,
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", payment.organization_id);

          await supabase
            .from("payments")
            .update({
              subscription_start_date: existingSubscription.subscription_start_date,
              subscription_end_date: existingSubscription.subscription_end_date,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id);
        } else {
          const baseStartDate = existingSubscription?.subscription_end_date
            ? new Date(existingSubscription.subscription_end_date as string)
            : new Date(payment.created_at as string);

          const startDate = baseStartDate;
          const endDate = addBillingInterval(startDate, payment.billing_cycle as string);

          if (existingSubscription) {
            await supabase
              .from("organization_subscriptions")
              .update({
                subscription_plan_id: payment.plan_id,
                member_count: payment.member_count,
                billing_cycle: payment.billing_cycle,
                status: "active",
                subscription_start_date: startDate.toISOString(),
                subscription_end_date: endDate.toISOString(),
                last_payment_id: payment.id,
                is_trial: false,
                trial_start_date: null,
                trial_end_date: null,
                updated_at: new Date().toISOString(),
              })
              .eq("organization_id", payment.organization_id);
          } else {
            await supabase.from("organization_subscriptions").insert({
              organization_id: payment.organization_id,
              subscription_plan_id: payment.plan_id,
              status: "active",
              subscription_start_date: startDate.toISOString(),
              subscription_end_date: endDate.toISOString(),
              member_count: payment.member_count,
              billing_cycle: payment.billing_cycle,
              last_payment_id: payment.id,
              is_trial: false,
            });
          }

          await supabase
            .from("payments")
            .update({
              subscription_start_date: startDate.toISOString(),
              subscription_end_date: endDate.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id);
        }

        await supabase
          .from("organizations")
          .update({
            has_active_subscription: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.organization_id);

        const prorateForBundled = payment.prorate_details as { bundled_omnichannel_roster_units?: number | string } | null;
        const rawBundled = prorateForBundled?.bundled_omnichannel_roster_units;
        const bundledUnits =
          typeof rawBundled === "number" && Number.isFinite(rawBundled)
            ? Math.round(rawBundled)
            : typeof rawBundled === "string" && rawBundled.trim() !== ""
              ? Math.round(Number(rawBundled))
              : 0;

        if (bundledUnits > 0) {
          const alreadyBundled =
            (payment as { bundled_omnichannel_units_applied?: boolean }).bundled_omnichannel_units_applied === true;
          if (!alreadyBundled) {
            const { data: claimedBundled } = await supabase
              .from("payments")
              .update({ bundled_omnichannel_units_applied: true })
              .eq("id", payment.id)
              .eq("bundled_omnichannel_units_applied", false)
              .select("id");

            if (claimedBundled && claimedBundled.length > 0) {
              const memberCap = Math.max(0, Math.round(Number(payment.member_count ?? 0)));
              const targetPaid = Math.min(memberCap, bundledUnits);
              const { data: subPaid } = await supabase
                .from("organization_subscriptions")
                .select("omnichannel_paid_seat_count")
                .eq("organization_id", payment.organization_id)
                .maybeSingle();
              const curPaid = Number(
                (subPaid as { omnichannel_paid_seat_count?: number } | null)?.omnichannel_paid_seat_count ?? 0,
              );
              const nextPaid = Math.max(curPaid, targetPaid);
              await supabase
                .from("organization_subscriptions")
                .update({
                  omnichannel_paid_seat_count: nextPaid,
                  last_payment_id: payment.id,
                  updated_at: new Date().toISOString(),
                })
                .eq("organization_id", payment.organization_id);
            }
          }
        }

        const { data: employeesToRemove, error: employeesError } = await supabase
          .from("employees")
          .select("id, full_name, email")
          .eq("organization_id", payment.organization_id)
          .eq("pending_removal", true);

        if (!employeesError && employeesToRemove && employeesToRemove.length > 0) {
          const employeeIds = employeesToRemove.map((emp) => emp.id);
          await supabase
            .from("employees")
            .update({
              status: "terminated",
              pending_removal: false,
              pending_removal_reason: null,
              pending_removal_date: null,
              updated_at: new Date().toISOString(),
            })
            .in("id", employeeIds)
            .eq("organization_id", payment.organization_id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Webhook processed successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const err = error as Error;
    console.error("Webhook processing error:", err);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
