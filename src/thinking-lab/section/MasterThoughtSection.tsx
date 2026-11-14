import { Loader2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { beliefsMatch } from "@/thinking-lab/master-thought/semantic";
import type { BeliefOption } from "@/thinking-lab/master-thought/types";

type MasterThoughtSectionProps = {
  locked: boolean;
  busy: boolean;
  suggesting: boolean;
  saving: boolean;
  priorDraft: string;
  originalDraft: string;
  audienceDraft: string;
  options: BeliefOption[];
  confirmedStatement: string | null;
  onPriorChange: (value: string) => void;
  onOriginalChange: (value: string) => void;
  onAudienceChange: (value: string) => void;
  onSuggest: () => void;
  onSave: () => void;
  className?: string;
};

/**
 * One flow: write the old and the new belief, optionally ask for three options and pick one into the field,
 * then Save. Save runs the switched-on Master Thought checks; only a pass is kept.
 */
export function MasterThoughtSection({
  locked,
  busy,
  suggesting,
  saving,
  priorDraft,
  originalDraft,
  audienceDraft,
  options,
  confirmedStatement,
  onPriorChange,
  onOriginalChange,
  onAudienceChange,
  onSuggest,
  onSave,
  className,
}: MasterThoughtSectionProps) {
  const { t } = useAppTranslation();
  const priorLabel = t("thinkingLab.master.prior", "Old belief (false belief)");
  const plantedLabel = t("thinkingLab.master.planted", "New belief (belief shift)");
  const audienceLabel = t("thinkingLab.master.audience", "Target audience (optional)");
  const sameBelief = beliefsMatch(priorDraft, originalDraft);
  const canWrite = !locked && !busy && Boolean(priorDraft.trim()) && Boolean(originalDraft.trim()) && !sameBelief;
  const savedAsWritten = Boolean(confirmedStatement) && beliefsMatch(confirmedStatement ?? "", originalDraft);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{priorLabel}</p>
          <Textarea
            aria-label={priorLabel}
            value={priorDraft}
            onChange={(event) => onPriorChange(event.target.value)}
            disabled={locked || busy}
            rows={3}
            placeholder={t(
              "thinkingLab.master.priorPlaceholder",
              "Example: the fastest bike is the most important thing to chase right now",
            )}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{plantedLabel}</p>
          <Textarea
            id="thinking-lab-belief"
            aria-label={plantedLabel}
            value={originalDraft}
            onChange={(event) => onOriginalChange(event.target.value)}
            disabled={locked || busy}
            rows={3}
            placeholder={t(
              "thinkingLab.master.plantedPlaceholder",
              "Example: money while young is more valuable when saved",
            )}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{audienceLabel}</p>
          <Textarea
            aria-label={audienceLabel}
            value={audienceDraft}
            onChange={(event) => onAudienceChange(event.target.value)}
            disabled={locked || busy}
            rows={2}
            placeholder={t("thinkingLab.master.audiencePlaceholder", "Example: teenage boys who love motorbikes")}
          />
        </div>
        {sameBelief ? (
          <p className="text-sm text-muted-foreground">
            {t("thinkingLab.master.sameBelief", "The old belief and the new belief say the same thing. Change the new belief.")}
          </p>
        ) : null}
        {suggesting ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t("thinkingLab.master.offering", "Writing belief options...")}
          </p>
        ) : null}
        {!suggesting && options.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("thinkingLab.master.beliefOptions", "Pick one belief")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                "thinkingLab.master.beliefOptionsHint",
                "Each option already passed the switched-on checks. Picking one puts it in the new belief field; edit it if you like, then Save.",
              )}
            </p>
            <div className="flex flex-col gap-2">
              {options.map((option) => (
                <Button
                  key={option.belief}
                  type="button"
                  variant="outline"
                  className="h-auto w-full items-start whitespace-normal px-3 py-2 text-left"
                  disabled={locked || busy}
                  onClick={() => onOriginalChange(option.belief)}
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium text-foreground">{option.belief}</span>
                    {option.description ? (
                      <span className="text-sm font-normal text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {confirmedStatement ? (
          <p className="text-sm text-foreground">
            <span className="font-medium">{t("thinkingLab.master.parent", "Parent belief")}: </span>
            {confirmedStatement}
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onSuggest}
          disabled={!canWrite}
          aria-busy={suggesting || undefined}
        >
          {suggesting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("thinkingLab.action.suggestBeliefs", "Bantu rumuskan")}
        </Button>
        {savedAsWritten ? <Badge>{t("thinkingLab.master.confirmed", "Confirmed")}</Badge> : null}
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          onClick={onSave}
          disabled={!canWrite || savedAsWritten}
          aria-busy={saving || undefined}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("thinkingLab.action.saveMaster", "Simpan Master Thought")}
        </Button>
      </div>
    </div>
  );
}
