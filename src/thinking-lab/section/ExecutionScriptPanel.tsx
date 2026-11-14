import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  allPromptsCopy,
  narrationDurationSeconds,
  scriptDurationSeconds,
  scriptLineRepairReady,
  voiceOverCopy,
  type CharacterVisualKind,
  type VoiceOverScript,
} from "@/thinking-lab/execution/script";
import {
  ensureVideoPassChecks,
  executionChecklistPassed,
  executionChecksFromAudit,
  meaningLineRepairReady,
  type NarrationChange,
} from "@/thinking-lab/execution/passChecklist";
import { imageChecksFromAudit, imageResumeReady, imageSlideRepairReady, ensureImageLegacySwitches, retiredImagePassCheck } from "@/thinking-lab/execution/imageChecklist";
import { limitPillarChoices, pillarNeedsRecommendation } from "@/thinking-lab/execution/recommend";
import type { CharacterStudioTab } from "@/thinking-lab/section/CharacterVisualStudio";
import { isFailedMeaningAudit, type ExecutionSemanticFacts } from "@/thinking-lab/execution/types";
import { SpokenReading } from "@/thinking-lab/section/script/SpokenReading";
import { ExecutionPassChecklist } from "@/thinking-lab/section/script/ExecutionPassChecklist";
import {
  COMPACT_BUTTON,
  RELATION_COPY,
  LockedChoices,
  NarrationWordLine,
  ExecutionMenu,
  PostPack,
} from "@/thinking-lab/section/script/ScriptChrome";
import { AssetList, type CharacterGenerateState } from "@/thinking-lab/section/script/ScriptAssets";
import { SceneTables } from "@/thinking-lab/section/script/SceneTables";

export { SpokenReading } from "@/thinking-lab/section/script/SpokenReading";
export { ExecutionPassChecklist } from "@/thinking-lab/section/script/ExecutionPassChecklist";
export type { CharacterGenerateState } from "@/thinking-lab/section/script/ScriptAssets";

export type ExecutionRunPhase = "write" | "audit" | "repair" | "line" | "recommend" | "switch";

