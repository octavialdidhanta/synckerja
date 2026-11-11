import { Loader2 } from "lucide-react";

export type CanvaCarouselRun = {
  social_media_plan_id: string;
  status: string;
  design_url: string | null;
  error: string | null;
  images_ready?: boolean;
  refresh_requested?: boolean;
  revision_requested?: boolean;
};

function failedSentence(error: string | null): string {
  if (error === "slides_missing") return "Canva tidak jalan: teks slide belum ada";
  if (error === "canva_not_connected" || error === "canva_dispatch_missing") return "Canva belum terhubung";
  if (error === "canva_tool_missing") return "Canva belum punya alat desain";
  if (error === "not_approved") return "Persetujuan berubah sebelum desain dibuat";
  const detail = String(error ?? "").replace(/^canva_job_failed:/, "").trim();
  if (detail && detail !== "canva_failed") return `Canva gagal: ${detail.slice(0, 120)}`;
  return "Canva gagal membuat desain";
}

export function CanvaCarouselNote({
  run,
  showSuccess,
  onPrimary = false,
}: {
  run: CanvaCarouselRun | null | undefined;
  showSuccess: boolean;
  onPrimary?: boolean;
}) {
  if (!run) return null;
  if (run.revision_requested && run.status === "succeeded") {
    return <CanvaWorkingNote text="Canva sedang merevisi" onPrimary={onPrimary} />;
  }
  if (run.status === "queued" || run.status === "running") {
    return <CanvaWorkingNote text="Canva sedang membuat desain" onPrimary={onPrimary} />;
  }
  if (run.status === "failed") {
    return (
      <p className={onPrimary ? "text-[11px] leading-4 text-white" : "text-[11px] leading-4 text-destructive"}>
        {failedSentence(run.error)}
      </p>
    );
  }
  if (showSuccess && run.status === "succeeded" && run.design_url?.startsWith("https://")) {
    return (
      <p className="text-[11px] leading-4">
        <a
          href={run.design_url}
          target="_blank"
          rel="noreferrer"
          className={onPrimary ? "text-white underline" : "text-primary underline"}
        >
          Buka desain Canva
        </a>
      </p>
    );
  }
  return null;
}

function CanvaWorkingNote({ text, onPrimary = false }: { text: string; onPrimary?: boolean }) {
  return (
    <p
      role="status"
      className={
        onPrimary
          ? "inline-flex items-center gap-1 text-[11px] leading-4 text-white/85"
          : "inline-flex items-center gap-1 text-[11px] leading-4 text-muted-foreground"
      }
    >
      <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
      {text}
    </p>
  );
}
