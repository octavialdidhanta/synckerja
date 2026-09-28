import { useState } from "react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { beliefsMatch } from "@/thinking-lab/master-thought/semantic";
import type { MasterAdmission, MasterThoughtFacts } from "@/thinking-lab/master-thought/types";

type MasterThoughtSectionProps = {
  locked: boolean;
  busy: boolean;
  priorDraft: string;
  originalDraft: string;
  audienceDraft: string;
  proposalDraft: string;
  facts: MasterThoughtFacts | null;
  admission: MasterAdmission | null;
  confirmedStatement: string | null;
  onPriorChange: (value: string) => void;
  onOriginalChange: (value: string) => void;
  onAudienceChange: (value: string) => void;
  onProposalChange: (value: string) => void;
  onUnderstand: () => void;
  judgmentCurrent?: boolean;
  onClarify: (answer: string) => void;
  onConfirmOriginal: () => void;
  onConfirmProposal: () => void;
  onConfirmEdit: () => void;
};

export function MasterThoughtSection({
  locked,
  busy,
  priorDraft,
  originalDraft,
  audienceDraft,
  proposalDraft,
  facts,
  admission,
  confirmedStatement,
  onPriorChange,
  onOriginalChange,
  onAudienceChange,
  onProposalChange,
  onUnderstand,
  judgmentCurrent = false,
  onClarify,
  onConfirmOriginal,
  onConfirmProposal,
  onConfirmEdit,
}: MasterThoughtSectionProps) {
  const { t } = useAppTranslation();
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const outcome = facts?.outcome ?? null;
  const proposalChanged = Boolean(
    facts?.proposedRootBelief && proposalDraft.trim() !== facts.proposedRootBelief.trim(),
  );
  const canConfirmOriginal =
    admission === "USABLE" &&
    (outcome === "ORIGINAL_READY" || outcome === "PROPOSAL_RECOMMENDED") &&
    !locked;
  const canConfirmProposal =
    admission === "USABLE" &&
    outcome === "PROPOSAL_RECOMMENDED" &&
    Boolean(facts?.proposedRootBelief?.trim()) &&
    !proposalChanged &&
    !locked;
  const canConfirmEdit = outcome === "PROPOSAL_RECOMMENDED" && proposalChanged && !locked;
  const priorLabel = t("thinkingLab.master.prior", "Old belief (false belief)");
  const plantedLabel = t("thinkingLab.master.planted", "New belief (belief shift)");
  const audienceLabel = t("thinkingLab.master.audience", "Target audience (optional)");
  const sameBelief = beliefsMatch(priorDraft, originalDraft);

  return (
    <div className="space-y-3">
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
          placeholder={t(
            "thinkingLab.master.audiencePlaceholder",
            "Example: teenage boys who love motorbikes",
          )}
        />
      </div>
      {outcome ? <Badge variant="secondary">{outcome}</Badge> : null}
      {facts?.subject ? (
        <p className="text-sm text-foreground">
          <span className="font-medium">{t("thinkingLab.master.subject", "Subject")}: </span>
          {facts.subject}
        </p>
      ) : confirmedStatement ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "thinkingLab.master.subjectMissing",
            "The Master Thought subject is not sealed yet. New Big Thoughts wait for that subject.",
          )}
        </p>
      ) : null}
      {outcome === "ORIGINAL_READY" ? (
        <p className="text-sm text-foreground">
          {t("thinkingLab.master.originalReady", "Original input is already a coherent Master Thought.")}
        </p>
      ) : null}
      {outcome === "PROPOSAL_RECOMMENDED" && facts?.proposedRootBelief ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {t("thinkingLab.master.proposal", "Proposed root belief")}
          </p>
          {facts.formulationNote ? <p className="text-sm text-muted-foreground">{facts.formulationNote}</p> : null}
          <Textarea
            aria-label={t("thinkingLab.master.proposal", "Proposed root belief")}
            value={proposalDraft}
            onChange={(event) => onProposalChange(event.target.value)}
            disabled={locked || busy}
            rows={4}
          />
        </div>
      ) : null}
      {outcome === "CLARIFICATION_REQUIRED" && facts?.clarificationQuestion ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {t("thinkingLab.master.clarification", "Clarification needed")}
          </p>
          <p className="text-sm text-foreground">{facts.clarificationQuestion}</p>
          {facts.clarificationOptions?.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={clarificationAnswer === option ? "default" : "outline"}
              disabled={busy || locked}
              onClick={() => setClarificationAnswer(option)}
            >
              {option}
            </Button>
          ))}
          <Textarea
            aria-label={t("thinkingLab.master.clarificationAnswer", "Clarification answer")}
            value={clarificationAnswer}
            onChange={(event) => setClarificationAnswer(event.target.value)}
            disabled={locked || busy}
            rows={3}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => onClarify(clarificationAnswer)}
            disabled={locked || busy || !clarificationAnswer.trim()}
          >
            {t("thinkingLab.action.understandAgain", "Understand again")}
          </Button>
        </div>
      ) : null}
      {facts && facts.unresolvedReasons.length > 0 ? (
        <p className="text-sm text-muted-foreground">{facts.unresolvedReasons.join(", ")}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {outcome === "CLARIFICATION_REQUIRED" || judgmentCurrent ? null : (
          <Button type="button" size="sm" onClick={onUnderstand} disabled={locked || busy || !originalDraft.trim() || sameBelief}>
            {t("thinkingLab.action.understand", "Understand")}
          </Button>
        )}
        {admission ? <Badge variant="secondary">{admission}</Badge> : null}
        {confirmedStatement ? <Badge>{t("thinkingLab.master.confirmed", "Confirmed")}</Badge> : null}
        {facts && outcome !== "CLARIFICATION_REQUIRED" && outcome !== "UNRESOLVED" ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onConfirmOriginal} disabled={busy || !canConfirmOriginal}>
              {t("thinkingLab.action.confirmOriginal", "Confirm original")}
            </Button>
            {outcome === "PROPOSAL_RECOMMENDED" ? (
              <>
                <Button type="button" size="sm" onClick={onConfirmProposal} disabled={busy || !canConfirmProposal}>
                  {t("thinkingLab.action.confirmProposal", "Confirm proposal")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onConfirmEdit} disabled={busy || !canConfirmEdit}>
                  {t("thinkingLab.action.confirmEdit", "Confirm edit")}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {confirmedStatement ? (
        <p className="text-sm text-foreground">
          <span className="font-medium">{t("thinkingLab.master.parent", "Parent belief")}: </span>
          {confirmedStatement}
        </p>
      ) : null}
    </div>
  );
}
