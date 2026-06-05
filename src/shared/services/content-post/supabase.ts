import { supabase } from "@/shared/lib/supabaseClient";
import type {
  ContentPostRecord,
  CreateContentPostWithPaymentPayload,
  PaymentMilestoneRecord,
} from "@/shared/types/content-post";
import { buildMilestonesJson } from "./buildMilestonesJson";
import {
  collectThresholdRows,
  syncPerformanceThresholdRows,
} from "@/shared/services/payment-terms/syncPerformanceThresholds";

const toThresholdObject = (
  thresholds?: { metric: "reach" | "engagement" | "conversion"; threshold: number; bonus_percentage: number }[],
) => {
  if (!thresholds?.length) return {};
  return thresholds.reduce<Record<string, number>>((acc, curr) => {
    acc[`target_${curr.metric}`] = curr.threshold;
    acc[`${curr.metric}_bonus_percentage`] = curr.bonus_percentage;
    return acc;
  }, {});
};

export const contentPostService = {
  async listContentPostsByOrg(organizationId: string): Promise<ContentPostRecord[]> {
    const { data, error } = await supabase
      .from("kol_content_posts")
      .select(
        `
        *,
        campaign:kol_campaigns(id, name),
        kol_profile:kol_profiles(id, name, profile_photo_url)
      `,
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as ContentPostRecord[];
  },

  async listCampaignAssignmentsByOrg(organizationId: string) {
    const { data, error } = await supabase
      .from("kol_campaign_assignments")
      .select(
        `
        id,
        campaign_id,
        kol_profile_id,
        campaign:kol_campaigns(id, name, status, remaining_budget, total_budget),
        kol_profile:kol_profiles(id, name, profile_photo_url)
      `,
      )
      .eq("campaign.organization_id", organizationId);

    if (error) {
      // fallback for constrained join filters: fetch without nested filter.
      const raw = await supabase
        .from("kol_campaign_assignments")
        .select(
          `
          id,
          campaign_id,
          kol_profile_id,
          campaign:kol_campaigns(id, name, status, organization_id, remaining_budget, total_budget),
          kol_profile:kol_profiles(id, name, profile_photo_url)
        `,
        );
      if (raw.error) throw raw.error;
      return (raw.data || []).filter((row: any) => row.campaign?.organization_id === organizationId);
    }

    return data || [];
  },

  async createContentPostWithPayment(payload: CreateContentPostWithPaymentPayload) {
    const { paymentTermsData, ...post } = payload;

    const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
      "create-content-post-agreement",
      {
        body: {
          contentPost: post,
          paymentTermsData: {
            ...paymentTermsData,
            performance_thresholds: toThresholdObject(paymentTermsData.performance_thresholds),
          },
        },
      },
    );
    if (!edgeError && edgeData?.success) {
      const { data: createdPost } = await supabase.from("kol_content_posts").select("*").eq("id", edgeData.content_post_id).single();
      return createdPost;
    }

    const { data: deliverable, error: deliverableError } = await supabase
      .from("kol_campaign_deliverables")
      .insert({
        campaign_id: post.campaign_id,
        kol_profile_id: post.kol_profile_id,
        deliverable_type: post.content_type,
        content_type: post.content_type,
        platform: post.platform,
        quantity: 1,
        description: post.caption || post.title,
        due_date: post.post_date ? post.post_date.split("T")[0] : null,
        status: "pending",
        organization_id: post.organization_id,
        price_per_deliverable: paymentTermsData.base_amount || 0,
        total_price: paymentTermsData.base_amount || 0,
      })
      .select("id")
      .single();
    if (deliverableError) throw deliverableError;

    const { data: contentPost, error: postError } = await supabase
      .from("kol_content_posts")
      .insert({
        ...post,
        campaign_deliverable_id: deliverable.id,
      })
      .select("*")
      .single();
    if (postError) throw postError;

    const milestonesJson = buildMilestonesJson(paymentTermsData.milestones);

    const { data: paymentTerm, error: paymentError } = await supabase
      .from("kol_payment_terms")
      .insert({
        type: "agreement",
        campaign_id: post.campaign_id,
        kol_profile_id: post.kol_profile_id,
        kol_content_post_id: contentPost.id,
        organization_id: post.organization_id,
        payment_model: paymentTermsData.payment_model,
        base_amount: paymentTermsData.base_amount || 0,
        barter_value: paymentTermsData.barter_value || 0,
        payment_schedule: paymentTermsData.payment_schedule,
        performance_thresholds: toThresholdObject(paymentTermsData.performance_thresholds),
        milestones: milestonesJson,
        effective_start_date: new Date().toISOString().split("T")[0],
        terms_version: 1,
        currency: "IDR",
        status: "draft",
      })
      .select("id")
      .single();
    if (paymentError) throw paymentError;

    const thresholdRows = collectThresholdRows(
      toThresholdObject(paymentTermsData.performance_thresholds),
      {
        organization_id: post.organization_id,
        payment_terms_id: paymentTerm.id,
        kol_content_post_id: contentPost.id,
        kol_profile_id: post.kol_profile_id,
        campaign_id: post.campaign_id,
        is_active: true,
        description: null,
      },
    );
    await syncPerformanceThresholdRows(thresholdRows);

    return contentPost;
  },

  async listMilestonesByPostIds(postIds: string[]): Promise<Record<string, PaymentMilestoneRecord[]>> {
    if (!postIds.length) return {};
    const { data, error } = await supabase
      .from("payment_milestones")
      .select("*, kol_payment_terms!inner(kol_content_post_id)")
      .in("kol_payment_terms.kol_content_post_id", postIds);
    if (error) throw error;

    return (data || []).reduce<Record<string, PaymentMilestoneRecord[]>>((acc, row: any) => {
      const postId = row.kol_payment_terms?.kol_content_post_id as string | undefined;
      if (!postId) return acc;
      if (!acc[postId]) acc[postId] = [];
      acc[postId].push(row as PaymentMilestoneRecord);
      return acc;
    }, {});
  },
};
