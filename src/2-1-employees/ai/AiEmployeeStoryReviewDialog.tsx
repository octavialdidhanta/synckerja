import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { OptimizedCommentPanel } from "@/6-1-dashboard/modal/OptimizedCommentPanel";
import { useProdApprovalAccess } from "@/6-1-dashboard/hook/useProdApprovalAccess";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const { canShowApprovalButtons, loading: accessLoading } = useProdApprovalAccess(open && Boolean(plan));
  const [busy, setBusy] = useState(false);

  if (!plan) return null;

  const previewUrl = plan.exportPath ? storyExportPublicUrl(plan.exportPath) : "";
  const commentLink = plan.designUrl?.startsWith("https://")
    ? plan.designUrl
    : previewUrl || "story-export";
  const alreadyApproved = plan.productionApproved || plan.productionStatus === "Approved";
  const inRevision = plan.productionStatus === "Request Revision";

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

      toast({
        title: t("aiEmployee.story.reviewRevision", "Revisi produksi diminta"),
        description: t(
          "aiEmployee.story.reviewRevisionHint",
          "Edit di Canva, lalu Perbarui dari Canva di tabel Plan Story.",
        ),
      });
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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("aiEmployee.story.reviewTitle", "Review Story")}</DialogTitle>
          <DialogDescription>
            {t(
              "aiEmployee.story.reviewDesc",
              "Review desain produksi (bukan ulang approve konten). Setelah Approve, lanjut ke Story Publish Setup.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[minmax(0,16rem)_1fr]">
          <div className="flex flex-col gap-2">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={t("aiEmployee.story.reviewPreviewAlt", "Preview Story")}
                className="w-full rounded-md border border-border object-cover"
              />
            ) : (
              <div className="flex min-h-[20rem] items-center justify-center rounded-md border border-dashed border-border bg-muted/40 px-3 text-center text-sm text-muted-foreground">
                {t("aiEmployee.story.reviewNoPreview", "Belum ada export JPG. Perbarui dari Canva dulu.")}
              </div>
            )}
            {plan.designUrl?.startsWith("https://") ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={plan.designUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {t("aiEmployee.story.openCanva", "Buka di Canva")}
                </a>
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {t("aiEmployee.story.reviewProdStatus", "Status produksi")}:{" "}
              {alreadyApproved
                ? t("aiEmployee.story.prodApproved", "Approved")
                : inRevision
                  ? t("aiEmployee.story.prodRevision", "Request Revision")
                  : plan.productionStatus || t("aiEmployee.story.prodNeedReview", "Need Review")}
            </p>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                {t("aiEmployee.story.colBrief", "Brief")}
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 text-xs">
                {plan.briefPreview || "—"}
              </p>
            </div>
            <div className="min-h-[14rem] rounded-md border border-border p-2">
              <OptimizedCommentPanel
                socialMediaPlanId={plan.id}
                linkUrl={commentLink}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t("common.close", "Tutup")}
          </Button>
          {canShowApprovalButtons ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy || accessLoading}
                onClick={() => void requestRevision()}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {t("aiEmployee.story.requestRevision", "Request Revision")}
              </Button>
              <Button
                type="button"
                disabled={busy || accessLoading || alreadyApproved}
                onClick={() => void approve()}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {t("aiEmployee.story.approveProduction", "Approve")}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
