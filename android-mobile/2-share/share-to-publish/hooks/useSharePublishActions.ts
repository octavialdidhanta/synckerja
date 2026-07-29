import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceRequiredPlatforms } from "@/6-1-dashboard/hook/useServiceRequiredPlatforms";
import { useConnectedPlatformAccounts } from "@/6-1-scheduled-posts/hooks/useConnectedPlatformAccounts";
import { useOrgDefaultPostTime } from "@/6-1-scheduled-posts/hooks/useOrgDefaultPostTime";
import { usePlanBulkPublish } from "@/6-1-scheduled-posts/hooks/usePlanBulkPublish";
import { useScheduledPostsByPlan } from "@/6-1-scheduled-posts/hooks/useScheduledPostsByPlan";
import { pickPlatformScheduleForModal, pickAccountScheduleForModal } from "@/6-1-scheduled-posts/lib/pickPlatformScheduleDisplay";
import { listAllAutoScheduleTargets } from "@/6-1-scheduled-posts/lib/resolveRequiredPlatformTargets";
import {
  getPlanPublishEligibilityMissing,
  isPlanEligibleForPublish,
} from "@/6-1-scheduled-posts/lib/planAutoScheduleEligibility";
import { invalidatePlanPublishQueries } from "@/6-1-scheduled-posts/lib/invalidatePlanPublishQueries";
import type { ShareableSocialMediaPlan } from "../lib/buildSharePlanQuery";
import { ownerAutoApprovePlanForPublish } from "../lib/ownerAutoApprovePlanForPublish";
import type { PublishPlatformResult } from "@/6-1-scheduled-posts/hooks/usePlanBulkPublish";
import type { ScheduledPost } from "@/6-1-scheduled-posts/types/scheduled-post";

export type SharePublishPlatformResult = PublishPlatformResult;

function isSharePublishResultProcessing(
  result: SharePublishPlatformResult,
  schedules: ScheduledPost[],
): boolean {
  if (!result.ok || !result.processing) return false;
  const schedule = pickPlatformScheduleForModal(schedules, result.platform);
  if (!schedule) return true;
  if (schedule.status === "published" || schedule.status === "failed") return false;
  if (schedule.status === "pending" || schedule.status === "publishing") return true;
  return false;
}

function isSharePublishResultOk(
  result: SharePublishPlatformResult,
  schedules: ScheduledPost[],
): boolean {
  if (!result.ok) return false;
  if (!result.processing) return true;
  const schedule = pickPlatformScheduleForModal(schedules, result.platform);
  return schedule?.status === "published";
}

function toEligibilityInput(plan: ShareableSocialMediaPlan) {
  return {
    post_date: plan.post_date,
    approved: plan.approved,
    production_approved: plan.production_approved,
    google_drive_link: plan.google_drive_link,
    content_type_name: plan.content_type?.name,
    service_id: plan.service_id,
  };
}

