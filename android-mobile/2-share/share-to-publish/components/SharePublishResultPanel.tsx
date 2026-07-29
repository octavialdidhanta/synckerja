import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useScheduledPostsByPlan } from "@/6-1-scheduled-posts/hooks/useScheduledPostsByPlan";
import { pickPlatformScheduleForModal } from "@/6-1-scheduled-posts/lib/pickPlatformScheduleDisplay";
import { resolvePublishErrorKey } from "@/6-1-scheduled-posts/lib/resolvePublishErrorKey";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { SharePublishPlatformResult } from "../hooks/useSharePublishActions";

type DisplayStatus = "ok" | "processing" | "failed";

type ResolvedResult = SharePublishPlatformResult & {
  display: DisplayStatus;
  displayError?: string;
};

type Props = {
  results: SharePublishPlatformResult[];
  planId?: string;
};

function resolveDisplayStatus(
  result: SharePublishPlatformResult,
  schedules: ReturnType<typeof useScheduledPostsByPlan>["data"],
): ResolvedResult {
  if (!result.ok) {
    return { ...result, display: "failed", displayError: result.error };
  }

  if (!result.processing) {
    return { ...result, display: "ok" };
  }

  const schedule = pickPlatformScheduleForModal(schedules ?? [], result.platform);
  if (!schedule) {
    return { ...result, display: "processing" };
  }

  if (schedule.status === "published") {
    return { ...result, display: "ok" };
  }

  if (schedule.status === "failed") {
    return {
      ...result,
      display: "failed",
      displayError: schedule.error_message ?? "failed",
    };
  }

  if (schedule.status === "pending" || schedule.status === "publishing") {
    return { ...result, display: "processing" };
  }

  return { ...result, display: "ok" };
}

export function SharePublishResultPanel({ results, planId }: Props) {
  const { t } = useAppTranslation();
  const { data: schedules } = useScheduledPostsByPlan(planId);

  const resolved = useMemo(
    () => results.map((r) => resolveDisplayStatus(r, schedules)),
    [results, schedules],
  );

  const hasProcessing = resolved.some((r) => r.display === "processing");

  if (!resolved.length) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-white p-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        {t("share.publish.results.title", "Publish results")}
      </p>
      {hasProcessing ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "share.publish.results.bulkProcessingHint",
            "Publishing in background — YouTube/TikTok may finish at different times.",
          )}
        </p>
      ) : null}
      <ul className="mt-2 space-y-2">
        {resolved.map((r, idx) => {
          const errorKey = resolvePublishErrorKey(r.displayError ?? r.error);
          const errorLabel =
            r.display === "failed"
              ? t(errorKey, r.displayError || r.error || t("share.publish.results.failed", "Failed"))
              : null;

          return (
            <li
              key={`${r.platform}-${r.accountLabel}-${idx}`}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {r.platform}
                {r.accountLabel ? ` · ${r.accountLabel}` : ""}
              </span>
              <span
                className={cn(
                  "flex max-w-[55%] shrink-0 items-center justify-end gap-1 text-right text-xs font-medium",
                  r.display === "ok" && "text-emerald-700",
                  r.display === "processing" && "text-amber-700",
                  r.display === "failed" && "text-destructive",
                )}
                title={r.display === "failed" && (r.displayError ?? r.error) ? (r.displayError ?? r.error) : undefined}
              >
                {r.display === "processing" ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("share.publish.results.processing", "Processing")}
                  </>
                ) : r.display === "ok" ? (
                  t("share.publish.results.ok", "OK")
                ) : (
                  errorLabel
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
