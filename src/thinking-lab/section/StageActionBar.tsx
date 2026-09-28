import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { StageAction } from "@/thinking-lab/big-thought/lock";

type StageActionBarProps = {
  action: StageAction | null;
  busy: boolean;
  showSpinner?: boolean;
  onGenerate: () => void;
  onAudit: () => void;
  onFix: () => void;
  onChallenger: () => void;
  onLock: () => void;
};

export function StageActionBar({
  action,
  busy,
  showSpinner = true,
  onGenerate,
  onAudit,
  onFix,
  onChallenger,
  onLock,
}: StageActionBarProps) {
  const { t } = useAppTranslation();
  if (!action) return null;

  const label =
    action === "fix"
      ? t("thinkingLab.action.fix", "Fix")
      : action === "generate"
        ? t("thinkingLab.action.generate", "Generate")
        : action === "audit"
          ? t("thinkingLab.action.audit", "Audit")
          : action === "challenger"
            ? t("thinkingLab.action.challenger", "Challenger")
            : t("thinkingLab.action.lock", "Lock");
  const onClick =
    action === "fix" ? onFix : action === "generate" ? onGenerate : action === "audit" ? onAudit : action === "challenger" ? onChallenger : onLock;

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={onClick} disabled={busy} aria-busy={busy}>
        {busy && showSpinner ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {label}
      </Button>
    </div>
  );
}
