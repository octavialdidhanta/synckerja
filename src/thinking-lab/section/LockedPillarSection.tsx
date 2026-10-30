import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CreativeFormat } from "@/thinking-lab/creative-idea/types";
import { ExecutionPassChecklist, SpokenReading } from "@/thinking-lab/section/ExecutionScriptPanel";
import type { VoiceOverScript } from "@/thinking-lab/execution/script";

const FORMAT_ORDER: CreativeFormat[] = ["video", "carousel", "post"];

export function LockedPillarSection({
  name,
  leadMagnet = false,
  development,
  reason,
  format,
  pending = false,
  pathUp,
  progress,
  checks,
  reading,
  onStop,
  onSelectFormat,
}: {
  name: string;
  leadMagnet?: boolean;
  development: string;
  reason: string;
  format: CreativeFormat | null;
  pending?: boolean;
  pathUp?: Array<{ label: string; title: string }>;
  progress?: { phase: "write" | "audit" | "repair" | "line" | "recommend" | "switch"; pillarName: string; medium?: "image" } | null;
  checks?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }> | null;
  reading?: VoiceOverScript | null;
  onStop?: () => void;
  onSelectFormat: (format: CreativeFormat) => void;
}) {
  const { t } = useAppTranslation();
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header className="min-w-0 space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-sky-700">
          <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] bg-sky-500" aria-hidden />
          <span>
            {leadMagnet
              ? `${t("thinkingLab.tree.pillar", "Pillar")} - ${t("thinkingLab.tree.leadMagnet", "Lead Magnet")}`
              : t("thinkingLab.tree.pillar", "Pillar")}
          </span>
        </p>
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">{name}</h2>
        {development.trim() ? (
          <p className="text-[15px] leading-relaxed text-slate-800">
            <span className="text-slate-500">{t("thinkingLab.creative.pillarDevelopment", "In this pillar the idea becomes")}: </span>
            {development}
          </p>
        ) : null}
        {reason.trim() ? (
          <p className="text-[15px] leading-relaxed text-slate-800">
            <span className="text-slate-500">{t("thinkingLab.creative.pillarReason", "Why this pillar is recommended")}: </span>
            {reason}
          </p>
        ) : null}
      </header>
      <div className="flex flex-wrap gap-1" role="group" aria-label={t("thinkingLab.creative.formatLabel", "Content format")}>
        {FORMAT_ORDER.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={format === item ? "default" : "outline"}
            aria-pressed={format === item}
            disabled={pending}
            onClick={() => onSelectFormat(item)}
          >
            {t(`thinkingLab.creative.format.${item}`, item === "post" ? "Static Post" : item === "carousel" ? "Carousel" : "Video")}
          </Button>
        ))}
      </div>
      {progress ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {progress.phase === "write"
              ? progress.medium === "image"
                ? t("thinkingLab.execution.writingSlides", "Writing the slides for {{pillar}}...", { pillar: progress.pillarName })
                : t("thinkingLab.execution.writing", "Writing the voice-over script for {{pillar}}...", { pillar: progress.pillarName })
              : progress.phase === "repair"
                ? t("thinkingLab.execution.repairing", "Repairing only the failing lines...")
                : progress.phase === "line"
                  ? t("thinkingLab.execution.rewritingLine", "Rewriting this line so the requirements that are switched on still pass...")
                  : progress.phase === "switch"
                    ? t("thinkingLab.execution.rewritingSwitch", "Rewriting the lines for this requirement...")
                  : progress.phase === "recommend"
                    ? t("thinkingLab.execution.recommending", "Looking for a pillar that can carry this Idea...")
                    : t("thinkingLab.execution.auditing", "Tracing the script path up to the Master Thought...")}
          </p>
          {onStop ? (
            <Button type="button" size="sm" variant="outline" onClick={onStop}>
              {t("thinkingLab.execution.stop", "Stop")}
            </Button>
          ) : null}
          {reading ? <SpokenReading script={reading} /> : null}
          {checks && checks.length > 0 ? <ExecutionPassChecklist checks={checks} /> : null}
        </div>
      ) : null}
      {pathUp && pathUp.length > 0 ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("thinkingLab.tree.pathUp", "Path up")}</p>
          <ul className="space-y-2">
            {pathUp.map((item) => (
              <li key={`${item.label}-${item.title}`} className="border-l-2 border-border pl-2">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm text-foreground">{item.title}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
