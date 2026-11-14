import type { CreativePathView } from "@/thinking-lab/section/CreativePathPanel";
import type { LabCatalog, MasterCatalogLink } from "@/thinking-lab/master-thought/catalog";

export type InspectorAngle = {
  id: string;
  code: string;
  statement: string;
  subject?: string;
  example?: string;
  relation?: string;
  verdict?: string | null;
  checklist?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
  checklistNote?: string;
  editable?: boolean;
};

export type InspectorTerritory = {
  id: string;
  code: string;
  statement: string;
  detail?: string;
  question?: string;
  link?: string;
  verdict?: string | null;
  checklist?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
  checklistNote?: string;
  canGenerateAngle?: boolean;
  editable?: boolean;
  angles?: InspectorAngle[];
};

export type ManualAdd = {
  label: string;
  onSubmit: (statement: string) => Promise<string | null>;
};

export type LabNodeInspectorProps = {
  kind: "master" | "bigThought" | "territory" | "angle" | "idea";
  code?: string;
  unchecked?: boolean;
  parentChanged?: boolean;
  title?: string;
  statement: string;
  example?: string;
  checks?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
  onFixNode?: () => void;
  fixingNode?: boolean;
  onUnlock?: () => void;
  catalog?: MasterCatalogLink;
  catalogs?: LabCatalog[];
  catalogPending?: boolean;
  onSaveCatalog?: (catalog: MasterCatalogLink) => void;
  onDelete?: () => void;
  unlockDisabled?: boolean;
  onGenerateAngle?: (territoryId: string) => void;
  territoryId?: string;
  angleReady?: boolean;
  onGenerateIdea?: (angleId: string) => void;
  angleId?: string;
  ideaReady?: boolean;
  ideas?: Array<{
    id: string;
    code: string;
    statement: string;
    editable?: boolean;
    verdict?: string | null;
    decision?: "LOLOS" | "DITOLAK" | "BELUM_TERVERIFIKASI";
    listed?: boolean;
    title?: string;
    concept?: string;
    mechanism?: string;
    value?: string;
    canRevise?: boolean;
    checklist?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
    mechanismKeys?: Array<{ otherExplanation: string; close: string }>;
    unchecked?: boolean;
    parentChanged?: boolean;
  }>;
  ideaHistory?: { passed: number; rejected: number; unverified: number; topFailed: string | null } | null;
  ideaRevisionTarget?: { nonce: number; decision: "LOLOS" | "DITOLAK" | "BELUM_TERVERIFIKASI" } | null;
  onReviseIdea?: (id: string) => void;
  onLockIdeas?: () => void;
  onDeleteIdea?: (id: string) => void;
  ideaGenerateChecklist?: {
    checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
    report: { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" | "unverified" } | null;
  } | null;
  angles?: InspectorAngle[];
  angleStage?: "audit" | "lock" | null;
  angleGenerateChecklist?: {
    checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
    report: { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" } | null;
  } | null;
  onAngleStage?: () => void;
  onLockAngles?: () => void;
  onFixAngle?: (code: string) => void;
  onReviseAngle?: (code: string) => void;
  onDeleteAngle?: (id: string) => void;
  fixingAngleCodes?: readonly string[];
  territories?: InspectorTerritory[];
  territoryStage?: "generate" | "audit" | "lock" | null;
  onTerritoryStage?: () => void;
  onFixTerritory?: (code: string) => void;
  onReviseTerritory?: (code: string) => void;
  onDeleteTerritory?: (id: string) => void;
  fixingTerritoryCodes?: readonly string[];
  onLockTerritories?: () => void;
  onGenerateTerritory?: () => void;
  territoryGenerateChecklist?: {
    checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
    report: { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" } | null;
  } | null;
  pendingAction?: string | null;
  notice?: string | null;
  pathUp?: Array<{ label: string; title: string }>;
  territoryArea?: { lead: string; body: string } | null;
  linkSentence?: string | null;
  areaQuestion?: string | null;
  territoryPass?: { lead: string; body: string } | null;
  subject?: string | null;
  subjectNotice?: string | null;
  questionNotes?: string[];
  manualAdd?: ManualAdd | null;
  onEditStatement?: (statement: string) => Promise<string | null>;
  onEditTerritory?: (id: string, statement: string) => Promise<string | null>;
  onEditAngle?: (id: string, statement: string) => Promise<string | null>;
  onEditIdea?: (id: string, statement: string) => Promise<string | null>;
  executionReady?: boolean;
  creativePath?: CreativePathView | null;
  executionProgress?: {
    phase: "write" | "audit" | "repair" | "line" | "recommend" | "switch";
    pillarName: string;
    medium?: "image";
  } | null;
  executionChecklist?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }> | null;
  onStopExecution?: () => void;
};