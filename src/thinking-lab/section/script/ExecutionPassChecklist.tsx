import { Check, Circle, Loader2, X } from "lucide-react";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

const EXECUTION_PASS_CHECK_LABELS: Record<string, string> = {
  hookHolds: "The first sentence uses this pillar's format and the situation is clear",
  soundsSpoken: "The lines sound like everyday speech",
  usesSlang: "The lines use slang",
  formatHolds: "The spoken lines use this pillar's format",
  pillarFits: "The pillar does not force a message outside the Idea",
  mechanismVisible: "The Idea's mechanism is visible",
  messageStays: "The script does not add a claim",
  causeChain: "The cause is the Big Thought's stake, not an advertisement",
  viewerClimb: "The viewer climbs from the mechanism to the Master Thought",
  emotionalTone: "The story shows the person it happens to",
  imageShape: "The slide count matches the image settings",
  imagePrompt: "The image prompt visualizes this slide and can be pasted into an image generator",
  imageCaption: "The caption does not copy the slides",
};

export function ExecutionPassChecklist({
  checks,
  onToggle,
  pending = false,
}: {
  checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; enabled?: boolean; reason?: string }>;
  onToggle?: (id: string, enabled: boolean) => void;
  pending?: boolean;
}) {
  const { t } = useAppTranslation();
  const running = checks.find((check) => check.state === "running" && check.enabled !== false);
  const runningLabel = running
    ? t(`thinkingLab.execution.pass.${running.id}`, EXECUTION_PASS_CHECK_LABELS[running.id] ?? running.id)
    : "";
  return (
    <div className="space-y-1">
      {running ? (
        <p className="text-sm text-foreground">
          {t("thinkingLab.bt.pass.checking", "Checking this requirement: {{gate}}", { gate: runningLabel })}
        </p>
      ) : null}
      <ul className="space-y-1" aria-label={t("thinkingLab.territory.pass.list", "Pass checklist")}>
        {checks.map((check) => {
          const off = check.enabled === false;
          const label = t(`thinkingLab.execution.pass.${check.id}`, EXECUTION_PASS_CHECK_LABELS[check.id] ?? check.id);
          return (
            <li key={check.id} className="text-sm">
              <div className="flex items-start gap-2">
                <p className="flex min-w-0 flex-1 items-start gap-2">
                  {off ? (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : check.state === "running" ? (
                    <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                  ) : check.state === "pass" ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
                  ) : check.state === "pending" ? (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
                  )}
                  <span className={off ? "text-muted-foreground" : check.state === "fail" ? "text-destructive" : "text-foreground"}>
                    {label}
                  </span>
                </p>
                {onToggle ? (
                  <Switch
                    checked={!off}
                    disabled={pending || check.state === "running"}
                    onCheckedChange={(checked) => onToggle(check.id, checked)}
                    aria-label={t("thinkingLab.execution.passToggle", "Use this requirement: {{gate}}", { gate: label })}
                    className="mt-0.5"
                  />
                ) : null}
              </div>
              {!off && check.state === "fail" && check.reason ? (
                <p className="mt-0.5 pl-5 text-sm text-muted-foreground">{check.reason}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}