export function ExecutionScriptPanel({
  pillarName,
  leadMagnet = false,
  statement,
  script,
  reading = null,
  admission,
  facts,
  progress = null,
  pending = false,
  fixingLineId = null,
  onStop,
  onRepair,
  onFixLine,
  onRegenerateLine,
  onRewrite,
  onRegenerate,
  onChangePillar,
  onUseRecommendation,
  pillarChoices,
  onUseOffer,
  onRetrySelling: _onRetrySelling,
  checks,
  onTogglePass,
  passProposal = null,
  onAcceptPassProposal,
  onDeclinePassProposal,
  offer,
  offerNote,
  onViewTable,
  onDelete,
  onGenerateCharacter,
  onStoreCharacterVisual,
  onDeleteCharacterVisual,
  generatingCharacter = null,
  deletingCharacterVisual = null,
  savingCharacterVisual = null,
}: {
  pillarName: string;
  leadMagnet?: boolean;
  statement: string;
  script: VoiceOverScript | null;
  reading?: VoiceOverScript | null;
  admission: string;
  facts: ExecutionSemanticFacts;
  progress?: { phase: ExecutionRunPhase; pillarName: string; medium?: "image" } | null;
  pending?: boolean;
  fixingLineId?: string | null;
  onStop?: () => void;
  onRepair?: () => void;
  onFixLine?: (lineId: string) => void;
  onRegenerateLine?: (lineId: string) => void;
  onRewrite?: () => void;
  onRegenerate?: () => void;
  onChangePillar?: () => void;
  onUseRecommendation?: (pillarName?: string) => void;
  pillarChoices?: Array<{ pillarName: string; reason: string }>;
  onUseOffer?: () => void;
  onRetrySelling?: () => void;
  checks?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; enabled?: boolean; reason?: string }>;
  onTogglePass?: (id: string, enabled: boolean) => void;
  passProposal?: NarrationChange[] | null;
  onAcceptPassProposal?: () => void;
  onDeclinePassProposal?: () => void;
  offer?: Array<{ lineId: string; narration: string }> | null;
  offerNote?: string | null;
  onViewTable?: () => void;
  onDelete?: () => void;
  onGenerateCharacter?: (handle: string) => void;
  onStoreCharacterVisual?: (handle: string, kind: CharacterStudioTab, source: File | { storagePath: string }) => void;
  onDeleteCharacterVisual?: (handle: string, kind: CharacterVisualKind) => void;
  generatingCharacter?: CharacterGenerateState;
  deletingCharacterVisual?: { handle: string; kind: CharacterVisualKind } | null;
  savingCharacterVisual?: { handle: string; kind: CharacterStudioTab } | null;
}) {
  const { t } = useAppTranslation();
  const [tab, setTab] = useState<"script" | "execution">("script");
  const [assetsOpen, setAssetsOpen] = useState(false);
  const duration = script ? scriptDurationSeconds(script) : narrationDurationSeconds(statement);
  const productionIssues = script?.productionIssues ?? [];
  const failedAudit = isFailedMeaningAudit(facts.meaningAudit) ? facts.meaningAudit : null;
  const meaningLineIds = failedAudit?.lineIds ?? [];
  const failing = new Set([
    ...(facts.meaningAudit ? productionIssues.map((issue) => issue.lineId) : (script?.lineIssues.map((issue) => issue.lineId) ?? [])),
    ...meaningLineIds,
  ]);
  const fixable = new Set(
    facts.meaningAudit ? productionIssues.map((issue) => issue.lineId) : (script?.lineIssues.map((issue) => issue.lineId) ?? []),
  );
  const passed = executionChecklistPassed(facts, admission, script?.lineIssues.length ?? 0);
  const resumeReady = script?.medium === "image" && imageResumeReady(facts);
  const repairReady =
    script?.medium === "image"
      ? imageSlideRepairReady(facts, script) || resumeReady
      : facts.meaningAudit
        ? meaningLineRepairReady(facts)
        : scriptLineRepairReady(facts, script);
  const needsAnotherPillar = pillarNeedsRecommendation(facts.relationToParent);
  const relationCopy =
    script?.medium === "image" && facts.relationToParent === "HOOK_MISSED"
      ? t("thinkingLab.execution.relation.IMAGE_HOOK_MISSED", "The first slide does not show the situation in this pillar's format.")
      : t(`thinkingLab.execution.relation.${facts.relationToParent}`, RELATION_COPY[facts.relationToParent]);
  const offeredPillars = limitPillarChoices(
    facts.recommendation?.choices && facts.recommendation.choices.length > 0
      ? facts.recommendation.choices
      : facts.recommendation
        ? [{ pillarName: facts.recommendation.pillarName, reason: facts.recommendation.reason }]
        : [],
  );
  const shownChoices = limitPillarChoices(pillarChoices ?? []);
  const remembered = facts.passChecks?.map((check) => ({
    id: check.id,
    state: check.state,
    enabled: check.enabled,
    reason: check.reason,
    lineIds: check.lineIds,
  }));
  const shownChecks =
    checks && checks.length > 0
      ? checks
      : remembered && remembered.length > 0
        ? script?.medium === "image"
          ? remembered
          : ensureVideoPassChecks(remembered)
        : script?.medium === "image"
          ? imageChecksFromAudit(facts.meaningAudit)
          : facts.meaningAudit
            ? executionChecksFromAudit(facts.meaningAudit)
            : [];
  const visibleChecks =
    script?.medium === "image"
      ? ensureImageLegacySwitches(
          shownChecks.filter((check) => !retiredImagePassCheck(check.id)) as Parameters<typeof ensureImageLegacySwitches>[0],
        )
      : shownChecks;
  const failedVisible = visibleChecks.some((check) => check.enabled !== false && check.state === "fail");
  const scriptWarning = failing.size > 0;
  const executionWarning = !passed;

  const copyText = async (value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
  };

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-violet-700">
              <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] bg-violet-500" aria-hidden />
              {leadMagnet
                ? `${t("thinkingLab.execution.label", "Execution")} - ${t("thinkingLab.tree.leadMagnet", "Lead Magnet")}`
                : t("thinkingLab.execution.label", "Execution")}
            </p>
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">{pillarName}</h2>
          </div>
          <ExecutionMenu onRegenerate={onRegenerate} onDelete={onDelete} pending={pending || Boolean(progress)} />
        </div>
        <div className="grid w-full grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium">
          <button
            type="button"
            className={cn("rounded-md px-3 py-2", tab === "script" ? "bg-background shadow-sm" : "text-muted-foreground")}
            onClick={() => setTab("script")}
          >
            {t("thinkingLab.execution.scriptTab", "Script VO")}
            {scriptWarning ? " !" : ""}
          </button>
          <button
            type="button"
            className={cn("rounded-md px-3 py-2", tab === "execution" ? "bg-background shadow-sm" : "text-muted-foreground")}
            onClick={() => setTab("execution")}
          >
            {t("thinkingLab.execution.executionTab", "Execution")}
            {executionWarning ? " !" : ""}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
            {passed ? t("thinkingLab.execution.passed", "Passed") : t("thinkingLab.execution.failed", "Not passed")}
          </span>
          {duration > 0 ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {t("thinkingLab.execution.seconds", "{{count}} seconds", { count: duration })}
            </span>
          ) : null}
        </div>
        {!passed && !progress && !resumeReady && failedVisible ? (
          <div className="space-y-1 text-sm leading-relaxed">
            <p>{relationCopy}</p>
            {facts.whatItSays.trim() ? <p className="text-muted-foreground">{facts.whatItSays.trim()}</p> : null}
            {(facts.meaningAudit ? productionIssues : (script?.lineIssues ?? [])).map((issue) => (
              <p key={`${issue.lineId}-${issue.reason}`} className="text-muted-foreground">
                {issue.reason}
              </p>
            ))}
          </div>
        ) : null}
        {visibleChecks.length > 0 ? (
          <ExecutionPassChecklist
            checks={visibleChecks}
            onToggle={onTogglePass}
            pending={pending || Boolean(progress) || Boolean(passProposal && passProposal.length > 0)}
          />
        ) : null}
        {passProposal && passProposal.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-border px-3 py-3">
            {passProposal.map((change) => (
              <div key={change.lineId} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t("thinkingLab.execution.passProposal.before", "Before")}</p>
                <NarrationWordLine parts={change.beforeWords} changedClass="rounded bg-rose-100 text-rose-900 line-through" />
                <p className="text-xs font-medium text-muted-foreground">{t("thinkingLab.execution.passProposal.after", "After")}</p>
                <NarrationWordLine parts={change.afterWords} changedClass="rounded bg-emerald-100 text-emerald-900" />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {onAcceptPassProposal ? (
                <Button type="button" size="sm" onClick={onAcceptPassProposal} disabled={pending}>
                  {t("thinkingLab.execution.passProposal.accept", "Accept these changes")}
                </Button>
              ) : null}
              {onDeclinePassProposal ? (
                <Button type="button" size="sm" variant="outline" onClick={onDeclinePassProposal} disabled={pending}>
                  {t("thinkingLab.execution.passProposal.decline", "Keep the previous lines")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {offer && offer.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t("thinkingLab.execution.offer", "Proposed lines")}</p>
            {offer.map((line) => (
              <p key={line.lineId} className="text-sm text-foreground">
                {line.narration}
              </p>
            ))}
            {onUseOffer ? (
              <Button type="button" size="sm" onClick={onUseOffer} disabled={pending}>
                {t("thinkingLab.execution.useOffer", "Use this repair")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {offerNote ? <p className="text-sm text-muted-foreground">{offerNote}</p> : null}
      </header>
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
          {progress.phase === "recommend" && shownChoices.length > 0 ? (
            <div className="space-y-3">
              {shownChoices.map((choice) => (
                <div key={choice.pillarName} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{choice.pillarName}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{choice.reason}</p>
                  {onUseRecommendation ? (
                    <Button type="button" size="sm" onClick={() => onUseRecommendation(choice.pillarName)}>
                      {t("thinkingLab.execution.useThisPillar", "Use {{pillar}}", { pillar: choice.pillarName })}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {!progress && !passed && !repairReady ? (
        needsAnotherPillar && onUseRecommendation ? (
          offeredPillars.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t("thinkingLab.execution.pillarPassed", "Pillars that can carry this Idea")}
              </p>
              {offeredPillars.map((choice) => (
                <div key={choice.pillarName} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{choice.pillarName}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{choice.reason}</p>
                  <Button type="button" size="sm" onClick={() => onUseRecommendation(choice.pillarName)} disabled={pending}>
                    {t("thinkingLab.execution.useThisPillar", "Use {{pillar}}", { pillar: choice.pillarName })}
                  </Button>
                </div>
              ))}
            </div>
          ) : onChangePillar ? (
            <div>
              <Button type="button" size="sm" onClick={onChangePillar} disabled={pending}>
                {t("thinkingLab.execution.changePillar", "Choose another pillar")}
              </Button>
            </div>
          ) : null
        ) : needsAnotherPillar ? (
          failing.size > 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("thinkingLab.execution.stayOnPillar", "This pillar was already the recommendation. Fix the failing lines.")}
            </p>
          ) : onRewrite ? (
            <div>
              <Button type="button" size="sm" onClick={onRewrite} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {t("thinkingLab.execution.rewrite", "Rewrite this execution")}
              </Button>
            </div>
          ) : null
        ) : onRewrite ? (
          <div>
            <Button type="button" size="sm" onClick={onRewrite} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("thinkingLab.execution.rewrite", "Rewrite this execution")}
            </Button>
          </div>
        ) : null
      ) : null}
      {tab === "script" ? (
        <div className="space-y-4">
          {repairReady && !progress ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
              <p className="text-sm font-medium">{t("thinkingLab.execution.next", "Next step")}</p>
              <p className="text-sm leading-relaxed text-foreground">
                {t(
                  "thinkingLab.execution.repairReady",
                  "Repair rewrites only the lines on the failed check. Checks that already passed stay passed, and a script that passes is saved on this click.",
                )}
              </p>
              {onRepair ? (
                <Button type="button" size="sm" onClick={onRepair} disabled={pending}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {t("thinkingLab.execution.repair", "Repair the failing lines")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {progress ? (
            reading ? <SpokenReading script={reading} /> : null
          ) : script ? (
            <>
              <LockedChoices script={script} />
              <PostPack title={script.title} caption={script.caption} />
              <button type="button" className="flex items-center gap-2 text-sm font-medium" onClick={() => setAssetsOpen((current) => !current)}>
                <ChevronRight className={cn("h-4 w-4 transition-transform", assetsOpen && "rotate-90")} aria-hidden />
                {t("thinkingLab.execution.assets", "Asset list")}
              </button>
              {assetsOpen ? (
                <AssetList
                  script={script}
                  onGenerateCharacter={onGenerateCharacter}
                  onStoreCharacterVisual={onStoreCharacterVisual}
                  onDeleteCharacterVisual={onDeleteCharacterVisual}
                  generating={generatingCharacter}
                  deleting={deletingCharacterVisual}
                  saving={savingCharacterVisual}
                />
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {onViewTable ? (
                  <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={onViewTable}>
                    {t("thinkingLab.execution.viewTable", "View as table")}
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={() => void copyText(voiceOverCopy(script))}>
                  {t("thinkingLab.execution.copyVo", "Copy VO script")}
                </Button>
                <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={() => void copyText(allPromptsCopy(script))}>
                  {t("thinkingLab.execution.copyPrompts", "Copy all prompts")}
                </Button>
              </div>
              <SceneTables
                script={script}
                failing={failing}
                pending={pending || Boolean(progress)}
                fixingLineId={fixingLineId}
                onFixLine={onFixLine}
                onRegenerateLine={script.medium === "image" ? undefined : onRegenerateLine}
                fixable={fixable}
                reasonFor={(lineId) =>
                  productionIssues.find((issue) => issue.lineId === lineId)?.reason ??
                  (failedAudit?.lineIds.includes(lineId) ? failedAudit.reason : "")
                }
              />
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{statement}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm leading-relaxed">
          <p className="font-medium">{t("thinkingLab.execution.statusTitle", "Check result")}</p>
          <p>{relationCopy}</p>
          {facts.whatItSays ? <p className="text-muted-foreground">{facts.whatItSays}</p> : null}
          <ul className="space-y-1 text-muted-foreground">
            <li>
              {t("thinkingLab.execution.climb", "Path to Master Thought")}:{" "}
              {facts.viewerClimb === "CLIMBS"
                ? t("thinkingLab.execution.climbs", "Climbs")
                : facts.viewerClimb === "OTHER" || facts.viewerClimb === "NEGATIVE"
                  ? t("thinkingLab.execution.misses", "Does not climb")
                  : t("thinkingLab.execution.unresolved", "Unresolved")}
            </li>
            <li>
              {t("thinkingLab.execution.message", "Idea message")}:{" "}
              {facts.messageAdded === false
                ? t("thinkingLab.execution.messageKept", "Stays with the Idea")
                : facts.messageAdded === true
                  ? t("thinkingLab.execution.messageAdded", "A new claim was added")
                  : t("thinkingLab.execution.unresolved", "Unresolved")}
            </li>
            <li>
              {t("thinkingLab.execution.fit", "Pillar fit")}:{" "}
              {facts.pillarOutside === false
                ? t("thinkingLab.execution.fitInside", "Realizes the Idea")
                : facts.pillarOutside === true
                  ? t("thinkingLab.execution.fitOutside", "Forces a message outside the Idea")
                  : t("thinkingLab.execution.unresolved", "Unresolved")}
            </li>
            {duration > 0 ? <li>{t("thinkingLab.execution.seconds", "{{count}} seconds", { count: duration })}</li> : null}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ExecutionScriptTable({
  pillarName,
  script,
  onClose,
  pending = false,
  fixingLineId = null,
  onRegenerateLine,
  onDelete,
  onSaveToPlan,
  onGenerateCharacter,
  onStoreCharacterVisual,
  onDeleteCharacterVisual,
  generatingCharacter = null,
  deletingCharacterVisual = null,
  savingCharacterVisual = null,
}: {
  pillarName: string;
  script: VoiceOverScript;
  onClose: () => void;
  pending?: boolean;
  fixingLineId?: string | null;
  onRegenerateLine?: (lineId: string) => void;
  onDelete?: () => void;
  onSaveToPlan?: () => void;
  onGenerateCharacter?: (handle: string) => void;
  onStoreCharacterVisual?: (handle: string, kind: CharacterStudioTab, source: File | { storagePath: string }) => void;
  onDeleteCharacterVisual?: (handle: string, kind: CharacterVisualKind) => void;
  generatingCharacter?: CharacterGenerateState;
  deletingCharacterVisual?: { handle: string; kind: CharacterVisualKind } | null;
  savingCharacterVisual?: { handle: string; kind: CharacterStudioTab } | null;
}) {
  const { t } = useAppTranslation();
  const duration = scriptDurationSeconds(script);
  const failing = new Set(script.lineIssues.map((issue) => issue.lineId));
  const copyText = async (value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
  };
  return (
    <div className="scrollbar-hide flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{t("thinkingLab.execution.scriptTab", "Script VO")}</h2>
          <p className="text-sm text-muted-foreground">
            {pillarName}
            {script.scenes.length > 0
              ? ` · ${t("thinkingLab.execution.sceneCount", "{{count}} scenes, {{seconds}} seconds", { count: script.scenes.length, seconds: duration })}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={() => void copyText(voiceOverCopy(script))}>
            {t("thinkingLab.execution.copyVo", "Copy VO script")}
          </Button>
          <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={() => void copyText(allPromptsCopy(script))}>
            {t("thinkingLab.execution.copyPrompts", "Copy all prompts")}
          </Button>
          {onSaveToPlan ? (
            <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={onSaveToPlan}>
              {t("scriptGenerator.saveToPlanButton", "Save to Plan")}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={onClose}>
            {t("thinkingLab.execution.close", "Close")}
          </Button>
          <ExecutionMenu onDelete={onDelete} />
        </div>
      </div>
      <LockedChoices script={script} />
      <PostPack title={script.title} caption={script.caption} />
      <AssetList
        script={script}
        onGenerateCharacter={onGenerateCharacter}
        onStoreCharacterVisual={onStoreCharacterVisual}
        onDeleteCharacterVisual={onDeleteCharacterVisual}
        generating={generatingCharacter}
        deleting={deletingCharacterVisual}
        saving={savingCharacterVisual}
      />
      <SceneTables
        script={script}
        failing={failing}
        fill
        pending={pending}
        fixingLineId={fixingLineId}
        onRegenerateLine={script.medium === "image" ? undefined : onRegenerateLine}
      />
    </div>
  );
}
