import {  useRef, useState } from "react";
import { toast } from "sonner";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { askThinkingLab, parseModelJson } from "@/thinking-lab/shared/ai";
import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import {
  fixAttemptCap,
  type FixScope,
} from "@/thinking-lab/shared/fixScope";
import { useMasterThought } from "@/thinking-lab/master-thought/useMasterThought";
import {  useLabAngles } from "@/thinking-lab/angle/useAngles";
import {  type LabIdea } from "@/thinking-lab/idea/repository";
import { developmentForPillar, latestPathReviews, lockedPillarCards } from "@/thinking-lab/creative-idea/paths";
import { leadMagnetPassChecklist, reviewContentPillars, reviewsToStore, type LeadMagnetReviewStep } from "@/thinking-lab/creative-idea/recommend";
import { saveDevelopmentPath } from "@/thinking-lab/creative-idea/repository";
import type { CreativeExecutionLink, CreativeFormat, DevelopmentPath, StoredPillarReview } from "@/thinking-lab/creative-idea/types";
import { buildExecutionGeneratePrompt, judgeAndSealExecution } from "@/thinking-lab/execution/generate";
import { buildImageGeneratePrompt } from "@/thinking-lab/execution/imageGenerate";
import {
  buildImageSlideRepairPrompt,
  buildImageSpeechRepairPrompt,
  imageChecksAfterSlideRewrite,
  imageChecksFromAudit,
  imageFailureMoved,
  imageLessons,
  imageRecheckClaim,
  imageRewriteFromFailure,
  imageSlideRepairLine,
  imageSlideRepairReady,
  imageSpeechRepairLines,
  ensureImageLegacySwitches,
  mergeImageSlideRepair,
  parseImageSlideRepair,
  parseImageSpeechRepairs,
  runImageMeaningChecks,
  runImageOpenChecks,
} from "@/thinking-lab/execution/imageChecklist";
import {
  applyPassSwitchScript,
  buildExecutionMeaningRepairPrompt,
  buildNarrationLineRegeneratePrompt,
  buildPassSwitchRewritePrompt,
  checksImplementedBySwitch,
  emptyExecutionPassChecklist,
  ensureVideoPassChecks,
  executionChecksFromAudit,
  executionFactsFromChecks,
  executionFailureMoved,
  factsForPassChecks,
  openPassResume,
  regeneratePassPrior,
  togglePassCheck,
  lessonFromMeaningAudit,
  meaningLineRepairReady,
  mergeExecutionAuditLessons,
  narrationChangeRows,
  parseExecutionNarrationReplacements,
  passSwitchOutcome,
  switchRewriteLines,
  runExecutionMeaningChecks,
  runExecutionOpenChecks,
  EXECUTION_LINE_REPAIR_IDS,
  type ExecutionPassCheck,
  type NarrationChange } from "@/thinking-lab/execution/passChecklist";
import {
  buildExecutionConfirmPrompt,
  parseDiscoveredQuestions,
  type DiscoveryMode,
  type ExecutionConfirmQuestion,
  type ScriptDecision,
} from "@/thinking-lab/execution/confirm";
import { useOrgContentPillars, type LabContentPillar } from "@/thinking-lab/execution/pillars";
import { buildPillarFitChoicePrompt, limitPillarChoices, parsePillarFitChoice, PILLAR_CHOICE_LIMIT, pillarNeedsRecommendation, pillarWasRecommended } from "@/thinking-lab/execution/recommend";
import { isFailedMeaningAudit, type ExecutionAuditLesson, type ExecutionSemanticFacts } from "@/thinking-lab/execution/types";
import {
  buildContinuityAuditPrompt,
  buildLineAuditPrompt,
  buildViewpointAuditPrompt,
  buildLineRepairPrompt,
  buildMasterSellsPrompt,
  buildProductionRepairPrompt,
  mergeNarrationRepairs,
  buildSpeechRepairPrompt,
  flattenVoiceOver,
  keepCharacterVisuals,
  mergeRepairedLines,
  mergeSpeechRepairs,
  parseLineIssues,
  parseLineReplacements,
  parseMasterSells,
  parseSpeechRepairs,
  ensureBrandMention,
  chainNarrationLines,
  linesForProductionRecheck,
  storyVoiceOver,
  detachCallToAction,
  callToActionSceneReady,
  attachCtaScene,
  parseCtaScene,
  buildCtaScenePrompt,
  parseVoiceOverScript,
  scriptLineRepairReady,
  scriptMentionsBrand,
  speechNeedsRepair,
  stampImageScript,
  withSpeech,
  type CharacterVisualKind,
  type ScriptAudio,
  type ScriptLook,
  type ImageSettings,
  type ScriptSpeech,
  type VoiceOverScript } from "@/thinking-lab/execution/script";
import {  useLabExecutions } from "@/thinking-lab/execution/useExecutions";
import {  type CharacterGenerateState } from "@/thinking-lab/section/ExecutionScriptPanel";
import type { CharacterStudioTab } from "@/thinking-lab/section/CharacterVisualStudio";
import {  type ExecutionSettingsDirect } from "@/thinking-lab/section/PillarPickerSheet";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { LabFocus } from "@/thinking-lab/page/labFocus";

// The Execution step of the Thinking Lab page: its state and its actions (generate, check, repair, pillars,
// characters). The page keeps the layout; it calls useExecutionState() once and createExecutionActions()
// on every render, so the actions see the current values, as they did inline.

export function useExecutionState() {
  const [pillarPickerOpen, setPillarPickerOpen] = useState(false);
  const [executionDirect, setExecutionDirect] = useState<ExecutionSettingsDirect | null>(null);
  const [creativeReviews, setCreativeReviews] = useState<StoredPillarReview[] | null>(null);
  const [creativeReviewReady, setCreativeReviewReady] = useState(false);
  const [leadMagnetStep, setLeadMagnetStep] = useState<LeadMagnetReviewStep | null>(null);
  const [creativePillarId, setCreativePillarId] = useState<string | null>(null);
  const [creativeFormat, setCreativeFormat] = useState<CreativeFormat | null>(null);
  const creativePathSave = useRef<Promise<void>>(Promise.resolve());
  const [scriptConfirm, setScriptConfirm] = useState<{
    pillars: LabContentPillar[];
    audio: ScriptAudio;
    look?: ScriptLook;
    speech?: ScriptSpeech;
    durationSeconds: number | null;
    brandName: string | null;
    cta: string | null;
    image: ImageSettings | null;
    pillarDevelopment: string | null;
    phase: "mode" | "questions";
    discovery: DiscoveryMode | null;
    questions: ExecutionConfirmQuestion[] | null;
    loading: boolean;
    failed: boolean;
  } | null>(null);
  const [masterSells, setMasterSells] = useState<true | false | "unresolved" | "unknown">("unknown");
  const [executionChecklists, setExecutionChecklists] = useState<Record<string, ExecutionPassCheck[]>>({});
  const [executionRunChecks, setExecutionRunChecks] = useState<ExecutionPassCheck[] | null>(null);
  const [executionLineOffer, setExecutionLineOffer] = useState<{
    executionId: string;
    script: VoiceOverScript;
    facts: ExecutionSemanticFacts;
  } | null>(null);
  const [executionPassProposal, setExecutionPassProposal] = useState<{
    executionId: string;
    checks: ExecutionPassCheck[];
    script: VoiceOverScript;
    changes: NarrationChange[];
    previousChecks: ExecutionPassCheck[] | null;
    implemented: boolean;
  } | null>(null);
  const [executionRepairNote, setExecutionRepairNote] = useState<string | null>(null);
  const [executionDraft, setExecutionDraft] = useState<VoiceOverScript | null>(null);
  const [executionProgress, setExecutionProgress] = useState<{
    phase: "write" | "audit" | "repair" | "line" | "recommend" | "switch";
    pillarName: string;
    medium?: "image";
  } | null>(null);
  const [pillarChoices, setPillarChoices] = useState<Array<{ pillarName: string; reason: string }>>([]);
  const [fixingLineId, setFixingLineId] = useState<string | null>(null);
  const [scriptTableOpen, setScriptTableOpen] = useState(false);
  const [planSaveOpen, setPlanSaveOpen] = useState(false);
  const [characterGenerate, setCharacterGenerate] = useState<CharacterGenerateState>(null);
  const [characterVisualDelete, setCharacterVisualDelete] = useState<{ handle: string; kind: CharacterVisualKind } | null>(null);
  const [characterVisualSave, setCharacterVisualSave] = useState<{ handle: string; kind: CharacterStudioTab } | null>(null);
  const executionCancel = useRef(0);
  const pillarUseWait = useRef<number | null>(null);
  const confirmToken = useRef(0);
  return { pillarPickerOpen, setPillarPickerOpen, executionDirect, setExecutionDirect, creativeReviews, setCreativeReviews, creativeReviewReady, setCreativeReviewReady, leadMagnetStep, setLeadMagnetStep, creativePillarId, setCreativePillarId, creativeFormat, setCreativeFormat, creativePathSave, scriptConfirm, setScriptConfirm, masterSells, setMasterSells, executionChecklists, setExecutionChecklists, executionRunChecks, setExecutionRunChecks, executionLineOffer, setExecutionLineOffer, executionPassProposal, setExecutionPassProposal, executionRepairNote, setExecutionRepairNote, executionDraft, setExecutionDraft, executionProgress, setExecutionProgress, pillarChoices, setPillarChoices, fixingLineId, setFixingLineId, scriptTableOpen, setScriptTableOpen, planSaveOpen, setPlanSaveOpen, characterGenerate, setCharacterGenerate, characterVisualDelete, setCharacterVisualDelete, characterVisualSave, setCharacterVisualSave, executionCancel, pillarUseWait, confirmToken };
}

export type ExecutionState = ReturnType<typeof useExecutionState>;

/** What the Execution actions read from the rest of the page. */
export type ExecutionDeps = {
  focus: LabFocus | null;
  focusedIdea: LabIdea | null;
  masterSubject: string;
  labExecutions: ReturnType<typeof useLabExecutions>;
  run: (work: () => Promise<void>, action?: string, target?: string) => Promise<void>;
  ideaParentFor: (angleId: string) => {
    angle: NonNullable<ReturnType<typeof useLabAngles>["data"]>[number] | null;
    ancestors: AncestorStake[];
  };
  selected: NonNullable<ReturnType<typeof useMasterThought>["data"]>[number] | null;
  contentPillars: ReturnType<typeof useOrgContentPillars>;
  masterStatement: string;
  masters: ReturnType<typeof useMasterThought>;
  t: ReturnType<typeof useAppTranslation>["t"];
  setFocus: Dispatch<SetStateAction<LabFocus | null>>;
  pillarCardsFor: (idea: LabIdea) => ReturnType<typeof lockedPillarCards>;
  labRunRef: MutableRefObject<boolean>;
  reportStepError: (error: unknown) => void;
  queryClient: QueryClient;
};

