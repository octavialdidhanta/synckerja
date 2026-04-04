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
      .select("id, organization_id, status")
      .eq("order_id", order_id)
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ success: false, error: "Payment not found", message: "Payment not found for this order" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payment.organization_id !== profile.active_organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden", message: "Payment does not belong to your organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payment.status !== "pending") {
      return new Response(
        JSON.stringify({ success: false, error: "Bad request", message: "Only pending payments can be cancelled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!serverKey) {
      throw new Error("MIDTRANS_SERVER_KEY not configured");
    }

    const isSandbox = serverKey.startsWith("SB-Mid-");
    const baseUrl = isSandbox ? "https://api.sandbox.midtrans.com" : "https://api.midtrans.com";
    const authString = btoa(`${serverKey}:`);

    const cancelResponse = await fetch(`${baseUrl}/v2/${order_id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authString}`,
        Accept: "application/json",
      },
    });

    if (!cancelResponse.ok) {
      const errText = await cancelResponse.text();
      console.warn("Midtrans cancel returned:", cancelResponse.status, errText);
      // 412 = merchant cannot modify; still delete from DB so UI is consistent
    }

    const { error: deleteError } = await supabase
      .from("payments")
      .delete()
      .eq("order_id", order_id)
      .eq("organization_id", profile.active_organization_id)
      .eq("status", "pending");

    if (deleteError) {
      console.error("Delete payment error:", deleteError);
      throw new Error("Failed to delete payment record");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("cancel-pending-payment error:", (error as Error).message);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Payment cancellation failed",
        message: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
