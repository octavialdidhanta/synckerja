import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { MasterCatalogLink } from "@/thinking-lab/master-thought/catalog";
import type { LabFocus } from "@/thinking-lab/page/labFocus";
import type { LabMasterThought } from "@/thinking-lab/master-thought/types";
import type { ProductReasonPool } from "@/thinking-lab/master-thought/productReasonPool";
import type { PendingDelete } from "@/thinking-lab/page/shells/LabDialogs";
import type { useLabCatalogs } from "@/thinking-lab/master-thought/useLabCatalogs";
import type { useMasterThought } from "@/thinking-lab/master-thought/useMasterThought";
import type { PassChecklist } from "@/thinking-lab/big-thought/checklist";
import type { LabIdea } from "@/thinking-lab/idea/repository";
import type { IdeaValidation } from "@/thinking-lab/idea/check/record";
import type { BigThoughtSetRecord } from "@/thinking-lab/big-thought/record";
import type { useLabTerritories } from "@/thinking-lab/territory/useTerritories";
import type { useLabAngles } from "@/thinking-lab/angle/useAngles";
import type { useLabIdeas } from "@/thinking-lab/idea/useIdeas";
import type { useLabExecutions } from "@/thinking-lab/execution/useExecutions";
import type { useIdeaSet } from "@/thinking-lab/idea/useIdeas";
import type { useAngleSet } from "@/thinking-lab/angle/useAngles";
import type { useTerritorySet } from "@/thinking-lab/territory/useTerritories";
import type { useOrgContentPillars } from "@/thinking-lab/execution/pillars";
import type { AnglePassCheck } from "@/thinking-lab/angle/passChecklist";
import type { TerritoryPassCheck } from "@/thinking-lab/territory/passChecklist";
import type { evaluateAngleLock, selectAngleStage } from "@/thinking-lab/angle/lock";
import type { evaluateTerritoryLock, selectTerritoryStage } from "@/thinking-lab/territory/lock";
import type { angleVerdict } from "@/thinking-lab/angle/record";
import type { territoryVerdict } from "@/thinking-lab/territory/record";
import type { lockedPillarCards } from "@/thinking-lab/creative-idea/paths";
import type { StoredPillarReview } from "@/thinking-lab/creative-idea/types";
import type { CreativeFormat } from "@/thinking-lab/creative-idea/types";
import type { ExecutionPassCheck, NarrationChange } from "@/thinking-lab/execution/passChecklist";
import type { VoiceOverScript } from "@/thinking-lab/execution/script";
import type { CharacterGenerateState } from "@/thinking-lab/section/ExecutionScriptPanel";
import type { CharacterStudioTab } from "@/thinking-lab/section/CharacterVisualStudio";
import type { LeadMagnetReviewStep } from "@/thinking-lab/creative-idea/recommend";
import type { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type LabTerritory = NonNullable<ReturnType<typeof useLabTerritories>["data"]>[number];
type LabAngle = NonNullable<ReturnType<typeof useLabAngles>["data"]>[number];
type LabExecution = NonNullable<ReturnType<typeof useLabExecutions>["data"]>[number];

export type LabWorkspaceGridTranslate = ReturnType<typeof useAppTranslation>["t"];

/** Composer panel props (new master thought). */
export type LabMasterComposerProps = {
  t: LabWorkspaceGridTranslate;
  busy: boolean;
  busyAction: string | null;
  newCatalog: MasterCatalogLink;
  setNewCatalog: (value: MasterCatalogLink) => void;
  catalogs: ReturnType<typeof useLabCatalogs>;
  setReasonPool: (pool: ProductReasonPool | null) => void;
  newPrior: string;
  setNewPrior: (value: string) => void;
  newPlanted: string;
  setNewPlanted: (value: string) => void;
  newAudience: string;
  setNewAudience: (value: string) => void;
  onCreate: () => void;
};

/** Saved masters list in composer layout. */
export type LabMasterSavedListProps = {
  masters: ReturnType<typeof useMasterThought>;
  catalogs: ReturnType<typeof useLabCatalogs>;
  closeComposer: () => void;
  skipAutoSelect: MutableRefObject<boolean>;
  setSelectedId: (id: string | null) => void;
  setFocus: (focus: LabFocus | null) => void;
  setPendingDelete: (value: PendingDelete | null) => void;
};

/** Master workflow section (right column, unlocked master). */
export type LabMasterSectionProps = {
  t: LabWorkspaceGridTranslate;
  masters: ReturnType<typeof useMasterThought>;
  selected: LabMasterThought | null;
  hasMasters: boolean;
  showComposer: boolean;
  ready: boolean;
  locked: boolean;
  showBeliefField: boolean;
  editingBelief: boolean;
  masterMenuStage: string | null;
  showGenerateBigThought: boolean;
  busy: boolean;
  busyAction: string | null;
  masterSubject: string;
  masterDescription: string;
  catalogs: ReturnType<typeof useLabCatalogs>;
  onGenerate: () => void;
  onAudit: () => void;
  onLock: () => void;
  onSuggestBeliefs: () => void;
  onSaveMaster: () => void;
  priorDraft: string;
  originalDraft: string;
  audienceDraft: string;
  setPriorDraft: (v: string) => void;
  setOriginalDraft: (v: string) => void;
  setAudienceDraft: (v: string) => void;
  showManualBigThought: boolean;
  setShowManualBigThought: (v: boolean) => void;
  onManualBigThought: (label: string) => Promise<string | null>;
  becauseParent: string;
  shownRowViews: Array<{ id: string; code: string; label: string; statement: string }>;
  notice: string | null;
  auditProgress: unknown;
  generateChecklist: PassChecklist | null;
  onGenerateTerritory: (bigThoughtId: string) => void;
  onEditBigThought: (id: string, statement: string) => void;
  setPendingDelete: (value: PendingDelete | null) => void;
  onFixBigThought: (code: string) => void;
  bigThoughtChecklists: Record<string, { checks: unknown[]; note?: string }>;
  fixingBigThoughtCodes: Set<string>;
};

export type LabWorkspaceGridMapChild = {
  id: string;
  code: string;
  label: string;
  statement: string;
  childCount?: number;
  territories?: unknown[];
};

export type LabWorkspaceGridFocusedThought = {
  id: string;
  statement: string;
  canGenerateTerritory?: boolean;
  territories?: Array<{
    id: string;
    code: string;
    statement: string;
    status: string;
    [key: string]: unknown;
  }>;
};

export type LabWorkspaceGridSharedSlice = {
  t: LabWorkspaceGridTranslate;
  masters: ReturnType<typeof useMasterThought>;
  selected: LabMasterThought | null;
  focus: LabFocus | null;
  locked: boolean;
  showComposer: boolean;
  showBeliefField: boolean;
  skipAutoSelect: MutableRefObject<boolean>;
  setSelectedId: (id: string | null) => void;
  setFocus: Dispatch<SetStateAction<LabFocus | null>>;
  setPendingDelete: (value: PendingDelete | null) => void;
  setEditingMasterId: (id: string | null) => void;
  busy: boolean;
  busyAction: string | null;
  notice: string | null;
  becauseParent: string;
  masterDescription: string;
  masterSubject: string;
  shownRowViews: Array<{ id: string; code: string; label: string; statement: string }>;
  catalogs: ReturnType<typeof useLabCatalogs>;
  contentPillars: ReturnType<typeof useOrgContentPillars>;
  pillarCardsFor: (idea: LabIdea) => ReturnType<typeof lockedPillarCards>;
  angleCardView: (
    row: LabAngle,
    index: number,
  ) => { checklist: AnglePassCheck[]; subject: string; example: string };
  validationForIdea: (row: LabIdea) => IdeaValidation;
};

export type LabWorkspaceGridMapSlice = {
  labTerritories: ReturnType<typeof useLabTerritories>;
  labAngles: ReturnType<typeof useLabAngles>;
  labIdeas: ReturnType<typeof useLabIdeas>;
  labExecutions: ReturnType<typeof useLabExecutions>;
  lockedChildren: Map<string, LabWorkspaceGridMapChild[]>;
  focusedThought: LabWorkspaceGridFocusedThought | null;
  generatingTerritoryIds: ReadonlySet<string>;
  territoryGenerateThoughtId: string | null;
  executionCounts: Record<string, number>;
  onGenerateTerritory: (thoughtId: string) => void;
  setCreativePillarId: (id: string | null) => void;
  setCreativeFormat: (format: CreativeFormat | null) => void;
  admittedTerritories: LabTerritory[];
  angleChecklists: Record<string, { checks: AnglePassCheck[]; note?: string }>;
};

export type LabWorkspaceGridExecutionSlice = {
  focusedExecution: LabExecution | null;
  focusedIdea: LabIdea | null;
  focusedPillarCard: ReturnType<typeof lockedPillarCards>[number] | null;
  executionDraft: VoiceOverScript | null;
  executionProgress: {
    phase: "write" | "audit" | "repair" | "line" | "recommend" | "switch";
    pillarName: string;
    medium?: "image";
  } | null;
  executionPassProposal: {
    executionId: string;
    checks: ExecutionPassCheck[];
    script: VoiceOverScript;
    changes: NarrationChange[];
    previousChecks: ExecutionPassCheck[] | null;
    implemented: boolean;
  } | null;
  executionLineOffer: {
    executionId: string;
    script: VoiceOverScript;
  } | null;
  executionRepairNote: string | null;
  executionRunChecks: ExecutionPassCheck[] | null;
  executionChecklists: Record<string, ExecutionPassCheck[]>;
  fixingLineId: string | null;
  characterGenerate: CharacterGenerateState;
  characterVisualDelete: { handle: string; kind: "portrait" | "body" } | null;
  characterVisualSave: { handle: string; kind: CharacterStudioTab } | null;
  pillarChoices: Array<{ pillarName: string; reason: string }>;
  pathUp: Array<{ label: string; title: string }> | undefined;
  creativeFormat: CreativeFormat | null;
  setScriptTableOpen: (open: boolean) => void;
  pillarHopStopped: (pillarName: string, script: VoiceOverScript | null | undefined, executionId: string) => boolean;
  onAcceptPassProposal: () => void;
  onDeclinePassProposal: () => void;
  onStopExecution: () => void;
  onRepairExecution: () => Promise<void>;
  onFixLine: (lineId: string) => void;
  onRegenerateLine: (lineId: string) => void;
  onRewriteExecution: () => void;
  onRegenerateExecution: () => void;
  onOpenPillarPicker: () => void;
  onUseRecommendation: (pillarName?: string) => void;
  onUseExecutionOffer: () => void;
  onRetrySelling: () => void;
  onToggleExecutionPass: (id: string, enabled: boolean) => void;
  onGenerateCharacter: (handle: string) => void;
  onStoreCharacterVisual: (handle: string, kind: CharacterStudioTab, source: File | { storagePath: string }) => void;
  onDeleteCharacterVisual: (handle: string, kind: "portrait" | "body") => void;
  onOpenExecutionSettings: () => void;
};

export type LabWorkspaceGridInspectorSlice = {
  setRecord: BigThoughtSetRecord | null;
  ideaSet: ReturnType<typeof useIdeaSet>;
  angleSet: ReturnType<typeof useAngleSet>;
  territorySet: ReturnType<typeof useTerritorySet>;
  focusedAngle: LabAngle | null;
  focusedTerritory: LabTerritory | null;
  focusedIdeaPassed: boolean;
  territoryCopy: { area: string; pass?: string; passLead?: string } | null;
  territoriesPanelClosed: boolean;
  territoryChecklists: Record<string, { checks: TerritoryPassCheck[]; note?: string }>;
  territoryVerdicts: ReturnType<typeof territoryVerdict>[];
  territoryStage: ReturnType<typeof selectTerritoryStage>;
  territoryGenerateRun: {
    thoughtId: string;
    checks: TerritoryPassCheck[];
    report: { gate: TerritoryPassCheck["id"]; phase: "checking" | "checked"; outcome: "pass" | "fail" } | null;
  } | null;
  territoryLock: ReturnType<typeof evaluateTerritoryLock>;
  fixingTerritoryCodes: ReadonlySet<string>;
  fixingAngleCodes: ReadonlySet<string>;
  admittedAngles: LabAngle[];
  angleVerdicts: ReturnType<typeof angleVerdict>[];
  angleSetLocked: boolean;
  angleStage: ReturnType<typeof selectAngleStage>;
  angleGenerateRun: {
    territoryId: string;
    checks: AnglePassCheck[];
    report: { gate: AnglePassCheck["id"]; phase: "checking" | "checked"; outcome: "pass" | "fail" } | null;
  } | null;
  angleLock: ReturnType<typeof evaluateAngleLock>;
  angleIdeaRows: LabIdea[];
  ideaRevisionTarget: { nonce: number; decision: "LOLOS" | "DITOLAK" | "BELUM_TERVERIFIKASI" } | null;
  ideaGenerateRun: {
    angleId: string;
    checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
    report: { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" | "unverified" } | null;
  } | null;
  ideaSetLocked: boolean;
  openIdeas: LabIdea[];
  showGenerateIdea: boolean;
  showGenerateAngle: boolean;
  leadMagnetStep: LeadMagnetReviewStep | null;
  creativeReviewReady: boolean;
  creativeReviews: StoredPillarReview[] | null;
  onUnlock: () => Promise<void>;
  onManualIdea: (statement: string) => Promise<string | null>;
  onEditTerritory: (id: string, statement: string) => void;
  onEditAngle: (id: string, statement: string) => void;
  onEditIdea: (id: string, statement: string) => void;
  onGenerateAngle: (territoryId: string) => void;
  onGenerateIdea: (angleId: string) => void;
  onReviseIdea: (id: string) => void;
  onLockIdeas: () => void;
  onAngleStage: () => void;
  onFixAngle: (code: string) => void;
  onLockAngles: () => void;
  onTerritoryStage: () => void;
  onFixTerritory: (code: string) => void;
  onLockTerritories: () => void;
  onReviewCreativePillars: () => void;
  onReviewLeadMagnetPillars: () => void;
  onLockCreativePillar: (contentPillarId: string) => void;
  onLockAllCreativePillars: () => void;
};

/** Typed slices wired from ThinkingLabPage into the main lab grid. */
export type LabWorkspaceGridProps = {
  masterComposer: LabMasterComposerProps;
  masterSavedList: LabMasterSavedListProps;
  masterSection: LabMasterSectionProps;
  shared: LabWorkspaceGridSharedSlice;
  map: LabWorkspaceGridMapSlice;
  execution: LabWorkspaceGridExecutionSlice;
  inspector: LabWorkspaceGridInspectorSlice;
};

export type LabWorkspaceGridBuildInput = LabWorkspaceGridProps;

export function buildLabWorkspaceGridProps(input: LabWorkspaceGridBuildInput): LabWorkspaceGridProps {
  return input;
}