export function useSharePublishActions(args: {
  organizationId: string | null | undefined;
  plan: ShareableSocialMediaPlan | null;
  caption: string;
  employeeId?: string;
  isOwner?: boolean;
  driveLinkBlocked?: boolean;
}) {
  const { organizationId, plan, caption, employeeId, isOwner = false, driveLinkBlocked = false } = args;
  const queryClient = useQueryClient();
  const { requiredPlatforms = [] } = useServiceRequiredPlatforms(plan?.service_id ?? undefined);
  const { accounts: connectedAccounts } = useConnectedPlatformAccounts(organizationId ?? undefined);
  const { data: defaultTime } = useOrgDefaultPostTime();
  const { data: schedules = [] } = useScheduledPostsByPlan(plan?.id);
  const { runBulkPublish, isPending } = usePlanBulkPublish();

  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<"schedule" | "post_now" | null>(null);
  const [results, setResults] = useState<SharePublishPlatformResult[]>([]);
  const [resultsPlanId, setResultsPlanId] = useState<string | null>(null);
  const [uploadedPlanIds, setUploadedPlanIds] = useState<string[]>([]);
  const [lastApprovedPlan, setLastApprovedPlan] = useState<ShareableSocialMediaPlan | null>(null);

  useEffect(() => {
    setResults([]);
    setResultsPlanId(null);
    setActiveAction(null);
  }, [plan?.id]);

  const eligibilityInput = plan ? toEligibilityInput(plan) : null;
  const ownerBypass = isOwner;

  const eligibleBase = eligibilityInput
    ? isPlanEligibleForPublish(eligibilityInput, { ownerBypass })
    : false;
  const eligible = eligibleBase && !driveLinkBlocked;
  const missing = eligibilityInput
    ? getPlanPublishEligibilityMissing(eligibilityInput, { ownerBypass })
    : [];
  const targets =
    organizationId && plan
      ? listAllAutoScheduleTargets(requiredPlatforms, connectedAccounts)
      : [];

  const defaultTimeWib = defaultTime || "18:00";
  const [scheduleTimeWib, setScheduleTimeWibState] = useState(defaultTimeWib);
  const [timeTouched, setTimeTouched] = useState(false);

  useEffect(() => {
    setTimeTouched(false);
    setScheduleTimeWibState(defaultTimeWib);
  }, [plan?.id]);

  useEffect(() => {
    if (timeTouched) return;
    setScheduleTimeWibState(defaultTimeWib);
  }, [defaultTimeWib, timeTouched]);

  const setScheduleTimeWib = useCallback((next: string) => {
    const normalized = next.slice(0, 5);
    setTimeTouched(true);
    setScheduleTimeWibState(normalized);
  }, []);

  const hasProcessingPublish = useMemo(
    () => results.some((r) => isSharePublishResultProcessing(r, schedules)),
    [results, schedules],
  );

  const sessionPublishComplete = useMemo(() => {
    if (!plan?.id || resultsPlanId !== plan.id) return false;
    if (!results.length || hasProcessingPublish) return false;
    return results.every((r) => isSharePublishResultOk(r, schedules));
  }, [plan?.id, resultsPlanId, results, schedules, hasProcessingPublish]);

  const targetsAlreadyPublished = useMemo(() => {
    if (!targets.length) return false;
    return targets.every((target) => {
      const schedule = pickAccountScheduleForModal(schedules, target.platform, target.accountId);
      return schedule?.status === "published";
    });
  }, [targets, schedules]);

  const actionsLocked = sessionPublishComplete || targetsAlreadyPublished;

  useEffect(() => {
    if (!plan?.id) return;
    if (!sessionPublishComplete && !targetsAlreadyPublished) return;
    setUploadedPlanIds((prev) => (prev.includes(plan.id) ? prev : [...prev, plan.id]));
  }, [plan?.id, sessionPublishComplete, targetsAlreadyPublished]);

  const run = useCallback(
    async (action: "schedule" | "post_now") => {
      if (!organizationId || !plan || !eligible) {
        if (driveLinkBlocked) {
          throw new Error("share.publish.errors.driveNotPublic");
        }
        throw new Error("share.publish.errors.notEligible");
      }

      setBusy(true);
      setActiveAction(action);
      setResults([]);

      let activePlan = plan;

      try {
        const { results: out } = await runBulkPublish({
          action,
          targets,
          schedules,
          organizationId,
          planId: activePlan.id,
          caption,
          title: activePlan.title ?? undefined,
          employeeId,
          postDateYmd: activePlan.post_date!.slice(0, 10),
          getTimeWib: () => scheduleTimeWib,
          parallelPostNow: action === "post_now",
          driveLinkBlocked,
          planEligibility: toEligibilityInput(activePlan),
          ownerBypass,
          beforePublish: isOwner
            ? async () => {
                activePlan = await ownerAutoApprovePlanForPublish({
                  planId: plan.id,
                  snapshot: plan,
                });
                setLastApprovedPlan(activePlan);
                await invalidatePlanPublishQueries(queryClient, {
                  organizationId,
                  planId: plan.id,
                });
                await queryClient.invalidateQueries({
                  queryKey: ["shareToPublishPlans", organizationId],
                  refetchType: "active",
                });
              }
            : undefined,
        });

        setResults(out);
        setResultsPlanId(activePlan.id);
        return { results: out, plan: activePlan };
      } finally {
        setBusy(false);
      }
    },
    [
      organizationId,
      plan,
      eligible,
      driveLinkBlocked,
      isOwner,
      targets,
      schedules,
      scheduleTimeWib,
      caption,
      employeeId,
      runBulkPublish,
      queryClient,
    ],
  );

  const publishBusy = busy || isPending || hasProcessingPublish;

  return {
    eligible,
    missing,
    targets,
    busy: publishBusy,
    /** Lock Schedule/Post now after successful publish to prevent double upload. */
    actionsLocked,
    uploadedPlanIds,
    /** Which action shows the spinner; both buttons stay disabled while busy. */
    activeAction: publishBusy ? activeAction : null,
    results,
    lastApprovedPlan,
    scheduleTimeWib,
    setScheduleTimeWib,
    scheduleAll: () => run("schedule"),
    postNowAll: () => run("post_now"),
  };
}
