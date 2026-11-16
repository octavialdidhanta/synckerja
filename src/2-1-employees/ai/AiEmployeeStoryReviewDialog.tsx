import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { OptimizedCommentPanel } from "@/6-1-dashboard/modal/OptimizedCommentPanel";
import { useProdApprovalAccess } from "@/6-1-dashboard/hook/useProdApprovalAccess";
import { CANVA_STORY_RUNS_KEY } from "@/canva/useCanvaStoryRuns";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { storyExportPublicUrl } from "./storyStorage";

export type StoryReviewTarget = {
  id: string;
  briefPreview: string;
  designUrl: string | null;
  exportPath: string | null;
  postDate: string | null;
  serviceId: string | null;
  productionStatus: string;
  productionApproved: boolean;
};

export function AiEmployeeStoryReviewDialog({
  open,
  plan,
  onClose,
  onChanged,
  onApprovedForPublish,
}: {
  open: boolean;
  plan: StoryReviewTarget | null;
  onClose: () => void;
  onChanged: () => void;
  onApprovedForPublish?: (plan: StoryReviewTarget) => void;
}) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canShowApprovalButtons, loading: accessLoading } = useProdApprovalAccess(open && Boolean(plan));
  const [busy, setBusy] = useState(false);

  if (!plan) return null;

  const previewUrl = plan.exportPath
    ? storyExportPublicUrl(plan.exportPath, plan.exportPath)
    : "";
  const commentLink = plan.designUrl?.startsWith("https://")
    ? plan.designUrl
    : previewUrl || "story-export";
  const alreadyApproved = plan.productionApproved || plan.productionStatus === "Approved";

  const approve = async () => {
    if (!canShowApprovalButtons) {
      toast({
        title: t("aiEmployee.story.reviewNoAccess", "Tidak punya akses approve produksi"),
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const approvedDate = new Date().toISOString();
      const { error } = await supabase
        .from("social_media_plans")
        .update({
          production_status: "Approved",
          production_approved: true,
          production_approved_date: approvedDate,
        })
        .eq("id", plan.id);
      if (error) throw error;
      toast({
        title: t("aiEmployee.story.reviewApproved", "Produksi Story disetujui"),
        description: t("aiEmployee.story.reviewReadyPublish", "Siap publish ke Instagram Stories."),
      });
      const approvedPlan: StoryReviewTarget = {
        ...plan,
        productionApproved: true,
        productionStatus: "Approved",
      };
      onChanged();
      onClose();
      onApprovedForPublish?.(approvedPlan);
    } catch {
      toast({
        title: t("aiEmployee.story.reviewApproveFailed", "Gagal menyetujui produksi Story"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const requestRevision = async () => {
    if (!canShowApprovalButtons) {
      toast({
        title: t("aiEmployee.story.reviewNoAccess", "Tidak punya akses approve produksi"),
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const { data: current, error: readError } = await supabase
        .from("social_media_plans")
        .select("production_revision_count, production_status")
        .eq("id", plan.id)
        .maybeSingle();
      if (readError) throw readError;

      const shouldIncrement = current?.production_status !== "Request Revision";
      const nextCount = shouldIncrement
        ? (Number(current?.production_revision_count ?? 0) + 1)
        : Number(current?.production_revision_count ?? 0);

      const patch: Record<string, unknown> = {
        production_status: "Request Revision",
        production_completion_date: null,
        production_approved: false,
        production_approved_date: null,
      };
      if (shouldIncrement) patch.production_revision_count = nextCount;

      const { error } = await supabase
        .from("social_media_plans")
        .update(patch)
        .eq("id", plan.id);
      if (error) throw error;

      const { count } = await supabase
        .from("link_comments")
        .select("id", { count: "exact", head: true })
        .eq("social_media_plan_id", plan.id)
        .is("canva_revision_applied_at", null);
      const hasComments = (count ?? 0) > 0;

      if (hasComments) {
        const { error: reviseError } = await supabase.rpc("canva_story_revise", {
          p_plan_id: plan.id,
        });
        if (reviseError) {
          toast({
            title: t("aiEmployee.story.reviewRevision", "Revisi produksi diminta"),
            description: t(
              "aiEmployee.story.reviewRevisionCanvaPending",
              "Status Request Revision tersimpan, tetapi Canva belum mulai merevisi. Pastikan desain Canva sudah siap, lalu coba lagi.",
            ),
            variant: "destructive",
          });
        } else {
          toast({
            title: t("aiEmployee.story.reviewRevisionCanva", "Canva sedang merevisi Story"),
            description: t(
              "aiEmployee.story.reviewRevisionCanvaHint",
              "Revisi mengikuti komentar review. Spinner di tabel Plan Story menandai Canva sedang bekerja.",
            ),
          });
          await queryClient.invalidateQueries({ queryKey: [CANVA_STORY_RUNS_KEY] });
        }
      } else {
        toast({
          title: t("aiEmployee.story.reviewRevision", "Revisi produksi diminta"),
          description: t(
            "aiEmployee.story.reviewRevisionNeedComment",
            "Tambahkan komentar review dulu agar Canva tahu apa yang harus direvisi.",
          ),
        });
      }
      onChanged();
      onClose();
    } catch {
      toast({
        title: t("aiEmployee.story.reviewRevisionFailed", "Gagal meminta revisi Story"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("aiEmployee.story.reviewTitle", "Review Story")}</DialogTitle>
          <DialogDescription>
            {t(
              "aiEmployee.story.reviewDesc",
              "Review desain produksi (bukan ulang approve konten). Setelah Approve, lanjut ke Story Publish Setup.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex w-full min-w-0 flex-col gap-3">
          {/* Preview drives row height; right is locked to that height (does not grow taller). */}
          <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-[15.5rem_minmax(0,1fr)] md:items-stretch">
            <aside className="w-full min-w-0 md:col-start-1">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={t("aiEmployee.story.reviewPreviewAlt", "Preview Story")}
                  className="h-auto w-full rounded-md border border-border object-contain"
                />
              ) : (
                <div className="flex aspect-[9/16] w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/40 px-3 text-center text-sm text-muted-foreground">
                  {t("aiEmployee.story.reviewNoPreview", "Belum ada export JPG. Perbarui dari Canva dulu.")}
                </div>
              )}
            </aside>

            <div className="relative min-h-[22rem] min-w-0 md:col-start-2 md:h-full md:min-h-0">
              <div className="flex flex-col gap-2 md:absolute md:inset-0">
                <div className="shrink-0 rounded-md border border-border bg-muted/30 p-2">
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                    {t("aiEmployee.story.colBrief", "Brief")}
                  </p>
                  <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs leading-relaxed">
                    {plan.briefPreview || "—"}
                  </p>
                </div>

                <div className="scrollbar-hide min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-card p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&_*]:[-ms-overflow-style:none] [&_*]:[scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_*::-webkit-scrollbar]:hidden [&_textarea]:min-h-[4.5rem] [&_textarea]:max-h-[4.5rem]">
                  <OptimizedCommentPanel
                    socialMediaPlanId={plan.id}
                    linkUrl={commentLink}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            {plan.designUrl?.startsWith("https://") ? (
              <Button type="button" variant="outline" size="sm" className="h-8" asChild>
                <a href={plan.designUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {t("aiEmployee.story.openCanva", "Buka di Canva")}
                </a>
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose} disabled={busy}>
              {t("common.close", "Tutup")}
            </Button>
            {canShowApprovalButtons ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={busy || accessLoading}
                  onClick={() => void requestRevision()}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                  {t("aiEmployee.story.requestRevision", "Request Revision")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={busy || accessLoading || alreadyApproved}
                  onClick={() => void approve()}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                  {t("aiEmployee.story.approveProduction", "Approve")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
