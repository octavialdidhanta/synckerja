import { Check, Circle, Loader2, Wrench, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export const TERRITORY_PASS_CHECK_LABELS: Record<string, string> = {
  partOfBigThought: "Part of the Big Thought, not a keyword of it",
  audienceLanguage: "Audience language, not an internal term",
  questionArises: "The question the Big Thought answers comes up here",
  wideEnough: "Wide enough for several Angles",
  siblingsDistinct: "Does not overlap a sibling Territory",
};

export const ANGLE_PASS_CHECK_LABELS: Record<string, string> = {
  stakeHolds: "Still depends on the Territory, Big Thought, and Master Thought",
  observation:
    "An observation: rarely noticed, a contradiction, or a tension; not a reason or a restatement of the Territory",
  rightSize: "Narrower than the Territory with a clear boundary, yet room for several Ideas",
  ownSubject: "A short subject of its own, not the Territory's name",
  livedExample: "A concrete example of the observation",
  siblingsDistinct: "Does not overlap a sibling Angle",
};

export const IDEA_PASS_CHECK_LABELS: Record<string, string> = {
  proposal: "One proposal: We … so that …, naming what is made and what becomes true",
  mechanism: "A clear mechanism: comparison, experiment, demonstration, or situation",
  result: "What becomes true follows from the mechanism, not explained in words",
  stakeHolds: "Still depends on the stake of the Angle and its ancestors",
  causeLock: "The Master Thought subject is the only plausible cause",
  watchable: "The stored audience can watch it or join it",
  distinct: "Differs from every other passed Idea",
};

export function checkRowFailed(
  verdict: string | null | undefined,
  checks?: Array<{ state: string }>,
): boolean {
  return verdict === "AUDIT_FAIL" || (checks ?? []).some((check) => check.state === "fail");
}

export type PassChecklistProps = {
  checks?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
  note?: string;
  labelPrefix?: string;
  onFix?: () => void;
  fixLabel?: string;
  fixing?: boolean;
  blocked?: boolean;
  showPending?: boolean;
  report?: { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" | "unverified" } | null;
};

export function PassChecklist({
  checks,
  note,
  labelPrefix = "thinkingLab.territory.pass",
  onFix,
  fixLabel,
  fixing = false,
  blocked = false,
  showPending = false,
  report = null,
}: PassChecklistProps) {
  const { t } = useAppTranslation();
  const labels = labelPrefix.endsWith("idea.pass")
    ? IDEA_PASS_CHECK_LABELS
    : labelPrefix.endsWith("angle.pass")
      ? ANGLE_PASS_CHECK_LABELS
      : TERRITORY_PASS_CHECK_LABELS;
  const visible = (checks ?? []).filter(
    (check) => showPending || check.state !== "pending" || Boolean(check.reason?.trim()),
  );
  const visibleNote = note && /failed \d+ time\(s\)/.test(note) ? "" : note;
  const reportLabel = report ? t(`${labelPrefix}.${report.gate}`, labels[report.gate] ?? report.gate) : "";
  const reportText = !report
    ? t("thinkingLab.bt.pass.notYet", "No requirement has been checked yet.")
    : report.phase === "checking"
      ? t("thinkingLab.bt.pass.checking", "Checking this requirement: {{gate}}", { gate: reportLabel })
      : report.outcome === "fail"
        ? t("thinkingLab.bt.pass.checkedFail", "Checked: {{gate}} It did not pass.", { gate: reportLabel })
        : report.outcome === "unverified"
          ? t("thinkingLab.bt.pass.checkedOpen", "Checked: {{gate}} It is not verified yet.", { gate: reportLabel })
          : t("thinkingLab.bt.pass.checkedPass", "Checked: {{gate}} It passed.", { gate: reportLabel });
  if (!showPending && !visibleNote && visible.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {showPending && !report ? (
        <p className="text-sm text-foreground">{t("thinkingLab.bt.pass.notYet", "No requirement has been checked yet.")}</p>
      ) : null}
      {report ? <p className="text-sm text-foreground">{reportText}</p> : null}
      {visibleNote ? <p className="text-sm text-destructive">{visibleNote}</p> : null}
      {visible.length > 0 ? (
        <ul className="space-y-1" aria-label={t("thinkingLab.territory.pass.list", "Pass checklist")}>
          {visible.map((check) => (
            <li key={check.id} className="text-sm">
              <p className="flex items-start gap-2">
                {check.state === "running" ? (
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                ) : check.state === "pass" ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
                ) : check.state === "pending" ? (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
                )}
                <span className={check.state === "fail" ? "text-destructive" : "text-foreground"}>
                  {t(`${labelPrefix}.${check.id}`, labels[check.id] ?? check.id)}
                </span>
              </p>
              {check.reason && check.state !== "running" ? (
                <p className="mt-0.5 whitespace-pre-line pl-5 text-sm text-muted-foreground">{check.reason}</p>
              ) : null}
              {check.state === "fail" && onFix ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-5 mt-1 h-7 gap-1.5 px-2"
                  disabled={fixing || blocked}
                  aria-busy={fixing || undefined}
                  onClick={onFix}
                >
                  {fixing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Wrench className="h-3.5 w-3.5" />
                  )}
                  {fixLabel ?? t("thinkingLab.action.revise", "Revise")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** @deprecated Use PassChecklist */
export const TerritoryPassChecklist = PassChecklist;