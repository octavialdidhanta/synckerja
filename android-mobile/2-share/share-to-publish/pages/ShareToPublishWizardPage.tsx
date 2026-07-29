import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/mobile-app/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { useOrganizationList } from "@/mobile-app/hooks/useOrganizationList";
import { useSubscriptionSelfServiceEnabled } from "@/shared/auth/hooks/useSubscriptionSelfServiceEnabled";
import { OrganizationSelectDrawer } from "@/mobile-app/components/OrganizationSelectDrawer";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { setShareBackGuard } from "@/mobile-app/shareIntent/shareBackGuard";
import { dismissShareToPublishSession } from "@/shared/native/shareToPublishSession";
import { MODAL_BRAND_HEADER_BAR } from "@/shared/constants/modalBrandHeaderClasses";
import { cn } from "@/shared/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/mobile-app/components/ui/alert-dialog";
import ShareToPublishWizardPageSkeleton from "./ShareToPublishWizardPageSkeleton";
import { useShareToPublishPayload } from "../hooks/useShareToPublishPayload";
import { useSharePortraitDetection } from "../hooks/useSharePortraitDetection";
import { useShareableSocialMediaPlans } from "../hooks/useShareableSocialMediaPlans";
import { useAttachDriveLinkToPlan } from "../hooks/useAttachDriveLinkToPlan";
import { useSharePublishActions } from "../hooks/useSharePublishActions";
import { SharePublishOrgStep } from "../components/SharePublishOrgStep";
import { SharePublishPlanPickerStep } from "../components/SharePublishPlanPickerStep";
import { SharePublishMediaStep } from "../components/SharePublishMediaStep";
import { SharePublishCaptionStep } from "../components/SharePublishCaptionStep";
import { SharePublishEligibilityList } from "../components/SharePublishEligibilityList";
import { SharePublishActions } from "../components/SharePublishActions";
import { SharePublishResultPanel } from "../components/SharePublishResultPanel";
import { SharePublishPlanDetailCard } from "../components/SharePublishPlanDetailCard";
import { SharePublishCreatePlanSheet } from "../components/SharePublishCreatePlanSheet";
import { SharePublishScheduleTimeSheet } from "../components/SharePublishScheduleTimeSheet";
import { resolveSharePublishMediaPhase } from "@/6-1-scheduled-posts/lib/resolveSharePublishMediaPhase";
import { buildScheduleCaption } from "../lib/shareToPublishSteps";
import type { ShareableSocialMediaPlan } from "../lib/buildSharePlanQuery";
import type { SharePublishVideo } from "../lib/sharePublishVideo";

