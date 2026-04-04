/// <reference path="../edge-runtime.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const notification = await req.json();
    console.log("🔔 Midtrans webhook received:", notification);

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

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", order_id)
      .single();

    if (paymentError || !payment) {
      console.error("❌ Payment not found:", paymentError);
      throw new Error(`Payment not found for order_id: ${order_id}`);
    }

    // Determine final status
    // Accept "success" from frontend sync (useMidtransPayment onSuccess) in addition to Midtrans webhook values
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

    console.log(`🔄 Updating payment ${payment.id} status from ${payment.status} to ${finalStatus}`);

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
      console.error("❌ Failed to update payment:", updateError);
      throw new Error("Failed to update payment status");
    }

    if (finalStatus === "success") {
      console.log("✅ Payment successful, activating subscription...");

      const prorateDetails = payment.prorate_details as { is_member_upgrade?: boolean } | null;
      const isMemberUpgradeOnly = prorateDetails?.is_member_upgrade === true;

      const { data: existingSubscription } = await supabase
        .from("organization_subscriptions")
        .select("id, subscription_start_date, subscription_end_date")
        .eq("organization_id", payment.organization_id)
        .maybeSingle();

      if (existingSubscription && isMemberUpgradeOnly) {
        // Member increase only: user paid prorate for additional members until next billing.
        // Only update member_count and plan_id; do NOT extend subscription_end_date.
        console.log("📋 Member upgrade only - updating member count without extending subscription");
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
          ? new Date(existingSubscription.subscription_end_date)
          : new Date(payment.created_at);

        const startDate = baseStartDate;
        const endDate = addBillingInterval(startDate, payment.billing_cycle);

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

      console.log("✅ Subscription activated successfully");

      // Process employee removals if any employees are marked for removal
      console.log("🔍 Checking for employees marked for removal...");
      const { data: employeesToRemove, error: employeesError } = await supabase
        .from("employees")
        .select("id, full_name, email")
        .eq("organization_id", payment.organization_id)
        .eq("pending_removal", true);

      if (employeesError) {
        console.error("❌ Error fetching employees for removal:", employeesError);
        // Don't throw - continue even if we can't process removals
      } else if (employeesToRemove && employeesToRemove.length > 0) {
        console.log(`🗑️ Processing removal of ${employeesToRemove.length} employee(s)...`);
        
        const employeeIds = employeesToRemove.map(emp => emp.id);
        
        // Update employee status to terminated and clear pending removal flags
        const { error: updateEmployeesError } = await supabase
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

        if (updateEmployeesError) {
          console.error("❌ Error updating employee status:", updateEmployeesError);
          // Don't throw - log error but continue
        } else {
          console.log(`✅ Successfully removed ${employeesToRemove.length} employee(s) from organization`);
          employeesToRemove.forEach(emp => {
            console.log(`   - Removed: ${emp.full_name} (${emp.email})`);
          });
        }
      } else {
        console.log("ℹ️ No employees marked for removal");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
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
    console.error("❌ Webhook processing error:", error);
    return new Response(
      JSON.stringify({
        error: "Webhook processing failed",
        message: (error as Error).message,
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


