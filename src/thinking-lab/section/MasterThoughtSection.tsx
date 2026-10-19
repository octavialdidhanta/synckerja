import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  beliefsMatch,
  masterRecovery,
  masterRecoveryQuestionKey,
  parseMasterChoiceSet,
  type MasterChoiceSet,
} from "@/thinking-lab/master-thought/semantic";
import type { MasterAdmission, MasterThoughtFacts } from "@/thinking-lab/master-thought/types";

type MasterThoughtSectionProps = {
  locked: boolean;
  busy: boolean;
  understanding?: boolean;
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
  onKeepOriginal: () => void;
  onUseSubject: (answer: string, question?: string) => void;
  onUseBelief: (belief: string) => void;
  onPickBelief: (belief: string) => void;
  onOpenChoices: (question: string) => Promise<MasterChoiceSet>;
  onConfirmOriginal: () => void;
  onConfirmProposal: () => void;
  onConfirmEdit: () => void;
  className?: string;
};

function displaySubject(subject: string): string {
  const characters = Array.from(subject);
  const index = characters.findIndex((character) => /\p{L}/u.test(character));
  if (index < 0) return subject;
  characters[index] = characters[index].toLocaleUpperCase();
  return characters.join("");
}

export function MasterThoughtSection({
  locked,
  busy,
  understanding = false,
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
  onKeepOriginal,
  onUseSubject,
  onUseBelief,
  onPickBelief,
  onOpenChoices,
  onConfirmOriginal,
  onConfirmProposal,
  onConfirmEdit,
  className,
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
  const visibleReasons = (facts?.unresolvedReasons ?? []).filter((reason) => reason !== "CHOOSE_BELIEF");
  const recoverReason = facts?.unresolvedReasons[0] ?? "UNRESOLVED";
  const recoverQuestion = t(
    masterRecoveryQuestionKey(recoverReason),
    "Write what this new belief means in one sentence.",
  );
  const showChoices =
    understanding ||
    Boolean(facts?.beliefOptions?.length) ||
    Boolean(facts?.unresolvedReasons.includes("CHOOSE_BELIEF")) ||
    Boolean(facts?.unresolvedReasons.includes("NO_BELIEF_OPTIONS"));
  const originalBelief = originalDraft.trim();

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
          placeholder={t(
            "thinkingLab.master.audiencePlaceholder",
            "Example: teenage boys who love motorbikes",
          )}
        />
      </div>
      {outcome === "ORIGINAL_READY" ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
          {facts?.subject ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("thinkingLab.master.subject", "Subject")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{displaySubject(facts.subject)}</p>
            </div>
          ) : null}
          <p className={facts?.subject ? "mt-3 text-sm text-muted-foreground" : "text-sm text-muted-foreground"}>
            {t("thinkingLab.master.originalReady", "This belief is ready to confirm.")}
          </p>
        </div>
      ) : facts?.subject ? (
        <p className="text-sm leading-relaxed text-foreground">
          <span className="font-medium">{t("thinkingLab.master.subject", "Subject")}: </span>
          {displaySubject(facts.subject)}
        </p>
      ) : confirmedStatement ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "thinkingLab.master.subjectMissing",
            "The Master Thought subject is not sealed yet. New Big Thoughts wait for that subject.",
          )}
        </p>
      ) : null}
      {outcome === "PROPOSAL_RECOMMENDED" && facts?.proposedRootBelief ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {t("thinkingLab.master.proposal", "Proposed root belief")}
          </p>
          {facts.formulationNote ? <p className="text-sm leading-relaxed text-muted-foreground">{facts.formulationNote}</p> : null}
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
            original={originalDraft}
            prior={priorDraft}
            preset={facts.clarificationOptions ?? []}
            locked={locked}
            busy={busy}
            onKeepOriginal={onKeepOriginal}
            onUseSubject={(choice) => onUseSubject(choice)}
            onUseBelief={onUseBelief}
            onOpenChoices={onOpenChoices}
          />
        </div>
      ) : null}
      {understanding ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t("thinkingLab.master.offering", "Writing belief options...")}
        </p>
      ) : null}
      {showChoices && originalBelief ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("thinkingLab.master.pickOriginal", "Pick the original")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("thinkingLab.master.pickOriginalHint", "Use the new belief you wrote.")}
          </p>
          <BeliefOptionButton
            belief={originalBelief}
            description=""
            disabled={locked || busy}
            onClick={() => onPickBelief(originalBelief)}
          />
        </div>
      ) : null}
      {!understanding && facts?.beliefOptions && facts.beliefOptions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("thinkingLab.master.beliefOptions", "Pick one belief")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t(
              "thinkingLab.master.beliefOptionsHint",
              "Each belief stays on the same shift as the old belief. The note says what we want that belief to hold.",
            )}
          </p>
          <div className="flex flex-col gap-2">
            {facts.beliefOptions.map((option) => (
              <BeliefOptionButton
                key={option.belief}
                belief={option.belief}
                description={option.description}
                disabled={locked || busy}
                onClick={() => onPickBelief(option.belief)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {facts && visibleReasons.length > 0 && !recovery ? (
        <p className="text-sm text-muted-foreground">
          {visibleReasons
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
          original={originalDraft}
          prior={priorDraft}
          preset={[]}
          locked={locked}
          busy={busy}
          onKeepOriginal={onKeepOriginal}
          onUseSubject={(choice) => onUseSubject(choice, recoverQuestion)}
          onUseBelief={onUseBelief}
          onOpenChoices={onOpenChoices}
        />
      ) : null}
      {recovery === "retry" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t("thinkingLab.master.recover.retry", "The reading did not come back. Try again.")}
          </p>
          <Button type="button" size="sm" onClick={onUnderstand} disabled={locked || busy} aria-busy={understanding || undefined}>
            {understanding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
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
      {admission === "STALE" ? (
        <p className="text-sm text-muted-foreground">
          {t("thinkingLab.master.stale", "The text changed. Read it again before confirming.")}
        </p>
      ) : null}
      {admission === "UNUSABLE" ? (
        <p className="text-sm text-muted-foreground">
          {t("thinkingLab.master.unusable", "This belief cannot be confirmed yet.")}
        </p>
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
          onClick={onUnderstand}
          disabled={locked || busy || !originalDraft.trim() || sameBelief}
          aria-busy={understanding || undefined}
        >
          {understanding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("thinkingLab.action.regenerate", "Regenerate")}
        </Button>
        {confirmedStatement ? <Badge>{t("thinkingLab.master.confirmed", "Confirmed")}</Badge> : null}
        {facts && outcome !== "CLARIFICATION_REQUIRED" && outcome !== "UNRESOLVED" ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={outcome === "ORIGINAL_READY" ? "default" : "outline"}
              onClick={onConfirmOriginal}
              disabled={busy || !canConfirmOriginal}
            >
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
    </div>
  );
}

function BeliefOptionButton({
  belief,
  description,
  disabled,
  onClick,
}: {
  belief: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto w-full items-start whitespace-normal px-3 py-2 text-left"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{belief}</span>
        {description ? <span className="text-sm font-normal text-muted-foreground">{description}</span> : null}
      </span>
    </Button>
  );
}

function ChoiceButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-auto whitespace-normal text-left"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function BeliefChoices({
  question,
  original,
  prior,
  preset,
  locked,
  busy,
  onKeepOriginal,
  onUseSubject,
  onUseBelief,
  onOpenChoices,
}: {
  question: string;
  original: string;
  prior: string;
  preset: string[];
  locked: boolean;
  busy: boolean;
  onKeepOriginal: () => void;
  onUseSubject: (choice: string) => void;
  onUseBelief: (belief: string) => void;
  onOpenChoices: (question: string) => Promise<MasterChoiceSet>;
}) {
  const { t } = useAppTranslation();
  const [opened, setOpened] = useState<MasterChoiceSet>({ subjects: [], beliefs: [] });
  const [asked, setAsked] = useState(false);
  const [opening, setOpening] = useState(preset.length === 0);
  const openRef = useRef(onOpenChoices);
  openRef.current = onOpenChoices;
  const planted = original.trim();
  const seeded = parseMasterChoiceSet({ choices: preset }, { priorBelief: prior, originalInput: planted });
  const subjects = [...seeded.subjects, ...opened.subjects].filter(
    (choice, index, all) => all.findIndex((item) => item.toLocaleLowerCase() === choice.toLocaleLowerCase()) === index,
  );
  const beliefs = [...seeded.beliefs, ...opened.beliefs].filter(
    (choice, index, all) =>
      all.findIndex((item) => item.toLocaleLowerCase() === choice.toLocaleLowerCase()) === index &&
      !beliefsMatch(choice, planted),
  );

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

  const disabled = busy || locked || opening;

  return (
    <div className="space-y-3">
      {opening ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t("thinkingLab.action.openChoices", "Open choices")}…
        </p>
      ) : null}
      {planted ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("thinkingLab.master.keepOriginal", "Original version")}
          </p>
          <ChoiceButton label={planted} disabled={busy || locked} onClick={onKeepOriginal} />
        </div>
      ) : null}
      {beliefs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("thinkingLab.master.recommendedBelief", "Recommended new belief")}
          </p>
          <div className="flex flex-col items-start gap-2">
            {beliefs.map((option) => (
              <ChoiceButton key={option} label={option} disabled={disabled} onClick={() => onUseBelief(option)} />
            ))}
          </div>
        </div>
      ) : null}
      {subjects.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("thinkingLab.master.subject", "Subject")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("thinkingLab.master.subjectKeepsBelief", "Choosing a subject leaves the new belief as written.")}
          </p>
          <div className="flex flex-col items-start gap-2">
            {subjects.map((option) => (
              <ChoiceButton key={option} label={option} disabled={disabled} onClick={() => onUseSubject(option)} />
            ))}
          </div>
        </div>
      ) : null}
      {!opening && asked && subjects.length === 0 && beliefs.length === 0 ? (
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
