import { Loader2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type CanvaStoryRun = {
  social_media_plan_id: string;
  status: string;
  design_url: string | null;
  error: string | null;
  images_ready?: boolean;
  refresh_requested?: boolean;
  revision_requested?: boolean;
  export_path?: string | null;
};

export function CanvaStoryNote({
  run,
  showSuccess = true,
}: {
  run: CanvaStoryRun | null | undefined;
  showSuccess?: boolean;
}) {
  const { t } = useAppTranslation();
  if (!run) return null;

  const failedSentence = (error: string | null): string => {
    if (error === "story_brief_missing") {
      return t("aiEmployee.story.canvaBriefMissing", "Canva tidak jalan: brief Story belum lengkap");
    }
    if (error === "canva_not_connected" || error === "canva_dispatch_missing") {
      return t("aiEmployee.story.canvaNotConnected", "Canva belum terhubung");
    }
    if (error === "canva_tool_missing") {
      return t("aiEmployee.story.canvaToolMissing", "Canva belum punya alat desain");
    }
    if (error === "not_approved") {
      return t("aiEmployee.story.canvaNotApproved", "Persetujuan berubah sebelum desain dibuat");
    }
    if (error === "not_story") {
      return t("aiEmployee.story.canvaNotStory", "Bukan plan Story");
    }
    if (error === "story_comments_missing") {
      return t("aiEmployee.story.canvaRevisionNeedComment", "Canva revisi butuh komentar review");
    }
    if (
      error === "revision_failed"
      || error === "revision_unsupported"
      || error === "revision_layout_unsupported"
      || error === "revision_style_limited"
      || error === "revision_edit_failed"
      || error === "revision_commit_failed"
      || error === "revision_model_missing"
      || error === "revision_model_failed"
      || error === "revision_image_failed"
      || error === "revision_no_effect"
      || error === "revision_create_failed"
      || error === "revision_create_timeout"
      || error === "revision_design_missing"
      || error === "revision_plan_missing"
    ) {
      return error === "revision_no_effect"
        ? t(
          "aiEmployee.story.canvaRevisionNoEffect",
          "Canva tidak mengubah desain dari komentar — coba komentar lebih spesifik atau edit manual di Canva",
        )
        : t("aiEmployee.story.canvaRevisionFailed", "Canva gagal merevisi Story dari komentar");
    }
    const detail = String(error ?? "").replace(/^canva_job_failed:/, "").trim();
    const lower = detail.toLowerCase();
    if (lower.includes("credit_quota") || lower.includes("credit quota")) {
      return t(
        "aiEmployee.story.canvaCreditQuota",
        "Canva gagal: kuota AI Canva habis / cooldown — buka Billing Canva",
      );
    }
    if (detail && detail !== "canva_failed") {
      return t("aiEmployee.story.canvaFailedDetail", "Canva gagal: {{detail}}", {
        detail: detail.slice(0, 120),
      });
    }
    return t("aiEmployee.story.canvaFailed", "Canva gagal membuat desain Story");
  };

  if (run.revision_requested && run.status === "succeeded") {
    return <WorkingNote text={t("aiEmployee.story.canvaRevising", "Canva sedang merevisi Story")} />;
  }
  if (
    run.refresh_requested
    && (run.status === "succeeded" || run.status === "queued" || run.status === "running")
  ) {
    return <WorkingNote text={t("aiEmployee.story.canvaRefreshing", "Canva sedang memperbarui Story")} />;
  }
  if (run.status === "queued" || run.status === "running") {
    return <WorkingNote text={t("aiEmployee.story.canvaWorking", "Canva sedang membuat Story")} />;
  }
  if (run.status === "failed" || (run.status === "succeeded" && run.error)) {
    return <p className="text-[11px] leading-4 text-destructive">{failedSentence(run.error)}</p>;
  }
  if (showSuccess && run.status === "succeeded" && run.design_url?.startsWith("https://")) {
    return (
      <p className="text-[11px] leading-4">
        <a href={run.design_url} target="_blank" rel="noreferrer" className="text-primary underline">
          {t("aiEmployee.story.canvaOpen", "Buka desain Canva")}
        </a>
      </p>
    );
  }
  return null;
}

function WorkingNote({ text }: { text: string }) {
  return (
    <p className="inline-flex items-center gap-1 text-[11px] leading-4 text-blue-700">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      {text}
    </p>
  );
}
