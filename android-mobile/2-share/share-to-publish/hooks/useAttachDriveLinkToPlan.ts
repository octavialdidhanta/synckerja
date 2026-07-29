import { useCallback, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { getGoogleDriveLinkNonEmptyUpdates } from "@/6-1-dashboard/utils/googleDriveLinkSavePolicy";
import { completeStepAndCreateApprovalFromDriveLink } from "@/8-2-DailyTask/services/completionApprovalService";
import { uploadVideoToGoogleDriveResumable } from "@/shared/lib/googleDriveResumableUploadClient";
import {
  SHAREABLE_PLAN_SELECT,
  type ShareableSocialMediaPlan,
} from "../lib/buildSharePlanQuery";
import { resolveReelContentTypeId } from "../lib/resolveReelContentTypeId";
import type { SharePublishVideo } from "../lib/sharePublishVideo";

export type AttachDriveLinkResult = {
  googleDriveLink: string;
  plan: ShareableSocialMediaPlan;
  setToReel: boolean;
  permissionWarning?: string;
};

async function requestProductionRevision(planId: string): Promise<void> {
  const { data: current, error: readErr } = await supabase
    .from("social_media_plans")
    .select("production_status, production_revision_count, google_drive_link")
    .eq("id", planId)
    .single();
  if (readErr) throw readErr;

  const shouldIncrement = current?.production_status !== "Request Revision";
  const nextCount =
    (typeof current?.production_revision_count === "number"
      ? current.production_revision_count
      : 0) + (shouldIncrement ? 1 : 0);

  const { error } = await supabase
    .from("social_media_plans")
    .update({
      production_approved: false,
      production_status: "Request Revision",
      production_completion_date: null,
      production_revision_count: nextCount,
      production_revision_baseline_link: current?.google_drive_link ?? null,
    })
    .eq("id", planId);
  if (error) throw error;
}

async function readShareablePlanById(planId: string): Promise<ShareableSocialMediaPlan> {
  const { data, error } = await supabase
    .from("social_media_plans")
    .select(SHAREABLE_PLAN_SELECT)
    .eq("id", planId)
    .single();
  if (error) throw error;
  return data as unknown as ShareableSocialMediaPlan;
}

export function useAttachDriveLinkToPlan() {
  const [busy, setBusy] = useState(false);
  const [progressRatio, setProgressRatio] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const attach = useCallback(
    async (args: {
      video: SharePublishVideo;
      plan: ShareableSocialMediaPlan;
      organizationId: string;
      currentEmployeeId?: string;
      forceReel: boolean;
      confirmChangeToReel: boolean;
    }): Promise<AttachDriveLinkResult> => {
      setBusy(true);
      setError(null);
      setProgressRatio(0);
      try {
        const { video, plan, organizationId, currentEmployeeId, forceReel, confirmChangeToReel } =
          args;

        if (plan.production_approved) {
          await requestProductionRevision(plan.id);
        }

        const { googleDriveLink, permissionWarning } = await uploadVideoToGoogleDriveResumable({
          nativeVideo: {
            path: video.path,
            name: video.name,
            mimeType: video.mimeType,
            size: video.size,
          },
          promptConnectIfNeeded: true,
          onProgress: (p) => setProgressRatio(p.ratio),
        });

        const currentPlan = await readShareablePlanById(plan.id);

        const planForPolicy = {
          google_drive_link: currentPlan.google_drive_link,
          production_status: currentPlan.production_approved
            ? "Request Revision"
            : currentPlan.production_status,
          production_revision_baseline_link: currentPlan.production_revision_baseline_link,
          pic_production_id: currentPlan.pic_production?.id ?? null,
          pic_production_source: currentPlan.pic_production_source,
        };

        const patch = getGoogleDriveLinkNonEmptyUpdates(
          planForPolicy,
          googleDriveLink,
          currentEmployeeId,
        );

        let setToReel = false;
        const currentTypeName = String(plan.content_type?.name ?? "").toLowerCase();
        if (forceReel && currentTypeName !== "reel") {
          if (currentTypeName && !confirmChangeToReel) {
            throw new Error("share.publish.errors.confirmReelRequired");
          }
          const reelId = await resolveReelContentTypeId(organizationId);
          if (reelId) {
            (patch as Record<string, unknown>).content_type_id = reelId;
            setToReel = true;
          }
        }

        const patchKeys = Object.keys(patch);
        if (patchKeys.length > 0) {
          const { error: updateErr } = await supabase
            .from("social_media_plans")
            .update(patch)
            .eq("id", plan.id);
          if (updateErr) throw updateErr;
        }

        const updated = await readShareablePlanById(plan.id);

        if (!String(updated.google_drive_link ?? "").trim()) {
          throw new Error("share.publish.errors.driveLinkNotPersisted");
        }

        if (patch.production_status === "Need Review") {
          void completeStepAndCreateApprovalFromDriveLink({
            organizationId,
            socialMediaPlanId: plan.id,
          });
        }

        return {
          googleDriveLink,
          plan: updated as unknown as ShareableSocialMediaPlan,
          setToReel,
          permissionWarning,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Attach failed";
        setError(msg);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { attach, busy, progressRatio, error, setError };
}
