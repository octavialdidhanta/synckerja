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
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Authorization header missing");
    const token = authHeader.replace("Bearer ", "");
    const userRes = await supabase.auth.getUser(token);
    if (userRes.error || !userRes.data.user) throw new Error("Unauthorized");

    const payload = await req.json();
    const { contentPost, paymentTermsData } = payload ?? {};
    if (!contentPost?.organization_id || !contentPost?.campaign_id || !contentPost?.kol_profile_id) {
      throw new Error("Invalid payload");
    }

    const { data: deliverable, error: deliverableError } = await supabase
      .from("kol_campaign_deliverables")
      .insert({
        campaign_id: contentPost.campaign_id,
        kol_profile_id: contentPost.kol_profile_id,
        deliverable_type: contentPost.content_type,
        content_type: contentPost.content_type,
        platform: contentPost.platform,
        quantity: 1,
        description: contentPost.caption || contentPost.title,
        due_date: contentPost.post_date ? String(contentPost.post_date).split("T")[0] : null,
        status: "pending",
        organization_id: contentPost.organization_id,
        price_per_deliverable: paymentTermsData?.base_amount || 0,
        total_price: paymentTermsData?.base_amount || 0,
      })
      .select("id")
      .single();
    if (deliverableError) throw deliverableError;

    const { data: post, error: postError } = await supabase
      .from("kol_content_posts")
      .insert({ ...contentPost, campaign_deliverable_id: deliverable.id })
      .select("id")
      .single();
    if (postError) throw postError;

    const { data: paymentTerms, error: paymentError } = await supabase
      .from("kol_payment_terms")
      .insert({
        type: "agreement",
        campaign_id: contentPost.campaign_id,
        kol_profile_id: contentPost.kol_profile_id,
        kol_content_post_id: post.id,
        organization_id: contentPost.organization_id,
        payment_model: paymentTermsData.payment_model,
        base_amount: paymentTermsData.base_amount || 0,
        barter_value: paymentTermsData.barter_value || 0,
        payment_schedule: paymentTermsData.payment_schedule,
        performance_thresholds: paymentTermsData.performance_thresholds || {},
        effective_start_date: new Date().toISOString().split("T")[0],
        terms_version: 1,
        currency: "IDR",
        status: "draft",
      })
      .select("id")
      .single();
    if (paymentError) throw paymentError;

    if (Array.isArray(paymentTermsData?.milestones) && paymentTermsData.milestones.length) {
      const milestones = paymentTermsData.milestones.map((item: any, idx: number) => ({
        payment_terms_id: paymentTerms.id,
        milestone_name: item.milestone_name,
        milestone_order: item.milestone_order || idx + 1,
        amount: item.amount,
        percentage: item.payment_percentage,
        due_date: item.due_date || null,
        status: item.status || "pending",
        trigger_condition: item.trigger_condition || "manual",
        trigger_details: { content_post_id: post.id, ...(item.trigger_details || {}) },
        milestone_description: item.milestone_description || null,
      }));
      const { error: milestoneError } = await supabase.from("payment_milestones").insert(milestones);
      if (milestoneError) throw milestoneError;
    }

    return new Response(JSON.stringify({ success: true, content_post_id: post.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
