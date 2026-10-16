import { useEffect, useRef, useState } from "react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { beliefsMatch, masterRecovery, masterRecoveryQuestionKey } from "@/thinking-lab/master-thought/semantic";
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
  onClarify: (answer: string, question?: string) => void;
  onOpenChoices: (question: string) => Promise<string[]>;
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
  onOpenChoices,
  onConfirmOriginal,
  onConfirmProposal,
  onConfirmEdit,
}: MasterThoughtSectionProps) {
  const { t } = useAppTranslation();
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
  const recovery = judgmentCurrent ? masterRecovery(facts, originalDraft, priorDraft) : null;
  const recoverReason = facts?.unresolvedReasons[0] ?? "UNRESOLVED";
  const recoverQuestion = t(
    masterRecoveryQuestionKey(recoverReason),
    "Write what this new belief means in one sentence.",
  );

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
      {outcome && outcome !== "UNRESOLVED" ? <Badge variant="secondary">{outcome}</Badge> : null}
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
          <p className="text-sm text-foreground">{facts.clarificationQuestion}</p>
          <BeliefChoices
            key={`${facts.clarificationQuestion}\n${originalDraft}\n${priorDraft}`}
            question={facts.clarificationQuestion}
            preset={facts.clarificationOptions ?? []}
            locked={locked}
            busy={busy}
            onUse={(choice) => onClarify(choice)}
            onOpenChoices={onOpenChoices}
          />
        </div>
      ) : null}
      {facts && facts.unresolvedReasons.length > 0 && !recovery ? (
        <p className="text-sm text-muted-foreground">
          {facts.unresolvedReasons
            .map((reason) =>
              t(
                `thinkingLab.master.reason.${reason}`,
                t("thinkingLab.master.reason.fallback", "This belief could not be understood yet."),
              ),
            )
            .filter((line, index, lines) => lines.indexOf(line) === index)
            .join(" ")}
        </p>
      ) : null}
      {recovery === "clarify" ? (
        <BeliefChoices
          key={recoverQuestion}
          question={recoverQuestion}
          preset={[]}
          locked={locked}
          busy={busy}
          onUse={(choice) => onClarify(choice, recoverQuestion)}
          onOpenChoices={onOpenChoices}
        />
      ) : null}
      {recovery === "retry" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t("thinkingLab.master.recover.retry", "The reading did not come back. Try again.")}
          </p>
          <Button type="button" size="sm" onClick={onUnderstand} disabled={locked || busy}>
            {t("thinkingLab.action.tryAgain", "Try again")}
          </Button>
        </div>
      ) : null}
      {recovery === "edit" ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "thinkingLab.master.recover.same",
            "The old belief and the new belief say the same thing. Change the new belief, then understand it again.",
          )}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {outcome === "CLARIFICATION_REQUIRED" || judgmentCurrent ? null : (
          <Button type="button" size="sm" onClick={onUnderstand} disabled={locked || busy || !originalDraft.trim() || sameBelief}>
            {t("thinkingLab.action.understand", "Understand")}
          </Button>
        )}
        {admission && admission !== "UNRESOLVED" ? <Badge variant="secondary">{admission}</Badge> : null}
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

function BeliefChoices({
  question,
  preset,
  locked,
  busy,
  onUse,
  onOpenChoices,
}: {
  question: string;
  preset: string[];
  locked: boolean;
  busy: boolean;
  onUse: (choice: string) => void;
  onOpenChoices: (question: string) => Promise<string[]>;
}) {
  const { t } = useAppTranslation();
  const [opened, setOpened] = useState<string[]>([]);
  const [asked, setAsked] = useState(false);
  const [opening, setOpening] = useState(preset.length === 0);
  const openRef = useRef(onOpenChoices);
  openRef.current = onOpenChoices;
  const choices = [...preset, ...opened].filter((choice, index, all) => all.indexOf(choice) === index);

  const load = () => {
    setOpening(true);
    void openRef
      .current(question)
      .then((next) => {
        setOpened(next);
        setAsked(true);
      })
      .finally(() => setOpening(false));
  };

  useEffect(() => {
    if (preset.length > 0) return;
    let cancelled = false;
    setOpening(true);
    void openRef
      .current(question)
      .then((next) => {
        if (cancelled) return;
        setOpened(next);
        setAsked(true);
      })
      .finally(() => {
        if (!cancelled) setOpening(false);
      });
    return () => {
      cancelled = true;
    };
  }, [question, preset.length]);

  return (
    <div className="space-y-2">
      {opening ? (
        <p className="text-sm text-muted-foreground">{t("thinkingLab.action.openChoices", "Open choices")}…</p>
      ) : null}
      <div className="flex flex-col items-start gap-2">
        {choices.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant="outline"
            className="h-auto whitespace-normal text-left"
            disabled={busy || locked || opening}
            onClick={() => onUse(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      {!opening && asked && choices.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t("thinkingLab.master.recover.noChoices", "No distinct choices came back. Write the sentence yourself.")}
          </p>
          <Button type="button" size="sm" variant="outline" disabled={locked || busy} onClick={load}>
            {t("thinkingLab.action.openChoices", "Open choices")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