export default function ShareToPublishWizardPage() {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const { organizationId, loading: orgBootstrapLoading } = useCurrentOrg();
  const {
    activeOrganization,
    organizations,
    loading: orgListLoading,
  } = useOrganizationList();
  const selfServiceEnabled = useSubscriptionSelfServiceEnabled();
  const { employee: currentEmployee, isOwner } = useCentralizedUserData();
  const currentEmployeeId = currentEmployee?.id;

  const { loading: payloadLoading, video: sharedVideo, loadError, clearPayload } =
    useShareToPublishPayload();
  const [keptVideo, setKeptVideo] = useState<SharePublishVideo | null>(null);
  const video = keptVideo ?? sharedVideo;
  const { isPortrait } = useSharePortraitDetection(video);

  useEffect(() => {
    if (sharedVideo && !keptVideo) {
      setKeptVideo(sharedVideo);
    }
  }, [sharedVideo, keptVideo]);

  const [orgDrawerOpen, setOrgDrawerOpen] = useState(false);
  const [reelConfirmOpen, setReelConfirmOpen] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [createPostDate, setCreatePostDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [selectedPlan, setSelectedPlan] = useState<ShareableSocialMediaPlan | null>(null);
  const [caption, setCaption] = useState("");
  const [attached, setAttached] = useState(false);
  const [phase, setPhase] = useState<"pick" | "publish">("pick");
  const [canSkipUpload, setCanSkipUpload] = useState(false);
  const [driveLinkBlocked, setDriveLinkBlocked] = useState(false);

  const { data: plans = [], isPending: plansLoading } = useShareableSocialMediaPlans({
    organizationId,
    currentEmployeeId,
  });

  const { attach, busy: attachBusy, progressRatio, error: attachError } =
    useAttachDriveLinkToPlan();

  const publish = useSharePublishActions({
    organizationId,
    plan: selectedPlan,
    caption,
    employeeId: currentEmployeeId,
    isOwner,
    driveLinkBlocked,
  });

  useEffect(() => {
    if (publish.lastApprovedPlan) {
      setSelectedPlan(publish.lastApprovedPlan);
    }
  }, [publish.lastApprovedPlan]);

  const briefQuery = useQuery({
    queryKey: ["sharePublishBriefCaption", selectedPlan?.id],
    enabled: Boolean(selectedPlan?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brief_captions")
        .select("content")
        .eq("social_media_plan_id", selectedPlan!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.content as string | null) ?? null;
    },
  });

  useEffect(() => {
    if (!selectedPlan) {
      setCaption("");
      return;
    }
    setCaption(buildScheduleCaption(selectedPlan.title, briefQuery.data ?? null));
  }, [selectedPlan?.id, selectedPlan?.title, briefQuery.data]);

  useEffect(() => {
    setSelectedPlan(null);
    setAttached(false);
    setPhase("pick");
    setCanSkipUpload(false);
    setDriveLinkBlocked(false);
  }, [organizationId]);

  const canSwitchOrg =
    selfServiceEnabled && organizations.length > 1 && !attachBusy && !publish.busy;

  // Prefer useCurrentOrg id (updates immediately on organization-switched).
  // Do not prefer activeOrganization first — it can lag behind the list query refetch.
  const resolvedOrganization =
    (organizationId
      ? organizations.find((o) => o.id === organizationId)
      : null) ??
    activeOrganization ??
    null;
  const orgDisplayName = resolvedOrganization?.company_name ?? null;

  const showSkeleton =
    payloadLoading ||
    (orgBootstrapLoading && !organizationId) ||
    (orgListLoading && !resolvedOrganization && !organizationId);

  const handleLeave = useCallback(() => {
    setShareBackGuard(null);
    dismissShareToPublishSession();
    navigate("/", { replace: true });
    void clearPayload();
  }, [clearPayload, navigate]);

  useEffect(() => {
    setShareBackGuard(() => {
      void handleLeave();
      return true;
    });
    return () => setShareBackGuard(null);
  }, [handleLeave]);

  const runAttach = useCallback(
    async (confirmChangeToReel: boolean) => {
      if (!video || !selectedPlan || !organizationId) return;
      try {
        const forceReel = isPortrait === true;
        const result = await attach({
          video,
          plan: selectedPlan,
          organizationId,
          currentEmployeeId,
          forceReel,
          confirmChangeToReel,
        });
        setSelectedPlan(result.plan);
        setAttached(true);
        setPhase("publish");
        setCanSkipUpload(false);
        setDriveLinkBlocked(Boolean(result.permissionWarning));
        // Keep local cache file so preview can still play after upload.
        await clearPayload({ keepLocalFiles: true });
        toast.success(
          isOwner
            ? t("share.publish.toasts.savedOwner", "Video saved to plan.")
            : t("share.publish.toasts.saved", "Video saved to plan. Awaiting approval if required."),
        );
        if (result.permissionWarning) {
          toast.message(
            t(
              "share.publish.toasts.drivePermissionWarning",
              "Video uploaded, but public Drive sharing could not be enabled. Open the link in Drive and set sharing to Anyone with the link if needed.",
            ),
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "share.publish.errors.confirmReelRequired") {
          setReelConfirmOpen(true);
          return;
        }
        if (msg.toLowerCase().includes("google drive connection started")) {
          toast.message(
            t(
              "share.publish.toasts.googleConnectRetry",
              "Connect Google Drive, then tap Save video to plan again.",
            ),
          );
          return;
        }
        if (
          msg.toLowerCase().includes("google account not connected") ||
          msg.toLowerCase().includes("google session expired") ||
          msg.includes("google_not_connected")
        ) {
          toast.error(
            t(
              "share.publish.errors.googleNotConnected",
              "Google Drive is not connected. Connect Google Drive in the app, then try again.",
            ),
          );
          return;
        }
        if (
          msg.toLowerCase().includes("permission denied") ||
          msg.includes("drive_permission_denied")
        ) {
          toast.error(
            t(
              "share.publish.errors.drivePermissionDenied",
              "Google Drive blocked the upload. Connect Google Drive again in Synckerja, then retry.",
            ),
          );
          return;
        }
        if (
          msg.toLowerCase().includes("storage quota") ||
          msg.toLowerCase().includes("quota has been exceeded") ||
          msg.toLowerCase().includes("storagequotaexceeded")
        ) {
          toast.error(
            t(
              "share.publish.errors.driveStorageQuotaExceeded",
              "Google Drive storage is full. Free up Drive space or use another connected Google account, then try again.",
            ),
          );
          return;
        }
        if (msg.includes("invalid_video_file") || msg.startsWith("share.publish.errors.invalidVideoFile")) {
          toast.error(
            t(
              "share.publish.errors.invalidVideoFile",
              "File is not a valid MP4/MOV video. Re-export as MP4 from CapCut/Edits and share again.",
            ),
          );
          return;
        }
        const friendly =
          msg.startsWith("drive_upload_failed") || msg.startsWith("drive_upload")
            ? (() => {
                const detail = msg.replace(/^drive_upload_failed:\s*/i, "").trim();
                if (detail.toLowerCase().includes("missing file id")) {
                  return t(
                    "share.publish.errors.driveUploadResume",
                    "Upload almost finished but Drive did not confirm. Tap Save video to plan again to resume.",
                  );
                }
                if (detail.toLowerCase().includes("network error")) {
                  return t(
                    "share.publish.errors.driveUploadNetwork",
                    "Upload interrupted. Check connection and tap Save video to plan again.",
                  );
                }
                return t(
                  "share.publish.errors.driveUploadFailed",
                  "Google Drive upload failed. Tap Save video to plan again.",
                );
              })()
            : msg.startsWith("share.")
              ? t(msg, msg)
              : msg || t("share.publish.toasts.saveFailed", "Failed to save video");
        toast.error(friendly);
      }
    },
    [
      video,
      selectedPlan,
      organizationId,
      isPortrait,
      attach,
      currentEmployeeId,
      clearPayload,
      t,
      attachError,
      isOwner,
    ],
  );

  const handleAttachClick = () => {
    if (!selectedPlan) {
      toast.error(t("share.publish.errors.pickPlan", "Pick a content plan first"));
      return;
    }
    const typeName = String(selectedPlan.content_type?.name ?? "").toLowerCase();
    if (isPortrait === true && typeName && typeName !== "reel") {
      setReelConfirmOpen(true);
      return;
    }
    void runAttach(false);
  };

  const handleSchedule = async () => {
    try {
      const { results } = await publish.scheduleAll();
      const ok = results.filter((r) => r.ok).length;
      setScheduleSheetOpen(false);
      toast.success(
        t("share.publish.toasts.scheduled", "Scheduled on {{count}} platform(s)", {
          count: ok,
        }),
      );
    } catch (e) {
      toast.error(
        t(
          e instanceof Error ? e.message : "share.publish.toasts.publishFailed",
          "Schedule failed",
        ),
      );
    }
  };

  const handlePostNow = async () => {
    try {
      const { results } = await publish.postNowAll();
      const ok = results.filter((r) => r.ok).length;
      toast.success(
        t("share.publish.toasts.posted", "Posted on {{count}} platform(s)", { count: ok }),
      );
    } catch (e) {
      toast.error(
        t(
          e instanceof Error ? e.message : "share.publish.toasts.publishFailed",
          "Post now failed",
        ),
      );
    }
  };

  const headerTitle = useMemo(
    () => t("share.publish.title", "Share to publish"),
    [t],
  );

  if (showSkeleton) {
    return <ShareToPublishWizardPageSkeleton />;
  }

  if ((loadError || !video) && !attached) {
    return (
      <div className="relative flex min-h-dvh flex-col bg-gray-100">
        <header
          className={cn(
            "flex shrink-0 items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]",
            MODAL_BRAND_HEADER_BAR,
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
            onClick={() => void handleLeave()}
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-base font-bold text-primary-foreground">{headerTitle}</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t(
              loadError || "share.publish.errors.noVideo",
              "No shared video found. Share a video from CapCut or Edits to Synckerja Office.",
            )}
          </p>
          <Button type="button" onClick={() => void handleLeave()}>
            {t("share.publish.actions.close", "Close")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-100">
      <header
        className={cn(
          "flex shrink-0 items-center gap-2 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]",
          MODAL_BRAND_HEADER_BAR,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
          onClick={() => void handleLeave()}
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-primary-foreground">
          {headerTitle}
        </h1>
        {(attachBusy || publish.busy) && (
          <Loader2 className="h-4 w-4 animate-spin text-primary-foreground/80" />
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col gap-1.5 pt-1.5">
              <SharePublishOrgStep
                orgName={orgDisplayName}
                canSwitch={canSwitchOrg}
                onChangeOrg={() => setOrgDrawerOpen(true)}
              />

              <SharePublishMediaStep
                video={video}
                isPortrait={isPortrait}
                uploadProgress={phase === "pick" ? progressRatio : 1}
                uploading={phase === "pick" ? attachBusy : false}
                readyToPublish={phase === "publish" && attached && !publish.busy}
                existingDriveLink={
                  canSkipUpload && phase === "publish" ? selectedPlan?.google_drive_link : null
                }
                canSkipUpload={canSkipUpload && phase === "publish"}
                onReplaceVideo={
                  canSkipUpload && phase === "publish" && video
                    ? () => {
                        setPhase("pick");
                        setAttached(false);
                        setCanSkipUpload(false);
                      }
                    : undefined
                }
              />

              <SharePublishPlanPickerStep
                key={organizationId ?? "no-org"}
                plans={plans}
                loading={plansLoading}
                selectedPlanId={selectedPlan?.id ?? null}
                uploadedPlanIds={publish.uploadedPlanIds}
                createDisabled={attachBusy || publish.busy}
                onCreatePlan={(postDate) => {
                  setCreatePostDate(postDate);
                  setCreateSheetOpen(true);
                }}
                onSelect={(plan) => {
                  setSelectedPlan(plan);
                  const mediaPhase = resolveSharePublishMediaPhase(
                    { google_drive_link: plan.google_drive_link },
                    Boolean(video),
                  );
                  setAttached(mediaPhase.attached);
                  setPhase(mediaPhase.phase);
                  setCanSkipUpload(mediaPhase.canSkipUpload);
                  setDriveLinkBlocked(false);
                }}
              />

              {selectedPlan ? (
                <>
                  <SharePublishPlanDetailCard plan={selectedPlan} />
                  <SharePublishCaptionStep
                    value={caption}
                    onChange={setCaption}
                    disabled={attachBusy || publish.busy}
                    planTitle={selectedPlan.title}
                    contentPillarName={selectedPlan.content_pillar?.name}
                    organizationId={organizationId}
                  />
                  {phase === "publish" ? (
                    <>
                      <SharePublishEligibilityList
                        missing={publish.missing}
                        eligible={publish.eligible}
                        targetCount={publish.targets.length}
                        ownerBypass={isOwner}
                      />
                      {driveLinkBlocked ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                          <p className="text-sm font-medium text-amber-900">
                            {t(
                              "share.publish.errors.driveNotPublicTitle",
                              "Google Drive link is not public",
                            )}
                          </p>
                          <p className="mt-1 text-xs text-amber-800">
                            {t(
                              "share.publish.errors.driveNotPublic",
                              "Open the Drive file, set sharing to Anyone with the link, then save the video to this plan again before publishing.",
                            )}
                          </p>
                        </div>
                      ) : null}
                      <SharePublishActions
                        attachBusy={false}
                        publishBusy={publish.busy}
                        activeAction={publish.activeAction}
                        actionsLocked={publish.actionsLocked}
                        eligible={publish.eligible}
                        attached={attached}
                        onAttach={() => undefined}
                        onSchedule={() => setScheduleSheetOpen(true)}
                        onPostNow={() => void handlePostNow()}
                      />
                      <SharePublishResultPanel results={publish.results} planId={selectedPlan?.id} />
                      {!publish.eligible && !isOwner ? (
                        <p className="px-1 text-center text-xs text-muted-foreground">
                          {t(
                            "share.publish.waitingApprovalHint",
                            "After production approval on desktop, you can schedule or post from the social media dashboard.",
                          )}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <SharePublishActions
                      attachBusy={attachBusy}
                      publishBusy={false}
                      eligible={false}
                      attached={false}
                      onAttach={handleAttachClick}
                      onSchedule={() => undefined}
                      onPostNow={() => undefined}
                    />
                  )}
                </>
              ) : null}

              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>

      <OrganizationSelectDrawer open={orgDrawerOpen} onOpenChange={setOrgDrawerOpen} />

      <SharePublishCreatePlanSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        organizationId={organizationId}
        postDate={createPostDate}
        defaultTitle={video?.name}
        currentEmployeeId={currentEmployeeId}
        currentEmployeeName={currentEmployee?.full_name ?? null}
        isOwner={Boolean(isOwner)}
        onCreated={(plan) => {
          setSelectedPlan(plan);
          const mediaPhase = resolveSharePublishMediaPhase(
            { google_drive_link: plan.google_drive_link },
            Boolean(video),
          );
          setAttached(mediaPhase.attached);
          setPhase(mediaPhase.phase);
          setCanSkipUpload(mediaPhase.canSkipUpload);
          setDriveLinkBlocked(false);
        }}
      />

      <SharePublishScheduleTimeSheet
        open={scheduleSheetOpen}
        onOpenChange={setScheduleSheetOpen}
        postDateYmd={selectedPlan?.post_date?.slice(0, 10)}
        timeWib={publish.scheduleTimeWib}
        onTimeChange={publish.setScheduleTimeWib}
        busy={publish.busy && publish.activeAction === "schedule"}
        onConfirm={() => void handleSchedule()}
      />

      <AlertDialog open={reelConfirmOpen} onOpenChange={setReelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("share.publish.reelConfirm.title", "Change content type to Reel?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "share.publish.reelConfirm.body",
                "Portrait video detected. Auto-post requires content type Reel. Update this plan to Reel?",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("share.publish.reelConfirm.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setReelConfirmOpen(false);
                void runAttach(true);
              }}
            >
              {t("share.publish.reelConfirm.confirm", "Use Reel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