export function createExecutionActions(ctx: ExecutionState & ExecutionDeps) {
  const { setPillarPickerOpen, setExecutionDirect, creativeReviews, setCreativeReviews, setCreativeReviewReady, setLeadMagnetStep, creativePillarId, setCreativePillarId, setCreativeFormat, creativePathSave, setScriptConfirm, masterSells, setMasterSells, executionChecklists, setExecutionChecklists, setExecutionRunChecks, executionLineOffer, setExecutionLineOffer, executionPassProposal, setExecutionPassProposal, setExecutionRepairNote, setExecutionDraft, executionProgress, setExecutionProgress, setPillarChoices, setFixingLineId, executionCancel, pillarUseWait, confirmToken, focus, focusedIdea, masterSubject, labExecutions, run, ideaParentFor, selected, contentPillars, masterStatement, masters, t, setFocus, pillarCardsFor, labRunRef, reportStepError, queryClient } = ctx;
  const onStopExecution = () => {
    executionCancel.current += 1;
    setExecutionProgress(null);
    setExecutionDraft(null);
    setExecutionRunChecks(null);
    setFixingLineId(null);
  };

  const onOpenPillarPicker = () => {
    setExecutionDirect(null);
    setPillarPickerOpen(true);
    if (masterSells !== "unknown" || !masterStatement) return;
    void (async () => {
      const raw = await askThinkingLab(buildMasterSellsPrompt(masterStatement), 0);
      setMasterSells(parseMasterSells(raw ? parseModelJson(raw) : null));
    })();
  };

  const loadScriptConfirm = (settings: {
    pillars: LabContentPillar[];
    audio: ScriptAudio;
    look?: ScriptLook;
    speech?: ScriptSpeech;
    durationSeconds: number | null;
    brandName: string | null;
    cta: string | null;
    image: ImageSettings | null;
    pillarDevelopment?: string | null;
  }) => {
    if (!focusedIdea || focusedIdea.status !== "locked") return;
    const pillarDevelopment = settings.pillarDevelopment?.trim() || null;
    confirmToken.current += 1;
    setPillarPickerOpen(false);
    setExecutionDirect(null);
    setScriptConfirm({
      ...settings,
      pillarDevelopment,
      phase: "mode",
      discovery: null,
      questions: null,
      loading: false,
      failed: false,
    });
  };

  const askScriptDiscovery = (
    settings: {
      pillars: LabContentPillar[];
      audio: ScriptAudio;
      look?: ScriptLook;
      speech?: ScriptSpeech;
      durationSeconds: number | null;
      brandName: string | null;
      cta: string | null;
      image: ImageSettings | null;
      pillarDevelopment: string | null;
    },
    discovery: DiscoveryMode,
  ) => {
    if (!focusedIdea || focusedIdea.status !== "locked") return;
    const idea = focusedIdea;
    const token = ++confirmToken.current;
    const pillarDevelopment = settings.pillarDevelopment;
    setScriptConfirm({
      ...settings,
      pillarDevelopment,
      phase: "questions",
      discovery,
      questions: null,
      loading: true,
      failed: false,
    });
    if (!masters.organizationId) {
      setScriptConfirm({
        ...settings,
        pillarDevelopment,
        phase: "questions",
        discovery,
        questions: null,
        loading: false,
        failed: true,
      });
      return;
    }
    let writeNow = false;
    void run(async () => {
      try {
        const { ancestors, angle } = ideaParentFor(idea.angleId);
        const raw = await askThinkingLab(
          buildExecutionConfirmPrompt({
            masterStatement,
            masterSubject,
            priorBelief: selected?.priorBelief,
            angleStatement: angle?.statement,
            ideaStatement: idea.statement,
            pillars: settings.pillars.map((pillar) => ({
              name: pillar.name,
              funnel: pillar.funnel,
              category: pillar.category,
            })),
            ancestors,
            speech: settings.speech,
            look: settings.look,
            durationSeconds: settings.durationSeconds,
            brandName: settings.brandName,
            cta: settings.cta,
            pillarDevelopment,
            discovery,
          }),
          0.2,
        );
        if (confirmToken.current !== token) return;
        const discovered = parseDiscoveredQuestions(raw ? parseModelJson(raw) : null);
        if (!discovered.ok) {
          setScriptConfirm((current) => {
            if (!current || confirmToken.current !== token) return current;
            return { ...current, loading: false, questions: null, failed: true };
          });
          return;
        }
        const questions = discovery === "follow" ? discovered.questions.filter((question) => question.binds !== "story") : discovered.questions;
        if (questions.length === 0) {
          writeNow = true;
          setScriptConfirm(null);
          return;
        }
        setScriptConfirm((current) => {
          if (!current || confirmToken.current !== token) return current;
          return { ...current, phase: "questions", loading: false, questions, failed: false };
        });
      } catch {
        if (confirmToken.current !== token) return;
        setScriptConfirm((current) => {
          if (!current || confirmToken.current !== token) return current;
          return { ...current, loading: false, questions: null, failed: true };
        });
      }
    }, "execution-confirm").then(() => {
      if (!writeNow || confirmToken.current !== token) return;
      onGenerateExecutions(
        settings.pillars,
        settings.audio,
        settings.look,
        settings.speech,
        null,
        settings.durationSeconds,
        settings.brandName,
        settings.cta,
        null,
        [],
        false,
        null,
        settings.image,
        false,
        null,
        null,
        pillarDevelopment,
      );
    });
  };

  const pillarFormat = (name: string) => {
    const match = (contentPillars.data ?? []).find(
      (pillar) => pillar.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    return {
      pillarCategory: match?.category ?? null,
      pillarDescription: match?.description ?? null,
    };
  };

  const withPillarRecommendation = async (
    facts: ExecutionSemanticFacts,
    failedPillar: string,
    ideaStatement: string,
    ancestors: AncestorStake[],
    token: number,
  ): Promise<ExecutionSemanticFacts> => {
    if (!pillarNeedsRecommendation(facts.relationToParent)) return facts;
    const options = (contentPillars.data ?? []).filter(
      (pillar) => pillar.name.trim().toLowerCase() !== failedPillar.trim().toLowerCase(),
    );
    if (options.length === 0) return facts;
    setExecutionProgress({ phase: "recommend", pillarName: failedPillar });
    setPillarChoices([]);
    const choices: Array<{ pillarName: string; reason: string }> = [];
    for (const pillar of options) {
      if (choices.length >= PILLAR_CHOICE_LIMIT) break;
      if (executionCancel.current !== token) return facts;
      const raw = await askThinkingLab(
        buildPillarFitChoicePrompt({
          masterStatement,
          ideaStatement,
          failedPillar,
          explanation: facts.whatItSays,
          ancestors,
          pillar: {
            name: pillar.name,
            funnel: pillar.funnel === "middle" ? "Consideration" : pillar.funnel === "bottom" ? "Conversion" : "Awareness",
            category: pillar.category,
            description: pillar.description,
          },
        }),
        0,
      );
      if (executionCancel.current !== token) return facts;
      const choice = parsePillarFitChoice(raw ? parseModelJson(raw) : null, pillar.name);
      if (!choice) continue;
      choices.push(choice);
      setPillarChoices(limitPillarChoices(choices));
    }
    const offered = limitPillarChoices(choices);
    const first = offered[0];
    return first ? { ...facts, recommendation: { pillarName: first.pillarName, reason: first.reason, choices: offered } } : facts;
  };

  const pillarHopStopped = (pillarName: string, script?: { followedRecommendation?: boolean } | null, exceptId?: string) =>
    Boolean(script?.followedRecommendation) ||
    pillarWasRecommended(
      pillarName,
      (labExecutions.data ?? [])
        .filter((row) => row.id !== exceptId)
        .map((row) => row.canonicalSemantic.recommendation?.pillarName),
    );

  const onGenerateExecutions = (
    chosen: LabContentPillar[],
    audio: ScriptAudio,
    look?: ScriptLook,
    speech?: ScriptSpeech,
    previousScript?: VoiceOverScript | null,
    durationSeconds?: number | null,
    brandName?: string | null,
    cta?: string | null,
    pointOfView?: string | null,
    decisions?: ScriptDecision[] | null,
    fromRecommendation = false,
    carriedLessons?: readonly ExecutionAuditLesson[] | null,
    image: ImageSettings | null = null,
    fresh = false,
    keptSwitches?: readonly ExecutionPassCheck[] | null,
    creativeLink?: CreativeExecutionLink | null,
    pillarDevelopment?: string | null,
  ) => {
    if (!focus || (focus.kind !== "idea" && focus.kind !== "pillar" && focus.kind !== "execution") || !focusedIdea || focusedIdea.status !== "locked") return;
    if (executionPassProposal) {
      const proposal = executionPassProposal;
      setExecutionPassProposal(null);
      setExecutionChecklists((lists) => {
        if (proposal.previousChecks) return { ...lists, [proposal.executionId]: proposal.previousChecks };
        if (!(proposal.executionId in lists)) return lists;
        const next = { ...lists };
        delete next[proposal.executionId];
        return next;
      });
    }
    const origin = focus;
    const idea = focusedIdea;
    const resolvedAudio: ScriptAudio = speech === "mix" || speech === "dialog" ? { ...audio, sound: true } : audio;
    const targetSeconds = durationSeconds ?? previousScript?.durationSeconds ?? null;
    const lockedDecisions = (decisions ?? previousScript?.decisions ?? []).filter((row) => row.answer.trim());
    const lockedView = (
      pointOfView ??
      lockedDecisions.find((row) => row.binds === "viewpoint")?.answer ??
      previousScript?.pointOfView ??
      ""
    ).trim();
    const token = executionCancel.current;
    setPillarPickerOpen(false);
    void run(async () => {
      let lastId: string | null = null;
      const { ancestors } = ideaParentFor(idea.angleId);
      const creativePrompt = creativeLink
        ? {
            creativeIdea: {
              statement: creativeLink.statement,
              concept: creativeLink.concept,
              mechanism: creativeLink.mechanism,
              value: creativeLink.value,
            },
          }
        : {};
      for (const pillar of chosen) {
        if (executionCancel.current !== token) return;
        setExecutionDraft(null);
        const existing = creativeLink
          ? undefined
          : (labExecutions.data ?? []).find((row) => {
              if (row.ideaId !== idea.id || row.creativeIdeaId) return false;
              if (pillar.id && (row.contentPillarId === pillar.id || row.pillar === pillar.id)) return true;
              return row.pillarName.trim().toLowerCase() === pillar.name.trim().toLowerCase();
            });
        const priorLessons = fresh
          ? []
          : mergeExecutionAuditLessons(existing?.canonicalSemantic.auditLessons ?? [], carriedLessons ?? []);
        const trackedId = existing?.id ?? null;
        const imageSettings = image ?? (previousScript?.medium === "image" ? previousScript.image ?? null : null);
        const enabled = (keptSwitches ?? []).flatMap((check) => (check.enabled === false ? [] : [check.id]));
        if (imageSettings) {
          setExecutionProgress({ phase: "write", pillarName: pillar.name, medium: "image" });
          const imageRaw = await askThinkingLab(
            buildImageGeneratePrompt({
              masterStatement,
              ideaStatement: idea.statement,
              pillar: pillar.name,
              pillarCategory: pillar.category,
              pillarDescription: pillar.description,
              ancestors,
              image: imageSettings,
              pointOfView: lockedView || null,
              decisions: lockedDecisions,
              lessons: imageLessons(priorLessons),
              pillarDevelopment,
              enabled,
              ...creativePrompt,
            }),
            0.2,
          );
          if (executionCancel.current !== token) return;
          const imageParsed = parseVoiceOverScript(imageRaw ? parseModelJson(imageRaw) : null);
          if (!imageParsed) continue;
          const current = stampImageScript(
            {
              ...imageParsed,
              ...(lockedView ? { pointOfView: lockedView } : {}),
              ...(lockedDecisions.length > 0 ? { decisions: lockedDecisions } : {}),
              ...(fromRecommendation ? { followedRecommendation: true } : {}),
            },
            imageSettings,
          );
          if (!current.scenes.some((scene) => scene.lines.some((line) => line.narration.trim()))) continue;
          setExecutionDraft(current);
          setExecutionProgress({ phase: "audit", pillarName: pillar.name, medium: "image" });
          let liveChecks: ExecutionPassCheck[] = [];
          const imageCheckInput = {
            pillar: pillar.name,
            pillarCategory: pillar.category,
            pillarDescription: pillar.description,
            masterStatement,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment,
            script: current,
            image: imageSettings,
            masterSells: masterSells === "unknown" ? "unresolved" : masterSells,
            auditLessons: imageLessons(priorLessons),
            ask: (prompt: string) => askThinkingLab(prompt, 0),
            onStep: (checks: ExecutionPassCheck[]) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              if (!trackedId) return;
              setExecutionChecklists((lists) => ({ ...lists, [trackedId]: checks }));
            },
          };
          const checked = await (keptSwitches
            ? runImageOpenChecks({ ...imageCheckInput, prior: keptSwitches })
            : runImageMeaningChecks(imageCheckInput));
          if (executionCancel.current !== token) return;
          const lesson = lessonFromMeaningAudit(checked.facts, current);
          const withLesson = lesson
            ? { ...checked.facts, auditLessons: mergeExecutionAuditLessons(checked.facts.auditLessons ?? [], [lesson]) }
            : checked.facts;
          const recommended =
            fromRecommendation || pillarHopStopped(pillar.name, current)
              ? withLesson
              : await withPillarRecommendation(withLesson, pillar.name, idea.statement, ancestors, token);
          if (executionCancel.current !== token) return;
          const saved = await labExecutions.save.mutateAsync({
            ideaId: idea.id,
            pillar: pillar.id,
            contentPillarId: pillar.id,
            pillarName: pillar.name,
            statement: flattenVoiceOver(current),
            script: current,
            facts: recommended,
            ...(creativeLink ? { creativeLink } : {}),
          });
          setExecutionChecklists((currentLists) => ({ ...currentLists, [saved.id]: liveChecks }));
          setExecutionLineOffer(null);
          setExecutionRepairNote(null);
          lastId = saved.id;
          continue;
        }
        setExecutionProgress({ phase: "write", pillarName: pillar.name });
        const raw = await askThinkingLab(
          buildExecutionGeneratePrompt({
            masterStatement,
            masterSubject,
            priorBelief: selected?.priorBelief,
            ideaStatement: idea.statement,
            pillar: pillar.name,
            pillarCategory: pillar.category,
            pillarDescription: pillar.description,
            ancestors,
            speech,
            durationSeconds: targetSeconds,
            brandName: brandName ?? previousScript?.brandName ?? null,
            cta: cta ?? previousScript?.cta ?? null,
            pointOfView: lockedView || null,
            decisions: lockedDecisions,
            lessons: priorLessons,
            pillarDevelopment,
            enabled,
            ...creativePrompt,
          }),
          0.2,
        );
        if (executionCancel.current !== token) return;
        const parsed = parseVoiceOverScript(raw ? parseModelJson(raw) : null);
        if (!parsed) continue;
        const namedBrand = (brandName ?? previousScript?.brandName ?? "").trim();
        const chosenCta = (cta ?? previousScript?.cta ?? "").trim();
        const stamped = {
          ...parsed,
          audio: resolvedAudio,
          ...(look ? { look } : {}),
          ...(namedBrand ? { brandName: namedBrand } : {}),
          ...(chosenCta ? { cta: chosenCta } : {}),
          ...(lockedView ? { pointOfView: lockedView } : {}),
          ...(lockedDecisions.length > 0 ? { decisions: lockedDecisions } : {}),
          ...(fromRecommendation ? { followedRecommendation: true } : {}),
        };
        let current = speech ? withSpeech(stamped, speech) : stamped;
        if (
          speechNeedsRepair(current, speech) ||
          (namedBrand && !scriptMentionsBrand(current, namedBrand))
        ) {
          const repairSpeech = speech === "mix" || speech === "dialog" || speech === "silent" ? speech : "vo";
          setExecutionProgress({ phase: "repair", pillarName: pillar.name });
          const repairRaw = await askThinkingLab(
            buildSpeechRepairPrompt({
              ideaStatement: idea.statement,
              pillarName: pillar.name,
              speech: repairSpeech,
              script: current,
            }),
            0.2,
          );
          if (executionCancel.current !== token) return;
          const repaired = mergeSpeechRepairs(current, parseSpeechRepairs(repairRaw ? parseModelJson(repairRaw) : null));
          current = speech ? withSpeech(repaired, speech) : repaired;
        }
        if (namedBrand) current = ensureBrandMention(current, namedBrand);
        if (chosenCta) {
          current = detachCallToAction(current, chosenCta);
          if (!callToActionSceneReady(current, chosenCta)) {
            setExecutionProgress({ phase: "write", pillarName: pillar.name });
            const ctaRaw = await askThinkingLab(
              buildCtaScenePrompt({
                ideaStatement: idea.statement,
                masterStatement,
                pointOfView: lockedView || null,
                decisions: lockedDecisions,
                action: chosenCta,
                speech,
                brandName: namedBrand || null,
              }),
              0.2,
            );
            if (executionCancel.current !== token) return;
            const ctaScene = parseCtaScene(ctaRaw ? parseModelJson(ctaRaw) : null, speech);
            if (ctaScene && callToActionSceneReady({ ...current, scenes: [...current.scenes, ctaScene] }, chosenCta)) {
              current = attachCtaScene(current, ctaScene);
            }
          }
        }
        if (targetSeconds) current = { ...current, durationSeconds: targetSeconds };
        const narrationLines = () =>
          current.scenes.flatMap((scene) => scene.lines.map((line) => ({ id: line.id, narration: line.narration })));
        setExecutionDraft(current);
        let viewpointIssues: Array<{ lineId: string; reason: string }> = [];
        if (lockedView) {
          setExecutionProgress({ phase: "audit", pillarName: pillar.name });
          const viewpointRaw = await askThinkingLab(
            buildViewpointAuditPrompt({
              ideaStatement: idea.statement,
              pointOfView: lockedView,
              lines: narrationLines(),
            }),
            0,
          );
          if (executionCancel.current !== token) return;
          viewpointIssues = parseLineIssues(viewpointRaw ? parseModelJson(viewpointRaw) : null, current);
          if (viewpointIssues.length > 0) {
            setExecutionProgress({ phase: "repair", pillarName: pillar.name });
            const repairRaw = await askThinkingLab(
              buildLineRepairPrompt({
                ideaStatement: idea.statement,
                masterStatement,
                priorBelief: selected?.priorBelief,
                ancestors,
                pillarName: pillar.name,
                script: { ...current, lineIssues: viewpointIssues },
              }),
              0.2,
            );
            if (executionCancel.current !== token) return;
            const repaired = mergeRepairedLines(current, parseLineReplacements(repairRaw ? parseModelJson(repairRaw) : null));
            const named = namedBrand ? ensureBrandMention(repaired, namedBrand) : repaired;
            const voiced = chosenCta ? detachCallToAction(named, chosenCta) : named;
            current = speech ? withSpeech({ ...voiced, pointOfView: lockedView }, speech) : { ...voiced, pointOfView: lockedView };
            const recheckRaw = await askThinkingLab(
              buildViewpointAuditPrompt({
                ideaStatement: idea.statement,
                pointOfView: lockedView,
                lines: narrationLines(),
              }),
              0,
            );
            if (executionCancel.current !== token) return;
            viewpointIssues = parseLineIssues(recheckRaw ? parseModelJson(recheckRaw) : null, current);
          }
        }
        setExecutionProgress({ phase: "audit", pillarName: pillar.name });
        const continuityRaw = await askThinkingLab(
          buildContinuityAuditPrompt({
            ideaStatement: idea.statement,
            lines: chainNarrationLines(current),
          }),
          0,
        );
        if (executionCancel.current !== token) return;
        const seen = new Set(viewpointIssues.map((issue) => issue.lineId));
        const productionIssues = [
          ...viewpointIssues.map((issue) => ({ ...issue, kind: "viewpoint" as const })),
          ...parseLineIssues(continuityRaw ? parseModelJson(continuityRaw) : null, current)
            .filter((issue) => !seen.has(issue.lineId))
            .map((issue) => ({ ...issue, kind: "continuity" as const })),
        ];
        const { productionIssues: _droppedProduction, ...withoutProduction } = current;
        current = {
          ...withoutProduction,
          lineIssues: [],
          ...(productionIssues.length > 0 ? { productionIssues } : {}),
        };
        const statement = storyVoiceOver(current);
        if (!statement) continue;
        setExecutionDraft(current);
        let liveChecks: ExecutionPassCheck[] = [];
        const videoCheckInput = {
          pillar: pillar.name,
          pillarCategory: pillar.category,
          pillarDescription: pillar.description,
          masterStatement,
          masterSubject,
          ideaStatement: idea.statement,
          ancestors,
          pillarDevelopment,
          script: current,
          masterSells,
          auditLessons: priorLessons,
          ask: (prompt: string) => askThinkingLab(prompt, 0),
          resolveSelling: async () => {
            const raw = await askThinkingLab(buildMasterSellsPrompt(masterStatement), 0);
            const value = parseMasterSells(raw ? parseModelJson(raw) : null);
            setMasterSells(value);
            return value;
          },
          onStep: (checks: ExecutionPassCheck[]) => {
            liveChecks = checks;
            setExecutionRunChecks(checks);
            if (!trackedId) return;
            setExecutionChecklists((lists) => ({ ...lists, [trackedId]: checks }));
          },
        };
        const checked = await (keptSwitches
          ? runExecutionOpenChecks({ ...videoCheckInput, prior: keptSwitches })
          : runExecutionMeaningChecks(videoCheckInput));
        if (executionCancel.current !== token) return;
        const lesson = lessonFromMeaningAudit(checked.facts, current);
        const withLesson = lesson
          ? { ...checked.facts, auditLessons: mergeExecutionAuditLessons(checked.facts.auditLessons ?? [], [lesson]) }
          : checked.facts;
        const recommended =
          fromRecommendation || pillarHopStopped(pillar.name, current)
            ? withLesson
            : await withPillarRecommendation(withLesson, pillar.name, idea.statement, ancestors, token);
        if (executionCancel.current !== token) return;
        const script = keepCharacterVisuals(current, previousScript ?? null);
        const saved = await labExecutions.save.mutateAsync({
          ideaId: idea.id,
          pillar: pillar.id,
          contentPillarId: pillar.id,
          pillarName: pillar.name,
          statement: flattenVoiceOver(script),
          script,
          facts: recommended,
          ...(creativeLink ? { creativeLink } : {}),
        });
        setExecutionChecklists((currentLists) => ({ ...currentLists, [saved.id]: liveChecks }));
        setExecutionLineOffer(null);
        setExecutionRepairNote(null);
        lastId = saved.id;
      }
      if (executionCancel.current !== token) return;
      if (!lastId) {
        toast.error(t("thinkingLab.execution.unreadable", "The script could not be read. Try that pillar again."));
        return;
      }
      setFocus({
        kind: "execution",
        masterId: origin.masterId,
        thoughtId: origin.thoughtId,
        territoryId: origin.territoryId,
        angleId: origin.angleId,
        ideaId: origin.ideaId,
        executionId: lastId,
      });
    }, "execution").finally(() => {
      if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
    });
  };

  const creativeContextFor = (idea: LabIdea) => {
    const { angle, ancestors } = ideaParentFor(idea.angleId);
    const named = (label: string) => ancestors.find((item) => item.label === label)?.statement ?? "";
    return {
      parentCode: idea.code,
      parentStatement: idea.statement,
      parentConcept: idea.validation?.concept ?? "",
      parentMechanism: idea.validation?.mechanism ?? "",
      parentValue: idea.validation?.value ?? "",
      masterThought: masterStatement,
      audience: selected?.audience ?? "",
      priorBelief: selected?.priorBelief ?? "",
      rootBelief: selected?.rootBelief ?? "",
      bigThought: named("Big Thought"),
      territory: named("Territory"),
      angle: angle?.statement ?? "",
    };
  };

  const onReviewCreativePillars = () => {
    if (!focusedIdea || focusedIdea.status !== "locked") return;
    const idea = focusedIdea;
    setLeadMagnetStep(null);
    void run(async () => {
      const context = creativeContextFor(idea);
      const locked = pillarCardsFor(idea);
      const reviews = await reviewContentPillars({
        pillars: contentPillars.data ?? [],
        excludeIds: locked.map((card) => card.contentPillarId),
        keep: 3,
        context: [context.masterThought, context.bigThought, context.territory, context.angle, context.parentStatement]
          .filter(Boolean)
          .join("\n"),
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      setCreativeReviews(reviewsToStore(reviews));
      setCreativeReviewReady(true);
    }, "creative-review");
  };

  const onReviewLeadMagnetPillars = () => {
    if (!focusedIdea || focusedIdea.status !== "locked") return;
    const idea = focusedIdea;
    setLeadMagnetStep({ pillarName: "", drafting: true, checks: leadMagnetPassChecklist() });
    void run(async () => {
      setCreativeReviews([]);
      setCreativeReviewReady(false);
      const context = creativeContextFor(idea);
      const locked = pillarCardsFor(idea);
      const passed: Awaited<ReturnType<typeof reviewContentPillars>> = [];
      let reviews: Awaited<ReturnType<typeof reviewContentPillars>> = [];
      try {
        reviews = await reviewContentPillars({
          pillars: contentPillars.data ?? [],
          excludeIds: locked.map((card) => card.contentPillarId),
          keep: 3,
          purpose: "lead_magnet",
          context: [context.masterThought, context.bigThought, context.territory, context.angle, context.parentStatement]
            .filter(Boolean)
            .join("\n"),
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (step) => setLeadMagnetStep(step),
          onPass: (review) => {
            passed.push(review);
            setCreativeReviews(reviewsToStore(passed));
            setCreativeReviewReady(true);
          },
        });
        setCreativeReviews(reviewsToStore(reviews));
        setCreativeReviewReady(true);
      } finally {
        const passed = reviews.length > 0;
        setLeadMagnetStep((current) => {
          if (passed) {
            return {
              pillarName: "",
              drafting: false,
              checks: leadMagnetPassChecklist().map((check) => ({ ...check, state: "pass" })),
            };
          }
          if (!current) return current;
          return {
            ...current,
            drafting: false,
            checks: current.checks.map((check) => (check.state === "running" ? { ...check, state: "pending" } : check)),
          };
        });
      }
    }, "creative-review-lead-magnet");
  };

  const rememberedDevelopment = (contentPillarId: string | null | undefined) => {
    if (!focusedIdea || !contentPillarId) return null;
    const text = developmentForPillar(focusedIdea.developmentPaths, contentPillarId, creativeReviews ?? undefined);
    return text || null;
  };

  const rememberCreativePath = (ideaId: string, organizationId: string, path: DevelopmentPath) => {
    creativePathSave.current = creativePathSave.current
      .catch(() => undefined)
      .then(() => saveDevelopmentPath({ organizationId, ideaId, path }))
      .then((paths) => {
        queryClient.setQueriesData<LabIdea[]>({ queryKey: ["thinking-lab-ideas", organizationId] }, (current) =>
          current?.map((row) => (row.id === ideaId ? { ...row, developmentPaths: paths } : row)),
        );
      })
      .catch(reportStepError);
  };

  const lockCreativePillarReviews = (
    toLock: Array<{ contentPillarId: string; pillarName: string; reason: string }>,
    reviews: ReturnType<typeof latestPathReviews>,
  ) => {
    if (!focusedIdea || !masters.organizationId || toLock.length === 0) return;
    const idea = focusedIdea;
    const organizationId = masters.organizationId;
    const baseTime = Date.now();
    for (let index = 0; index < toLock.length; index += 1) {
      const review = toLock[index]!;
      rememberCreativePath(idea.id, organizationId, {
        contentPillarId: review.contentPillarId,
        pillarName: review.pillarName,
        format: null,
        status: "RECOMMENDED",
        reason: review.reason,
        reviews,
        savedAt: new Date(baseTime + index).toISOString(),
      });
    }
    const last = toLock[toLock.length - 1]!;
    setCreativePillarId(last.contentPillarId);
    setCreativeFormat(null);
    if (focus?.kind === "idea" && focus.ideaId === idea.id) {
      setFocus({
        kind: "pillar",
        masterId: focus.masterId,
        thoughtId: focus.thoughtId,
        territoryId: focus.territoryId,
        angleId: focus.angleId,
        ideaId: focus.ideaId,
        contentPillarId: last.contentPillarId,
      });
    }
  };

  const onLockCreativePillar = (contentPillarId: string) => {
    if (!focusedIdea) return;
    const reviews = creativeReviews ?? latestPathReviews(focusedIdea.developmentPaths);
    const review = reviews.find((item) => item.contentPillarId === contentPillarId);
    if (!review?.development.trim() || !review.reason.trim() || review.status !== "RECOMMENDED") return;
    lockCreativePillarReviews([review], reviews);
  };

  const onLockAllCreativePillars = () => {
    if (!focusedIdea) return;
    const reviews = creativeReviews ?? latestPathReviews(focusedIdea.developmentPaths);
    const lockedIds = new Set(pillarCardsFor(focusedIdea).map((card) => card.contentPillarId));
    const toLock = reviews.filter(
      (item) =>
        item.status === "RECOMMENDED" &&
        Boolean(item.development?.trim()) &&
        item.reason.trim() &&
        !lockedIds.has(item.contentPillarId),
    );
    lockCreativePillarReviews(toLock, reviews);
  };

  const onOpenExecutionSettings = (format: CreativeFormat) => {
    if (!focusedIdea || !masters.organizationId || !creativePillarId) return;
    const pillar = (contentPillars.data ?? []).find((item) => item.id === creativePillarId);
    if (!pillar) return;
    const idea = focusedIdea;
    const organizationId = masters.organizationId;
    const reviews = creativeReviews ?? latestPathReviews(idea.developmentPaths);
    const review = reviews.find((item) => item.contentPillarId === pillar.id);
    setCreativeFormat(format);
    setExecutionDirect({
      token: Date.now(),
      pillarId: pillar.id,
      medium: format === "video" ? "video" : "image",
      imageFormat: format === "carousel" ? "carousel" : "single",
    });
    rememberCreativePath(idea.id, organizationId, {
      contentPillarId: pillar.id,
      pillarName: pillar.name,
      format,
      status: review?.status ?? "NOT_REVIEWED",
      reason: review?.reason ?? "",
      reviews,
      savedAt: new Date().toISOString(),
    });
  };

  const listedExecutionChecks = (execution: {
    id: string;
    script: VoiceOverScript | null;
    canonicalSemantic: ExecutionSemanticFacts;
  }): ExecutionPassCheck[] => {
    const live = executionChecklists[execution.id];
    if (live?.length) return execution.script?.medium === "image" ? ensureImageLegacySwitches(live) : ensureVideoPassChecks(live);
    const stored = execution.canonicalSemantic.passChecks;
    if (stored?.length) {
      const checks = stored.map((check) => ({
        id: check.id,
        state: check.state,
        enabled: check.enabled,
        reason: check.reason,
        lineIds: check.lineIds,
      }));
      return execution.script?.medium === "image" ? ensureImageLegacySwitches(checks) : ensureVideoPassChecks(checks);
    }
    if (execution.script?.medium === "image") return ensureImageLegacySwitches(imageChecksFromAudit(execution.canonicalSemantic.meaningAudit));
    return execution.canonicalSemantic.meaningAudit ? executionChecksFromAudit(execution.canonicalSemantic.meaningAudit) : [];
  };

  const saveExecutionFacts = (
    execution: {
      id: string;
      ideaId: string;
      pillar: string;
      contentPillarId: string | null;
      pillarName: string;
      script: VoiceOverScript | null;
    },
    facts: ExecutionSemanticFacts,
  ) => {
    const scriptNow = execution.script;
    if (!scriptNow) return Promise.resolve();
    return labExecutions.save.mutateAsync({
      ideaId: execution.ideaId,
      pillar: execution.contentPillarId ?? execution.pillar,
      contentPillarId: execution.contentPillarId,
      pillarName: execution.pillarName,
      statement: flattenVoiceOver(scriptNow),
      script: scriptNow,
      facts,
    });
  };

  const onResumeOpenExecution = () => {
    if (focus?.kind !== "execution" || !focusedIdea) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script) return;
    const idea = focusedIdea;
    const current = execution;
    const scriptNow = current.script;
    if (!scriptNow) return;
    const prior = listedExecutionChecks(current);
    if (!openPassResume(prior)) return;
    const token = executionCancel.current;
    void run(async () => {
      const { ancestors } = ideaParentFor(idea.angleId);
      setExecutionDraft(scriptNow);
      setExecutionProgress({ phase: "audit", pillarName: current.pillarName, medium: scriptNow.medium === "image" ? "image" : undefined });
      const imageSettings = scriptNow.medium === "image" ? scriptNow.image : null;
      let liveChecks: ExecutionPassCheck[] = [];
      const checked = imageSettings
        ? await runImageOpenChecks({
            pillar: current.pillarName,
            ...pillarFormat(current.pillarName),
            masterStatement,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            script: scriptNow,
            image: imageSettings,
            masterSells: masterSells === "unknown" ? "unresolved" : masterSells,
            auditLessons: imageLessons(current.canonicalSemantic.auditLessons ?? []),
            prior,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
            },
          })
        : await runExecutionOpenChecks({
            pillar: current.pillarName,
            ...pillarFormat(current.pillarName),
            masterStatement,
            masterSubject,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            script: scriptNow,
            masterSells,
            auditLessons: current.canonicalSemantic.auditLessons,
            prior,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
            },
          });
      if (executionCancel.current !== token) return;
      const recommended = pillarHopStopped(current.pillarName, scriptNow, current.id)
        ? checked.facts
        : await withPillarRecommendation(checked.facts, current.pillarName, idea.statement, ancestors, token);
      if (executionCancel.current !== token) return;
      await saveExecutionFacts(current, {
        ...current.canonicalSemantic,
        ...recommended,
        recommendation: recommended.recommendation ?? current.canonicalSemantic.recommendation,
      });
      setExecutionChecklists((lists) => ({ ...lists, [current.id]: liveChecks.length > 0 ? liveChecks : checked.checks }));
    }, "execution-pass").finally(() => {
      if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
    });
  };

  const restorePassChecks = (executionId: string, previous: ExecutionPassCheck[] | null) => {
    setExecutionChecklists((lists) => {
      if (previous) return { ...lists, [executionId]: previous };
      if (!(executionId in lists)) return lists;
      const next = { ...lists };
      delete next[executionId];
      return next;
    });
  };

  const auditCommittedScript = async (
    current: {
      id: string;
      ideaId: string;
      pillar: string;
      contentPillarId: string | null;
      pillarName: string;
      canonicalSemantic: ExecutionSemanticFacts;
    },
    idea: { statement: string; angleId: string },
    script: VoiceOverScript,
    checks: ExecutionPassCheck[],
    rerunOn: boolean,
    token: number,
  ) => {
    const { ancestors } = ideaParentFor(idea.angleId);
    setExecutionDraft(script);
    setExecutionProgress({
      phase: "audit",
      pillarName: current.pillarName,
      medium: script.medium === "image" ? "image" : undefined,
    });
    const prior = rerunOn
      ? checks.map((check) =>
          check.enabled === false
            ? { ...check, state: "pass" as const, enabled: false }
            : { ...check, state: "pending" as const, enabled: true },
        )
      : checks;
    const imageSettings = script.medium === "image" ? script.image : null;
    let liveChecks: ExecutionPassCheck[] = [];
    const checked = imageSettings
      ? await runImageOpenChecks({
          pillar: current.pillarName,
          ...pillarFormat(current.pillarName),
          masterStatement,
          ideaStatement: idea.statement,
          ancestors,
          pillarDevelopment: rememberedDevelopment(current.contentPillarId),
          script,
          image: imageSettings,
          masterSells: masterSells === "unknown" ? "unresolved" : masterSells,
          auditLessons: imageLessons(current.canonicalSemantic.auditLessons ?? []),
          prior,
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (next) => {
            liveChecks = next;
            setExecutionRunChecks(next);
            setExecutionChecklists((lists) => ({ ...lists, [current.id]: next }));
          },
        })
      : await runExecutionOpenChecks({
          pillar: current.pillarName,
          ...pillarFormat(current.pillarName),
          masterStatement,
          masterSubject,
          ideaStatement: idea.statement,
          ancestors,
          pillarDevelopment: rememberedDevelopment(current.contentPillarId),
          script,
          masterSells,
          auditLessons: current.canonicalSemantic.auditLessons,
          prior,
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (next) => {
            liveChecks = next;
            setExecutionRunChecks(next);
            setExecutionChecklists((lists) => ({ ...lists, [current.id]: next }));
          },
        });
    if (executionCancel.current !== token) return;
    const recommended = pillarHopStopped(current.pillarName, script, current.id)
      ? checked.facts
      : await withPillarRecommendation(checked.facts, current.pillarName, idea.statement, ancestors, token);
    if (executionCancel.current !== token) return;
    await labExecutions.save.mutateAsync({
      ideaId: current.ideaId,
      pillar: current.contentPillarId ?? current.pillar,
      contentPillarId: current.contentPillarId,
      pillarName: current.pillarName,
      statement: flattenVoiceOver(script),
      script,
      facts: {
        ...current.canonicalSemantic,
        ...recommended,
        recommendation: recommended.recommendation ?? current.canonicalSemantic.recommendation,
      },
    });
    setExecutionChecklists((lists) => ({ ...lists, [current.id]: liveChecks.length > 0 ? liveChecks : checked.checks }));
  };

  const onToggleExecutionPass = (id: string, enabled: boolean) => {
    if (focus?.kind !== "execution" || !focusedIdea || executionProgress || executionPassProposal) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script) return;
    const toggled = togglePassCheck(listedExecutionChecks(execution), id, enabled);
    const switched = toggled.checks.find((check) => check.id === id);
    if (!switched) return;
    const idea = focusedIdea;
    const current = execution;
    const scriptNow = current.script;
    if (!scriptNow) return;
    const previousChecks = executionChecklists[current.id] ?? null;
    const token = executionCancel.current;
    void run(async () => {
      const lines = switchRewriteLines(scriptNow, switched.id);
      let committed = false;
      let proposed = false;
      const commitSwitch = async (checks: ExecutionPassCheck[]) => {
        setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
        await saveExecutionFacts(current, factsForPassChecks(current.canonicalSemantic, checks));
        committed = true;
      };
      try {
        if (lines.length === 0) {
          await commitSwitch(enabled ? checksImplementedBySwitch(toggled.checks) : toggled.checks);
          return;
        }
        setExecutionChecklists((lists) => ({
          ...lists,
          [current.id]: toggled.checks.map((check) => (check.id === switched.id ? { ...check, state: "running" } : check)),
        }));
        setExecutionDraft(scriptNow);
        setExecutionProgress({
          phase: "switch",
          pillarName: current.pillarName,
          medium: scriptNow.medium === "image" ? "image" : undefined,
        });
        const raw = await askThinkingLab(
          buildPassSwitchRewritePrompt({
            checkId: switched.id,
            enabled,
            enabledIds: toggled.checks.flatMap((check) => (check.enabled === false ? [] : [check.id])),
            surface: scriptNow.medium === "image" ? "image" : "video",
            ideaStatement: idea.statement,
            masterStatement,
            pillarName: current.pillarName,
            ...pillarFormat(current.pillarName),
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            ancestors: ideaParentFor(idea.angleId).ancestors,
            lines,
          }),
          0.2,
        );
        if (executionCancel.current !== token) return;
        const allowed = new Set(lines.map((line) => line.id));
        const nextScript = applyPassSwitchScript(
          scriptNow,
          parseExecutionNarrationReplacements(raw ? parseModelJson(raw) : null).filter((row) => allowed.has(row.lineId)),
        );
        const changes = narrationChangeRows(lines, switchRewriteLines(nextScript, switched.id));
        if (passSwitchOutcome(changes) === "save-switch") {
          await commitSwitch(enabled ? checksImplementedBySwitch(toggled.checks) : toggled.checks);
          return;
        }
        proposed = true;
        setExecutionPassProposal({
          executionId: current.id,
          checks: toggled.checks,
          script: nextScript,
          changes,
          previousChecks,
          implemented: enabled,
        });
        setExecutionChecklists((lists) => ({ ...lists, [current.id]: toggled.checks }));
      } catch (error) {
        if (!committed) restorePassChecks(current.id, previousChecks);
        throw error;
      } finally {
        if (executionCancel.current === token) {
          setExecutionProgress(null);
          setExecutionDraft(null);
          setExecutionRunChecks(null);
        } else if (!committed && !proposed) {
          restorePassChecks(current.id, previousChecks);
        }
      }
    }, "execution-pass");
  };

  const onAcceptPassProposal = () => {
    const proposal = executionPassProposal;
    if (!proposal || focus?.kind !== "execution" || !focusedIdea || focus.executionId !== proposal.executionId || executionProgress) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === proposal.executionId);
    if (!execution) return;
    const idea = focusedIdea;
    const token = executionCancel.current;
    void run(async () => {
      const checks = proposal.implemented ? checksImplementedBySwitch(proposal.checks) : proposal.checks;
      await labExecutions.save.mutateAsync({
        ideaId: execution.ideaId,
        pillar: execution.contentPillarId ?? execution.pillar,
        contentPillarId: execution.contentPillarId,
        pillarName: execution.pillarName,
        statement: flattenVoiceOver(proposal.script),
        script: proposal.script,
        facts: factsForPassChecks(execution.canonicalSemantic, checks),
      });
      if (executionCancel.current !== token) return;
      setExecutionPassProposal(null);
      setExecutionChecklists((lists) => ({ ...lists, [proposal.executionId]: checks }));
      if (!proposal.implemented) {
        await auditCommittedScript(execution, idea, proposal.script, proposal.checks, true, token);
      }
    }, "execution-pass").finally(() => {
      if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
    });
  };

  const onDeclinePassProposal = () => {
    const proposal = executionPassProposal;
    if (!proposal) return;
    restorePassChecks(proposal.executionId, proposal.previousChecks);
    setExecutionPassProposal(null);
  };

  const onRegenerateExecution = () => {
    if (focus?.kind !== "execution") return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution) return;
    const match = (contentPillars.data ?? []).find(
      (pillar) => pillar.id === execution.contentPillarId || pillar.id === execution.pillar || pillar.name === execution.pillarName,
    );
    const pillar: LabContentPillar = match ?? {
      id: execution.contentPillarId ?? execution.pillar,
      name: execution.pillarName,
      funnel: "top",
      category: null,
      isDefault: false,
    };
    const switches = regeneratePassPrior(listedExecutionChecks(execution));
    onGenerateExecutions(
      [pillar],
      execution.script?.audio ?? { sound: false, music: false },
      execution.script?.look,
      execution.script?.speech,
      execution.script,
      execution.script?.durationSeconds,
      execution.script?.brandName,
      execution.script?.cta,
      undefined,
      undefined,
      false,
      null,
      execution.script?.medium === "image" ? execution.script.image ?? null : null,
      true,
      switches,
      null,
      rememberedDevelopment(pillar.id),
    );
  };

  const onRewriteExecution = () => {
    if (focus?.kind !== "execution") return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution) return;
    const match = (contentPillars.data ?? []).find(
      (pillar) => pillar.id === execution.contentPillarId || pillar.id === execution.pillar || pillar.name === execution.pillarName,
    );
    const pillar: LabContentPillar = match ?? {
      id: execution.contentPillarId ?? execution.pillar,
      name: execution.pillarName,
      funnel: "top",
      category: null,
      isDefault: false,
    };
    if (execution.script?.medium === "image" && imageRewriteFromFailure(execution.canonicalSemantic.meaningAudit)) {
      onRepairExecution();
      return;
    }
    if (
      execution.script?.medium !== "image" &&
      isFailedMeaningAudit(execution.canonicalSemantic.meaningAudit) &&
      (execution.canonicalSemantic.meaningAudit.id === "soundsSpoken" ||
        execution.canonicalSemantic.meaningAudit.id === "usesSlang") &&
      meaningLineRepairReady(execution.canonicalSemantic)
    ) {
      onRepairExecution();
      return;
    }
    if (openPassResume(listedExecutionChecks(execution))) {
      onResumeOpenExecution();
      return;
    }
    loadScriptConfirm({
      pillars: [pillar],
      audio: execution.script?.audio ?? { sound: false, music: false },
      look: execution.script?.look,
      speech: execution.script?.speech,
      durationSeconds: execution.script?.durationSeconds ?? null,
      brandName: execution.script?.brandName ?? null,
      cta: execution.script?.cta ?? null,
      image: execution.script?.medium === "image" ? execution.script.image ?? null : null,
      pillarDevelopment: rememberedDevelopment(pillar.id),
    });
  };

  const onUseRecommendation = (pillarName?: string) => {
    if (focus?.kind !== "execution") return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    const name = (pillarName ?? execution?.canonicalSemantic.recommendation?.pillarName ?? "").trim();
    if (!execution || !name) return;
    const match = (contentPillars.data ?? []).find((pillar) => pillar.name.trim().toLowerCase() === name.toLowerCase());
    if (!match) return;
    executionCancel.current += 1;
    const start = () => {
      if (pillarUseWait.current !== null) {
        window.clearInterval(pillarUseWait.current);
        pillarUseWait.current = null;
      }
      onGenerateExecutions(
        [match],
        execution.script?.audio ?? { sound: false, music: false },
        execution.script?.look,
        execution.script?.speech,
        execution.script,
        execution.script?.durationSeconds,
        execution.script?.brandName,
        execution.script?.cta,
        execution.script?.pointOfView,
        execution.script?.decisions,
        true,
        execution.canonicalSemantic.auditLessons,
        execution.script?.medium === "image" ? execution.script.image ?? null : null,
        false,
        null,
        null,
        rememberedDevelopment(match.id),
      );
    };
    if (!labRunRef.current) {
      start();
      return;
    }
    if (pillarUseWait.current !== null) window.clearInterval(pillarUseWait.current);
    pillarUseWait.current = window.setInterval(() => {
      if (labRunRef.current) return;
      start();
    }, 100);
  };

  const onRegenerateLine = (lineId: string) => {
    if (focus?.kind !== "execution" || !focusedIdea || executionProgress) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script || execution.script.medium === "image") return;
    const line = execution.script.scenes.flatMap((scene) => scene.lines).find((row) => row.id === lineId);
    if (!line?.narration.trim()) return;
    const idea = focusedIdea;
    const current = execution;
    const scriptNow = current.script;
    const token = executionCancel.current;
    void run(async () => {
      setFixingLineId(lineId);
      const previousChecks = listedExecutionChecks(current).map((check) => ({ ...check }));
      try {
        const { ancestors } = ideaParentFor(idea.angleId);
        const format = pillarFormat(current.pillarName);
        const listed = previousChecks.length > 0 ? previousChecks : emptyExecutionPassChecklist();
        const enabled = listed.filter((check) => check.enabled !== false).map((check) => check.id);
        const refused = new Set<string>([line.narration.trim().toLowerCase()]);
        const learned = [...(current.canonicalSemantic.auditLessons ?? [])];
        const learnedDuring: typeof learned = [];
        let working = scriptNow;
        let failure: { id: ExecutionPassCheck["id"]; reason: string } | null = null;
        let kept: ExecutionPassCheck["id"][] = [];
        let passed = false;
        for (let attempt = 0; attempt < fixAttemptCap() && !passed; attempt += 1) {
          if (executionCancel.current !== token) return;
          setExecutionProgress({ phase: "line", pillarName: current.pillarName });
          const raw = await askThinkingLab(
            failure
              ? buildExecutionMeaningRepairPrompt({
                  ideaStatement: idea.statement,
                  masterStatement,
                  masterSubject,
                  ancestors,
                  pillarName: current.pillarName,
                  ...format,
                  pillarDevelopment: rememberedDevelopment(current.contentPillarId),
                  checkId: failure.id,
                  reason: failure.reason,
                  script: working,
                  lineIds: [lineId],
                  lessons: learned,
                  scope: {
                    preserve: kept,
                    repair: [{ id: failure.id, reason: failure.reason }],
                  },
                })
              : buildNarrationLineRegeneratePrompt({
                  lineId,
                  enabled,
                  ideaStatement: idea.statement,
                  masterStatement,
                  masterSubject,
                  ancestors,
                  pillarName: current.pillarName,
                  ...format,
                  pillarDevelopment: rememberedDevelopment(current.contentPillarId),
                  script: working,
                  refused: [...refused],
                }),
            0.2,
          );
          if (executionCancel.current !== token) return;
          const replacement = parseExecutionNarrationReplacements(raw ? parseModelJson(raw) : null).find((row) => row.lineId === lineId);
          const narration = replacement?.narration.trim() ?? "";
          if (!narration || refused.has(narration.toLowerCase())) {
            failure = failure ?? { id: enabled[0] ?? "soundsSpoken", reason: "The new line repeated a narration that already failed." };
            continue;
          }
          refused.add(narration.toLowerCase());
          working = mergeNarrationRepairs(working, [{ lineId, narration }]);
          setExecutionDraft(working);
          setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
          let liveChecks: ExecutionPassCheck[] = [];
          const checked = await runExecutionOpenChecks({
            pillar: current.pillarName,
            ...format,
            masterStatement,
            masterSubject,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            script: working,
            masterSells,
            auditLessons: learned,
            prior: regeneratePassPrior(listed),
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
            },
          });
          if (executionCancel.current !== token) return;
          if (checked.passed) {
            const lessons = mergeExecutionAuditLessons(learned, learnedDuring);
            await labExecutions.save.mutateAsync({
              ideaId: idea.id,
              pillar: current.contentPillarId ?? current.pillar,
              contentPillarId: current.contentPillarId,
              pillarName: current.pillarName,
              statement: flattenVoiceOver(working),
              script: working,
              facts: {
                ...current.canonicalSemantic,
                ...checked.facts,
                recommendation: current.canonicalSemantic.recommendation,
                auditLessons: lessons,
              },
            });
            setExecutionChecklists((lists) => ({ ...lists, [current.id]: liveChecks.length > 0 ? liveChecks : checked.checks }));
            setExecutionRepairNote(null);
            setExecutionLineOffer(null);
            passed = true;
            return;
          }
          const failedCheck = checked.checks.find((check) => check.enabled !== false && check.state === "fail");
          if (!failedCheck) break;
          failure = { id: failedCheck.id, reason: failedCheck.reason ?? "This line no longer passes." };
          kept = checked.checks.filter((check) => check.enabled !== false && check.state === "pass").map((check) => check.id);
          const lesson = lessonFromMeaningAudit(checked.facts, working);
          if (lesson) {
            learned.push(lesson);
            learnedDuring.push(lesson);
          }
        }
        if (executionCancel.current !== token || passed) return;
        setExecutionChecklists((lists) => ({ ...lists, [current.id]: previousChecks }));
        setExecutionRunChecks(null);
        setExecutionRepairNote(
          failure?.reason
            ? `${t("thinkingLab.execution.lineKept", "This line was left as it was. The new wording did not pass the requirements that are switched on.")} ${failure.reason}`
            : t("thinkingLab.execution.lineKept", "This line was left as it was. The new wording did not pass the requirements that are switched on."),
        );
      } finally {
        setFixingLineId((currentId) => (currentId === lineId ? null : currentId));
        if (executionCancel.current === token) {
          setExecutionProgress(null);
          setExecutionDraft(null);
          setExecutionRunChecks(null);
        }
      }
    }, "execution-regenerate-line");
  };

  const onFixLine = (lineId: string) => {
    if (focus?.kind !== "execution" || !focusedIdea) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    const production = execution?.script?.productionIssues?.find((row) => row.lineId === lineId);
    const issue = production ?? (execution?.canonicalSemantic.meaningAudit ? undefined : execution?.script?.lineIssues.find((row) => row.lineId === lineId));
    if (!execution?.script || !issue) return;
    const idea = focusedIdea;
    const current = execution;
    const scriptNow = current.script as NonNullable<typeof current.script>;
    const token = executionCancel.current;
    void run(async () => {
      setFixingLineId(lineId);
      try {
      if (production) {
        const line = scriptNow.scenes.flatMap((scene) => scene.lines).find((row) => row.id === lineId);
        if (!line) return;
        setExecutionProgress({ phase: "repair", pillarName: current.pillarName });
        const raw = await askThinkingLab(
          buildProductionRepairPrompt({
            ideaStatement: idea.statement,
            pointOfView: scriptNow.pointOfView,
            lineId,
            narration: line.narration,
            reason: production.reason,
            kind: production.kind,
          }),
          0.2,
        );
        if (executionCancel.current !== token) return;
        const replacement = parseExecutionNarrationReplacements(raw ? parseModelJson(raw) : null).find((row) => row.lineId === lineId);
        if (!replacement) return;
        const merged = mergeNarrationRepairs(scriptNow, [replacement]);
        const narration = merged.scenes.flatMap((scene) => scene.lines.map((row) => ({ id: row.id, narration: row.narration })));
        const useViewpoint = production.kind === "viewpoint" && Boolean(merged.pointOfView?.trim());
        const recheckRaw = await askThinkingLab(
          useViewpoint
            ? buildViewpointAuditPrompt({
                ideaStatement: idea.statement,
                pointOfView: merged.pointOfView ?? "",
                lines: linesForProductionRecheck(narration, lineId, "viewpoint"),
              })
            : buildContinuityAuditPrompt({
                ideaStatement: idea.statement,
                lines: linesForProductionRecheck(chainNarrationLines(merged), lineId, "continuity"),
              }),
          0,
        );
        if (executionCancel.current !== token) return;
        const nextIssue = parseLineIssues(recheckRaw ? parseModelJson(recheckRaw) : null, merged).find((row) => row.lineId === lineId) ?? null;
        const productionIssues = [
          ...(scriptNow.productionIssues ?? []).filter((row) => row.lineId !== lineId),
          ...(nextIssue ? [{ ...nextIssue, kind: production.kind }] : []),
        ];
        await labExecutions.save.mutateAsync({
          ideaId: idea.id,
          pillar: current.contentPillarId ?? current.pillar,
          contentPillarId: current.contentPillarId,
          pillarName: current.pillarName,
          statement: flattenVoiceOver(merged),
          script: { ...merged, ...(productionIssues.length > 0 ? { productionIssues } : { productionIssues: undefined }) },
          facts: current.canonicalSemantic,
        });
        return;
      }
      const { ancestors } = ideaParentFor(idea.angleId);
      setExecutionProgress({ phase: "repair", pillarName: current.pillarName });
      const raw = await askThinkingLab(
        buildLineRepairPrompt({
          ideaStatement: idea.statement,
          masterStatement,
          priorBelief: selected?.priorBelief,
          ancestors,
          pillarName: current.pillarName,
          script: { ...scriptNow, lineIssues: [issue] },
        }),
        0.2,
      );
      if (executionCancel.current !== token) return;
      const replacements = parseLineReplacements(raw ? parseModelJson(raw) : null).filter((row) => row.lineId === lineId);
      if (replacements.length === 0) return;
      const merged = detachCallToAction(
        ensureBrandMention(mergeRepairedLines(scriptNow, replacements), scriptNow.brandName ?? ""),
        scriptNow.cta ?? "",
      );
      const narration = merged.scenes.flatMap((scene) => scene.lines.map((line) => ({ id: line.id, narration: line.narration })));
      let nextIssue: { lineId: string; reason: string } | null = null;
      if (merged.pointOfView?.trim()) {
        const viewpointRaw = await askThinkingLab(
          buildViewpointAuditPrompt({
            ideaStatement: idea.statement,
            pointOfView: merged.pointOfView,
            lines: linesForProductionRecheck(narration, lineId, "viewpoint"),
          }),
          0,
        );
        if (executionCancel.current !== token) return;
        nextIssue = parseLineIssues(viewpointRaw ? parseModelJson(viewpointRaw) : null, merged).find((row) => row.lineId === lineId) ?? null;
      }
      if (!nextIssue) {
        const lineRaw = await askThinkingLab(
          buildLineAuditPrompt({
            ideaStatement: idea.statement,
            masterStatement,
            priorBelief: selected?.priorBelief,
            ancestors,
            lines: chainNarrationLines(merged),
          }),
          0,
        );
        if (executionCancel.current !== token) return;
        nextIssue = parseLineIssues(lineRaw ? parseModelJson(lineRaw) : null, merged).find((row) => row.lineId === lineId) ?? null;
      }
      const script = {
        ...merged,
        lineIssues: [...scriptNow.lineIssues.filter((row) => row.lineId !== lineId), ...(nextIssue ? [nextIssue] : [])],
      };
      await labExecutions.save.mutateAsync({
        ideaId: idea.id,
        pillar: current.contentPillarId ?? current.pillar,
        contentPillarId: current.contentPillarId,
        pillarName: current.pillarName,
        statement: flattenVoiceOver(script),
        script,
        facts: current.canonicalSemantic,
      });
      } finally {
        setFixingLineId((currentId) => (currentId === lineId ? null : currentId));
        if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
      }
    }, "execution-fix-line");
  };

  const onUseExecutionOffer = () => {
    if (focus?.kind !== "execution" || !executionLineOffer || executionLineOffer.executionId !== focus.executionId) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    const offer = executionLineOffer;
    if (!execution) return;
    void run(async () => {
      await labExecutions.save.mutateAsync({
        ideaId: execution.ideaId,
        pillar: execution.contentPillarId ?? execution.pillar,
        contentPillarId: execution.contentPillarId,
        pillarName: execution.pillarName,
        statement: flattenVoiceOver(offer.script),
        script: offer.script,
        facts: offer.facts,
      });
      setExecutionLineOffer(null);
      setExecutionRepairNote(null);
    }, "execution-offer");
  };

  const onRetrySelling = () => {
    if (focus?.kind !== "execution" || !focusedIdea || !masterStatement) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script) return;
    const idea = focusedIdea;
    const current = execution;
    const token = executionCancel.current;
    void run(async () => {
      const { ancestors } = ideaParentFor(idea.angleId);
      setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
      const raw = await askThinkingLab(buildMasterSellsPrompt(masterStatement), 0);
      if (executionCancel.current !== token) return;
      const selling = parseMasterSells(raw ? parseModelJson(raw) : null);
      setMasterSells(selling);
      const scriptNow = current.script as NonNullable<typeof current.script>;
      setExecutionDraft(scriptNow);
      let liveChecks: ExecutionPassCheck[] = [];
      const checked = await runExecutionMeaningChecks({
        pillar: current.pillarName,
        ...pillarFormat(current.pillarName),
        masterStatement,
        masterSubject,
        ideaStatement: idea.statement,
        ancestors,
        pillarDevelopment: rememberedDevelopment(current.contentPillarId),
        script: scriptNow,
        masterSells: selling,
        auditLessons: current.canonicalSemantic.auditLessons,
        prior: listedExecutionChecks(current),
        ask: (prompt) => askThinkingLab(prompt, 0),
        onStep: (checks) => {
          liveChecks = checks;
          setExecutionRunChecks(checks);
          setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
        },
      });
      if (executionCancel.current !== token) return;
      const lesson = lessonFromMeaningAudit(checked.facts, scriptNow);
      const withLesson = lesson
        ? { ...checked.facts, auditLessons: mergeExecutionAuditLessons(checked.facts.auditLessons ?? [], [lesson]) }
        : checked.facts;
      const recommended = pillarHopStopped(current.pillarName, scriptNow, current.id)
        ? withLesson
        : await withPillarRecommendation(withLesson, current.pillarName, idea.statement, ancestors, token);
      if (executionCancel.current !== token) return;
      await labExecutions.save.mutateAsync({
        ideaId: idea.id,
        pillar: current.contentPillarId ?? current.pillar,
        contentPillarId: current.contentPillarId,
        pillarName: current.pillarName,
        statement: flattenVoiceOver(scriptNow),
        script: scriptNow,
        facts: recommended,
      });
      setExecutionChecklists((lists) => ({ ...lists, [current.id]: liveChecks }));
    }, "execution-selling").finally(() => {
      if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
    });
  };

  const onRepairExecution = () => {
    if (focus?.kind !== "execution" || !focusedIdea) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script) return;
    if (execution.script.medium === "image") {
      if (!execution.script.image || !isFailedMeaningAudit(execution.canonicalSemantic.meaningAudit)) return;
      const idea = focusedIdea;
      const current = execution;
      const audit = current.canonicalSemantic.meaningAudit;
      const settings = execution.script.image;
      if (!isFailedMeaningAudit(audit)) return;
      const token = executionCancel.current;
      void run(async () => {
        const { ancestors } = ideaParentFor(idea.angleId);
        const scriptNow = current.script as NonNullable<typeof current.script>;
        setExecutionRepairNote(null);
        setExecutionLineOffer(null);
        const startingChecks = imageRecheckClaim(listedExecutionChecks(current));
        let script = scriptNow;
        let shown = startingChecks;
        const learned = imageLessons(current.canonicalSemantic.auditLessons ?? []);
        const learnedDuring: typeof learned = [];
        const refused = new Set(learned.flatMap((lesson) => lesson.lines.map((line) => line.trim().toLowerCase())));
        let passed = false;
        let latestChecks = startingChecks;
        let latestScript = scriptNow;
        let latestFacts = current.canonicalSemantic;
        const format = pillarFormat(current.pillarName);
        const saveScript = async (
          nextScript: typeof scriptNow,
          facts: ExecutionSemanticFacts,
          checks: ExecutionPassCheck[],
        ) => {
          const recommended = pillarHopStopped(current.pillarName, nextScript, current.id)
            ? facts
            : await withPillarRecommendation(facts, current.pillarName, idea.statement, ancestors, token);
          if (executionCancel.current !== token) return false;
          await labExecutions.save.mutateAsync({
            ideaId: idea.id,
            pillar: current.contentPillarId ?? current.pillar,
            contentPillarId: current.contentPillarId,
            pillarName: current.pillarName,
            statement: flattenVoiceOver(nextScript),
            script: nextScript,
            facts: {
              ...current.canonicalSemantic,
              ...recommended,
              recommendation: recommended.recommendation ?? current.canonicalSemantic.recommendation,
            },
          });
          setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
          return true;
        };
        for (let attempt = 0; attempt < fixAttemptCap() + 1 && !passed; attempt += 1) {
          if (attempt > 0) {
            const failedCheck = shown.find((check) => check.state === "fail");
            if (failedCheck?.id === "soundsSpoken") {
              const speechLines = imageSpeechRepairLines(script, failedCheck.lineIds);
              if (speechLines.length === 0) break;
              const speechLessons = learned.filter(
                (lesson) => lesson.checkId === failedCheck.id || !shown.some((check) => check.id === lesson.checkId && check.state === "pass"),
              );
              for (const speechLineId of speechLines) {
                const line = script.scenes.flatMap((scene) => scene.lines).find((row) => row.id === speechLineId);
                if (line?.narration.trim()) refused.add(line.narration.trim().toLowerCase());
              }
              setExecutionProgress({ phase: "repair", pillarName: current.pillarName, medium: "image" });
              const rawSpeech = await askThinkingLab(
                buildImageSpeechRepairPrompt({
                  pillar: current.pillarName,
                  ...format,
                  masterStatement,
                  ideaStatement: idea.statement,
                  ancestors,
                  script,
                  image: settings,
                  lineIds: speechLines,
                  reason: failedCheck.reason ?? "",
                  lessons: speechLessons,
                }),
                0.2,
              );
              if (executionCancel.current !== token) return;
              const freshSpeech = parseImageSpeechRepairs(rawSpeech ? parseModelJson(rawSpeech) : null).filter(
                (row) => speechLines.includes(row.lineId) && row.narration.trim() && !refused.has(row.narration.trim().toLowerCase()),
              );
              if (freshSpeech.length === 0) {
                const lesson = {
                  checkId: failedCheck.id,
                  reason: "No replacement came back.",
                  lines: speechLines.flatMap((id) => {
                    const line = script.scenes.flatMap((scene) => scene.lines).find((row) => row.id === id);
                    return line?.narration.trim() ? [line.narration.trim()] : [];
                  }),
                };
                learned.push(lesson);
                learnedDuring.push(lesson);
                continue;
              }
              for (const row of freshSpeech) script = mergeImageSlideRepair(script, row, settings);
              shown = imageChecksAfterSlideRewrite(shown, failedCheck.id);
            } else {
            const captionRepair =
              failedCheck?.id === "emotionalTone" &&
              failedCheck.lineIds?.length === 1 &&
              failedCheck.lineIds[0] === "caption" &&
              settings.format === "single";
            const lineId = captionRepair
              ? "caption"
              : failedCheck
                ? imageSlideRepairLine(script, failedCheck.lineIds, failedCheck.reason)
                : null;
            const ready = captionRepair
              ? true
              : failedCheck && lineId
                ? imageSlideRepairReady(
                    {
                      ...current.canonicalSemantic,
                      meaningAudit: { id: failedCheck.id, reason: failedCheck.reason ?? "", lineIds: [lineId] },
                    },
                    { ...script, medium: "image", image: settings },
                  )
                : false;
            if (!failedCheck || !lineId || !ready) break;
            if (captionRepair) {
              const oldCaption = script.caption.trim();
              refused.add(oldCaption.toLowerCase());
              setExecutionProgress({ phase: "repair", pillarName: current.pillarName, medium: "image" });
              const rawCaption = await askThinkingLab(
                buildImageSlideRepairPrompt({
                  id: failedCheck.id,
                  pillar: current.pillarName,
                  ...format,
                  masterStatement,
                  ideaStatement: idea.statement,
                  ancestors,
                  pillarDevelopment: rememberedDevelopment(current.contentPillarId),
                  script,
                  image: settings,
                  lineId,
                  reason: failedCheck.reason ?? "",
                  lessons: learned.filter((lesson) => lesson.checkId === failedCheck.id || !shown.some((check) => check.id === lesson.checkId && check.state === "pass")),
                }),
                0.2,
              );
              if (executionCancel.current !== token) return;
              const captionReplacement = parseImageSlideRepair(rawCaption ? parseModelJson(rawCaption) : null);
              const caption = captionReplacement?.narration.trim() ?? "";
              if (!captionReplacement || captionReplacement.lineId !== "caption" || !caption || caption.toLowerCase() === oldCaption.toLowerCase() || refused.has(caption.toLowerCase())) {
                const lesson = {
                  checkId: failedCheck.id,
                  reason: "No replacement came back.",
                  lines: [oldCaption],
                };
                learned.push(lesson);
                learnedDuring.push(lesson);
                continue;
              }
              script = { ...script, caption };
              shown = imageChecksAfterSlideRewrite(shown, failedCheck.id);
            } else {
            const line = script.scenes.flatMap((scene) => scene.lines).find((row) => row.id === lineId);
            if (!line) break;
            const oldNarration = line.narration.trim();
            const oldPrompt = line.shots.find((shot) => shot.prompt.trim())?.prompt.trim() ?? "";
            refused.add(oldNarration.toLowerCase());
            setExecutionProgress({ phase: "repair", pillarName: current.pillarName, medium: "image" });
            const raw = await askThinkingLab(
              buildImageSlideRepairPrompt({
                id: failedCheck.id,
                pillar: current.pillarName,
                ...format,
                masterStatement,
                ideaStatement: idea.statement,
                ancestors,
                pillarDevelopment: rememberedDevelopment(current.contentPillarId),
                script,
                image: settings,
                lineId,
                reason: failedCheck.reason ?? "",
                lessons: learned.filter((lesson) => lesson.checkId === failedCheck.id || !shown.some((check) => check.id === lesson.checkId && check.state === "pass")),
              }),
              0.2,
            );
            if (executionCancel.current !== token) return;
            const replacement = parseImageSlideRepair(raw ? parseModelJson(raw) : null);
            const narration = failedCheck.id === "imagePrompt" ? oldNarration : replacement?.narration ?? "";
            const prompt = replacement?.prompt.trim() ?? "";
            const repeated =
              failedCheck.id === "imagePrompt"
                ? !prompt || prompt.toLowerCase() === oldPrompt.toLowerCase()
                : !narration || narration.toLowerCase() === oldNarration.toLowerCase() || refused.has(narration.toLowerCase());
            if (!replacement || replacement.lineId !== lineId || repeated) {
              const lesson = {
                checkId: failedCheck.id,
                reason: "No replacement came back.",
                lines: [oldNarration],
              };
              learned.push(lesson);
              learnedDuring.push(lesson);
              continue;
            }
            script = mergeImageSlideRepair(script, { lineId, narration, prompt }, settings);
            shown = imageChecksAfterSlideRewrite(shown, failedCheck.id);
            }
            }
          }
          setExecutionDraft(script);
          setExecutionProgress({ phase: "audit", pillarName: current.pillarName, medium: "image" });
          let liveChecks: ExecutionPassCheck[] = [];
          const checked = await runImageOpenChecks({
            pillar: current.pillarName,
            ...format,
            masterStatement,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            script,
            image: settings,
            masterSells: masterSells === "unknown" ? "unresolved" : masterSells,
            auditLessons: learned,
            prior: shown,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
            },
          });
          if (executionCancel.current !== token) return;
          latestChecks = liveChecks.length > 0 ? liveChecks : checked.checks;
          latestScript = script;
          latestFacts = checked.facts;
          if (!checked.passed) {
            const lesson = lessonFromMeaningAudit(checked.facts, script);
            if (lesson) {
              learned.push(lesson);
              learnedDuring.push(lesson);
              for (const line of lesson.lines) refused.add(line.trim().toLowerCase());
            }
            shown = checked.checks;
            continue;
          }
          const saved = await saveScript(script, {
            ...checked.facts,
            auditLessons: mergeExecutionAuditLessons(learned, learnedDuring),
          }, checked.checks);
          if (!saved) return;
          setExecutionLineOffer(null);
          passed = true;
        }
        if (passed || executionCancel.current !== token) return;
        const lessons = mergeExecutionAuditLessons(current.canonicalSemantic.auditLessons ?? [], learnedDuring);
        if (latestScript !== scriptNow || imageFailureMoved(audit.id, latestChecks)) {
          await saveScript(latestScript, { ...latestFacts, auditLessons: lessons }, latestChecks);
          return;
        }
        await labExecutions.save.mutateAsync({
          ideaId: idea.id,
          pillar: current.contentPillarId ?? current.pillar,
          contentPillarId: current.contentPillarId,
          pillarName: current.pillarName,
          statement: flattenVoiceOver(scriptNow),
          script: scriptNow,
          facts: { ...current.canonicalSemantic, auditLessons: lessons },
        });
        setExecutionChecklists((lists) => ({ ...lists, [current.id]: startingChecks }));
      }, "execution-repair").finally(() => {
        if (executionCancel.current === token) {
          setExecutionProgress(null);
          setExecutionDraft(null);
          setExecutionRunChecks(null);
        }
      });
      return;
    }
    if (meaningLineRepairReady(execution.canonicalSemantic)) {
      const idea = focusedIdea;
      const current = execution;
      const audit = current.canonicalSemantic.meaningAudit;
      if (!isFailedMeaningAudit(audit)) return;
      const token = executionCancel.current;
      void run(async () => {
        const { ancestors } = ideaParentFor(idea.angleId);
        const scriptNow = current.script as NonNullable<typeof current.script>;
        setExecutionRepairNote(null);
        setExecutionLineOffer(null);
        const storedChecks = executionChecklists[current.id];
        const startingChecks =
          storedChecks?.some((check) => check.state === "pass" || check.state === "fail")
            ? storedChecks
            : executionChecksFromAudit(audit);
        let script = scriptNow;
        let shown = startingChecks;
        const learned = [...(current.canonicalSemantic.auditLessons ?? [])];
        const learnedDuring: typeof learned = [];
        const refused = new Set(learned.flatMap((lesson) => lesson.lines.map((line) => line.trim().toLowerCase())));
        let passed = false;
        let latestChecks = startingChecks;
        let latestScript = scriptNow;
        for (let attempt = 0; attempt < fixAttemptCap() && !passed; attempt += 1) {
          const failedCheck = shown.find((check) => check.state === "fail");
          const lineIds = failedCheck?.lineIds ?? [];
          if (!failedCheck || !EXECUTION_LINE_REPAIR_IDS.some((id) => id === failedCheck.id) || lineIds.length === 0) break;
          const failingLines = script.scenes
            .flatMap((scene) => scene.lines)
            .filter((line) => lineIds.includes(line.id));
          for (const line of failingLines) refused.add(line.narration.trim().toLowerCase());
          const scope: FixScope = {
            preserve: shown.filter((check) => check.state === "pass").map((check) => check.id),
            repair: [{ id: failedCheck.id, reason: failedCheck.reason }],
          };
          setExecutionProgress({ phase: "repair", pillarName: current.pillarName });
          const raw = await askThinkingLab(
            buildExecutionMeaningRepairPrompt({
              ideaStatement: idea.statement,
              masterStatement,
              masterSubject,
              ancestors,
              pillarName: current.pillarName,
              ...pillarFormat(current.pillarName),
              pillarDevelopment: rememberedDevelopment(current.contentPillarId),
              checkId: failedCheck.id,
              reason: failedCheck.reason ?? "",
              script,
              lineIds,
              lessons: learned.filter((lesson) => !scope.preserve.includes(lesson.checkId)),
              scope,
            }),
            0.2,
          );
          if (executionCancel.current !== token) return;
          const replacements = parseExecutionNarrationReplacements(raw ? parseModelJson(raw) : null).filter((row) =>
            lineIds.includes(row.lineId),
          );
          const fresh = replacements.filter((row) => !refused.has(row.narration.trim().toLowerCase()));
          const speechRepair = failedCheck.id === "soundsSpoken" || failedCheck.id === "usesSlang";
          if (fresh.length === 0 || (!speechRepair && fresh.length !== replacements.length)) {
            const lesson = {
              checkId: failedCheck.id,
              reason: replacements.length === 0 ? "No replacement came back." : "This narration was offered again after it already failed.",
              lines: replacements.map((row) => row.narration.trim()).filter(Boolean),
            };
            learned.push(lesson);
            learnedDuring.push(lesson);
            continue;
          }
          const merged = mergeNarrationRepairs(script, fresh);
          setExecutionDraft(merged);
          setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
          let liveChecks: ExecutionPassCheck[] = [];
          const checked = await runExecutionOpenChecks({
            pillar: current.pillarName,
        ...pillarFormat(current.pillarName),
            masterStatement,
            masterSubject,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            script: merged,
            masterSells,
            auditLessons: learned,
            prior: shown,
            ask: (prompt) => askThinkingLab(prompt, 0),
            resolveSelling: async () => {
              const sellingRaw = await askThinkingLab(buildMasterSellsPrompt(masterStatement), 0);
              const value = parseMasterSells(sellingRaw ? parseModelJson(sellingRaw) : null);
              setMasterSells(value);
              return value;
            },
            onStep: (checks) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
            },
          });
          if (executionCancel.current !== token) return;
          latestChecks = liveChecks.length > 0 ? liveChecks : checked.checks;
          latestScript = merged;
          if (!checked.passed) {
            const lesson = lessonFromMeaningAudit(checked.facts, merged);
            if (lesson) {
              learned.push(lesson);
              learnedDuring.push(lesson);
              for (const line of lesson.lines) refused.add(line.trim().toLowerCase());
            }
            shown = checked.checks;
            script = merged;
            continue;
          }
          await labExecutions.save.mutateAsync({
            ideaId: idea.id,
            pillar: current.contentPillarId ?? current.pillar,
            contentPillarId: current.contentPillarId,
            pillarName: current.pillarName,
            statement: flattenVoiceOver(merged),
            script: merged,
            facts: {
              ...current.canonicalSemantic,
              ...checked.facts,
              recommendation: current.canonicalSemantic.recommendation,
              auditLessons: mergeExecutionAuditLessons(learned, learnedDuring),
            },
          });
          setExecutionChecklists((lists) => ({ ...lists, [current.id]: checked.checks }));
          setExecutionLineOffer(null);
          passed = true;
        }
        if (passed || executionCancel.current !== token) return;
        const moved =
          (audit.id === "soundsSpoken" && latestScript !== scriptNow) ||
          (latestScript !== scriptNow && executionFailureMoved(audit.id, latestChecks));
        const lessons = mergeExecutionAuditLessons(current.canonicalSemantic.auditLessons ?? [], learnedDuring);
        if (moved) {
          const carriedFacts = executionFactsFromChecks({
            pillar: current.pillarName,
            checks: latestChecks,
            masterSells: current.canonicalSemantic.masterSells,
            auditLessons: lessons,
          });
          await labExecutions.save.mutateAsync({
            ideaId: idea.id,
            pillar: current.contentPillarId ?? current.pillar,
            contentPillarId: current.contentPillarId,
            pillarName: current.pillarName,
            statement: flattenVoiceOver(latestScript),
            script: latestScript,
            facts: {
              ...current.canonicalSemantic,
              ...carriedFacts,
              recommendation: current.canonicalSemantic.recommendation,
            },
          });
          setExecutionChecklists((lists) => ({ ...lists, [current.id]: latestChecks }));
          return;
        }
        await labExecutions.save.mutateAsync({
          ideaId: idea.id,
          pillar: current.contentPillarId ?? current.pillar,
          contentPillarId: current.contentPillarId,
          pillarName: current.pillarName,
          statement: flattenVoiceOver(scriptNow),
          script: scriptNow,
          facts: {
            ...current.canonicalSemantic,
            auditLessons: lessons,
          },
        });
        setExecutionChecklists((lists) => ({ ...lists, [current.id]: startingChecks }));
      }, "execution-repair").finally(() => {
        if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
      });
      return;
    }
    if (!scriptLineRepairReady(execution.canonicalSemantic, execution.script)) return;
    const idea = focusedIdea;
    const current = execution;
    const token = executionCancel.current;
    void run(async () => {
      const { ancestors } = ideaParentFor(idea.angleId);
      const scriptNow = current.script as NonNullable<typeof current.script>;
      const lines = chainNarrationLines(scriptNow);
      setExecutionDraft(scriptNow);
      setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
      const firstRaw = await askThinkingLab(
        buildLineAuditPrompt({
          ideaStatement: idea.statement,
          masterStatement,
          priorBelief: selected?.priorBelief,
          ancestors,
          lines,
        }),
        0,
      );
      if (executionCancel.current !== token) return;
      const issues = parseLineIssues(firstRaw ? parseModelJson(firstRaw) : null, scriptNow);
      if (issues.length === 0) {
        const statement = storyVoiceOver(scriptNow);
        if (!statement) return;
        const facts = await judgeAndSealExecution({
          masterStatement,
          masterSubject,
          ideaStatement: idea.statement,
          pillar: current.pillarName,
          ancestors,
          statement,
          ask: (prompt) => askThinkingLab(prompt, 0),
        });
        if (executionCancel.current !== token) return;
        const recommended = pillarHopStopped(current.pillarName, scriptNow, current.id)
          ? facts
          : await withPillarRecommendation(facts, current.pillarName, idea.statement, ancestors, token);
        if (executionCancel.current !== token) return;
        await labExecutions.save.mutateAsync({
          ideaId: idea.id,
          pillar: current.contentPillarId ?? current.pillar,
          contentPillarId: current.contentPillarId,
          pillarName: current.pillarName,
          statement,
          script: { ...scriptNow, lineIssues: [] },
          facts: recommended,
        });
        return;
      }
      setExecutionProgress({ phase: "repair", pillarName: current.pillarName });
      const raw = await askThinkingLab(
        buildLineRepairPrompt({
          ideaStatement: idea.statement,
          masterStatement,
          priorBelief: selected?.priorBelief,
          ancestors,
          pillarName: current.pillarName,
          script: { ...scriptNow, lineIssues: issues },
        }),
        0.2,
      );
      if (executionCancel.current !== token) return;
      const merged = detachCallToAction(
        ensureBrandMention(
          mergeRepairedLines(scriptNow, parseLineReplacements(raw ? parseModelJson(raw) : null)),
          scriptNow.brandName ?? "",
        ),
        scriptNow.cta ?? "",
      );
      const statement = storyVoiceOver(merged);
      if (!statement) return;
      setExecutionDraft(merged);
      setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
      const facts = await judgeAndSealExecution({
        masterStatement,
        masterSubject,
        ideaStatement: idea.statement,
        pillar: current.pillarName,
        ancestors,
        statement,
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      if (executionCancel.current !== token) return;
      const lineRaw = await askThinkingLab(
        buildLineAuditPrompt({
          ideaStatement: idea.statement,
          masterStatement,
          priorBelief: selected?.priorBelief,
          ancestors,
          lines: chainNarrationLines(merged),
        }),
        0,
      );
      if (executionCancel.current !== token) return;
      const recommended = pillarHopStopped(current.pillarName, merged, current.id)
        ? facts
        : await withPillarRecommendation(facts, current.pillarName, idea.statement, ancestors, token);
      if (executionCancel.current !== token) return;
      const script = { ...merged, lineIssues: parseLineIssues(lineRaw ? parseModelJson(lineRaw) : null, merged) };
      await labExecutions.save.mutateAsync({
        ideaId: idea.id,
        pillar: current.contentPillarId ?? current.pillar,
        contentPillarId: current.contentPillarId,
        pillarName: current.pillarName,
        statement: flattenVoiceOver(script),
        script,
        facts: recommended,
      });
    }, "execution-repair").finally(() => {
      if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
    });
  };

  /**
   * One card: a card that was never checked is checked as it is. A card that failed is rewritten from its
   * failed check (at most three times per card) and checked again. The card keeps its code either way.
   */
  return { onStopExecution, onOpenPillarPicker, loadScriptConfirm, askScriptDiscovery, withPillarRecommendation, pillarHopStopped, onGenerateExecutions, onReviewCreativePillars, onReviewLeadMagnetPillars, rememberedDevelopment, onLockCreativePillar, onLockAllCreativePillars, onOpenExecutionSettings, onToggleExecutionPass, onAcceptPassProposal, onDeclinePassProposal, onRegenerateExecution, onRewriteExecution, onUseRecommendation, onRegenerateLine, onFixLine, onUseExecutionOffer, onRetrySelling, onRepairExecution };
}
