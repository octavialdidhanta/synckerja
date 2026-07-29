import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  SHAREABLE_PLAN_SELECT,
  type ShareableSocialMediaPlan,
} from "../lib/buildSharePlanQuery";
import { buildDefaultSharePublishBrief } from "../lib/buildDefaultSharePublishBrief";
import { ownerAutoApprovePlanForPublish } from "../lib/ownerAutoApprovePlanForPublish";
import { resolveReelContentTypeId } from "../lib/resolveReelContentTypeId";

export type CreateSharePublishPlanInput = {
  organizationId: string;
  title: string;
  serviceId: string;
  subServiceId: string;
  contentPillarId: string;
  contentTypeId: string;
  picId: string | null;
  postDate: string;
  isOwner: boolean;
};

export function titleFromVideoFileName(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\.[^.]+$/, "").trim() || raw;
}

export function useCreateSharePublishPlan() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const createPlan = useCallback(
    async (input: CreateSharePublishPlanInput): Promise<ShareableSocialMediaPlan> => {
      const title = input.title.trim();
      if (!title) {
        throw new Error("share.publish.create.errors.titleRequired");
      }
      if (!input.serviceId) {
        throw new Error("share.publish.create.errors.serviceRequired");
      }
      if (!input.subServiceId) {
        throw new Error("share.publish.create.errors.subServiceRequired");
      }
      if (!input.contentPillarId) {
        throw new Error("share.publish.create.errors.contentPillarRequired");
      }
      if (!input.contentTypeId) {
        throw new Error("share.publish.create.errors.contentTypeRequired");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.postDate)) {
        throw new Error("share.publish.create.errors.postDateRequired");
      }

      setBusy(true);
      try {
        const brief = buildDefaultSharePublishBrief(title);
        const insertPayload = {
          organization_id: input.organizationId,
          post_date: input.postDate,
          title,
          service_id: input.serviceId,
          sub_service_id: input.subServiceId,
          content_pillar_id: input.contentPillarId,
          content_type_id: input.contentTypeId,
          pic_id: input.picId,
          brief,
          status: "",
          revision_count: 0,
          approved: false,
          completion_date: null,
          pic_production_id: null,
          google_drive_link: null,
          production_status: "",
          production_revision_count: 0,
          production_completion_date: null,
          production_approved: false,
          production_approved_date: null,
          post_link: null,
          done: false,
          actual_post_date: null,
          on_time_status: "",
          status_content: "",
        };

        const { data: inserted, error: insertError } = await supabase
          .from("social_media_plans")
          .insert(insertPayload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        const planId = (inserted as { id?: string } | null)?.id;
        if (!planId) {
          throw new Error("share.publish.create.errors.createFailed");
        }

        let plan: ShareableSocialMediaPlan;
        if (input.isOwner) {
          plan = await ownerAutoApprovePlanForPublish({ planId });
        } else {
          const { data, error } = await supabase
            .from("social_media_plans")
            .select(SHAREABLE_PLAN_SELECT)
            .eq("id", planId)
            .single();
          if (error) throw error;
          plan = data as unknown as ShareableSocialMediaPlan;
        }

        await queryClient.invalidateQueries({
          queryKey: ["shareToPublishPlans", input.organizationId],
        });

        return plan;
      } finally {
        setBusy(false);
      }
    },
    [queryClient],
  );

  const resolveDefaultReelTypeId = useCallback(async (organizationId: string) => {
    return resolveReelContentTypeId(organizationId);
  }, []);

  return { createPlan, busy, resolveDefaultReelTypeId };
}
