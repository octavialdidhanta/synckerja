import { useEffect, useState } from "react";
import { Check, ChevronRight, Circle, ClipboardCheck, Loader2, Lock, MoreVertical, Pencil, Sparkles, Trash2, Wrench, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { CreativePathPanel, type CreativePathView } from "@/thinking-lab/section/CreativePathPanel";
import { EditableStatement, ManualStatementForm } from "@/thinking-lab/section/ManualStatementForm";
import { ExecutionPassChecklist } from "@/thinking-lab/section/ExecutionScriptPanel";

type InspectorAngle = {
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

type InspectorTerritory = {
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

type ManualAdd = {
  label: string;
  onSubmit: (statement: string) => Promise<string | null>;
};

export type TerritoryAuditNote =
  | { kind: "overlap"; a: string; b: string; explanation: string }
  | { kind: "containment"; container: string; contained: string; explanation: string }
  | { kind: "notice"; text: string };

type LabNodeInspectorProps = {
  kind: "master" | "bigThought" | "territory" | "angle" | "idea";
  code?: string;
  title?: string;
  statement: string;
  example?: string;
  checks?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
  onFixNode?: () => void;
  fixingNode?: boolean;
  onUnlock?: () => void;
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
    showChecklistPending?: boolean;
    canRevise?: boolean;
    checklist?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
    checklistNote?: string;
    mechanismKeys?: Array<{ otherExplanation: string; close: string }>;
  }>;
  ideaHistory?: { passed: number; rejected: number; unverified: number; topFailed: string | null } | null;
  ideaRevisionTarget?: { nonce: number; decision: "LOLOS" | "DITOLAK" | "BELUM_TERVERIFIKASI" } | null;
  onReviseIdea?: (id: string) => void;
  ideaStage?: "fix" | "audit" | "lock" | null;
  onIdeaStage?: () => void;
  onLockIdeas?: () => void;
  onFixIdea?: (code: string) => void;
  onDeleteIdea?: (id: string) => void;
  fixingIdeaCodes?: readonly string[];
  ideaNotes?: string[];
  ideaFixOffers?: Array<{ failedCode: string; statement: string }>;
  onPickIdeaFixOffer?: (failedCode: string, statement: string) => void;
  ideaGenerateChecklist?: {
    checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
    report: { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" | "unverified" } | null;
  } | null;
  angles?: InspectorAngle[];
  angleStage?: "fix" | "generate" | "audit" | "challenger" | "lock" | null;
  angleGenerateChecklist?: {
    checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
    report: { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" } | null;
  } | null;
  onAngleStage?: () => void;
  onLockAngles?: () => void;
  onFixAngle?: (code: string) => void;
  onDeleteAngle?: (id: string) => void;
  onFixFailedAngles?: () => void;
  fixingAngleCodes?: readonly string[];
  angleNotes?: string[];
  angleFixOffers?: Array<{ failedCode: string; statement: string }>;
  onPickAngleFixOffer?: (failedCode: string, statement: string) => void;
  territories?: InspectorTerritory[];
  territoryStage?: "fix" | "generate" | "audit" | "challenger" | "lock" | null;
  onTerritoryStage?: () => void;
  onFixTerritory?: (code: string) => void;
  onDeleteTerritory?: (id: string) => void;
  fixingTerritoryCodes?: readonly string[];
  onLockTerritories?: () => void;
  onGenerateTerritory?: () => void;
  territoryGenerateChecklist?: {
    checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
    report: { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" } | null;
  } | null;
  onAcceptGap?: () => void;
  onSkipGap?: () => void;
  onRemoveCoveringTerritory?: (code: string) => void;
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
  territoryNotes?: TerritoryAuditNote[];
  territoryFixOffers?: Array<{ failedCode: string; statement: string; detail?: string }>;
  onPickTerritoryFixOffer?: (failedCode: string, statement: string) => void;
  manualAdd?: ManualAdd | null;
  onEditStatement?: (statement: string) => Promise<string | null>;
  onEditTerritory?: (id: string, statement: string) => Promise<string | null>;
  onEditAngle?: (id: string, statement: string) => Promise<string | null>;
  onEditIdea?: (id: string, statement: string) => Promise<string | null>;
  executionReady?: boolean;
  creativePath?: CreativePathView | null;
  executionProgress?: { phase: "write" | "audit" | "repair" | "line" | "recommend" | "switch"; pillarName: string; medium?: "image" } | null;
  executionChecklist?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }> | null;
  onStopExecution?: () => void;
};

const NODE_DEFINITIONS = {
  master: {
    label: "Master Thought",
    body: "Master Thought menetapkan keyakinan tujuan: kita ingin orang percaya bahwa ini benar. Bukan tagline dan bukan klaim produk.",
    note: "Subjeknya harus jelas, karena subjek itu yang nanti diuji sebagai penyebab di Idea. Audiens target belum sepenuhnya memercayainya.",
  },
  bigThought: {
    label: "Big Thought",
    body: "Big Thought memberi alasan: Master Thought benar karena alasan ini. Setiap Big Thought membawa alasan dasar yang berbeda.",
    note: "Kalau alasan ini dicabut, Master Thought kehilangan satu alasan untuk dipercaya. Ia canggung sebagai nama ruang atau sebagai pengamatan.",
  },
  territory: {
    label: "Territory",
    body: "Territory menunjuk ruang. Ia area pembahasan di dunia audiens: fenomena, kebiasaan, momen hidup, budaya, atau masalah sehari-hari, tempat alasan Big Thought bisa dibicarakan. Bentuknya kata benda atau frasa benda, tanpa klaim.",
    note: "Ia bagian dari Big Thought, bukan kata kunci Big Thought. Bahasanya bahasa audiens. Di area itu, pertanyaan yang dijawab Big Thought memang muncul. Areanya cukup luas untuk beberapa Angle.",
  },
  angle: {
    label: "Angle",
    body: "Angle mengangkat pengamatan di dalam Territory: hal yang jarang disadari, kontradiksi, atau ketegangan.",
    note: "Bukan alasan. Kalau kalimatnya masuk mulus ke bentuk karena, ia sedang mengerjakan pekerjaan Big Thought. Pengamatan itu disertai satu contoh situasi yang bisa ditunjuk, tanpa menjadi Idea.",
  },
  idea: {
    label: "Idea",
    body: "Idea merancang mekanisme: konsep konkret yang membuat Angle terjadi, terlihat, atau terbukti, lewat demonstrasi, eksperimen, perbandingan, atau situasi.",
    note: "Bentuknya satu kalimat: kita bikin, ajak, tunjukkan, atau ciptakan sesuatu sehingga Angle terbukti. Kunci mekanisme ditulis terpisah di bawah kalimat. Pillar dipilih nanti.",
  },
} as const;

export function NodeDefinitionInfo({ kind }: { kind: keyof typeof NODE_DEFINITIONS }) {
  const definition = NODE_DEFINITIONS[kind];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-serif italic leading-none opacity-70 hover:opacity-100"
          aria-label={`Definisi ${definition.label}`}
        >
          i
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2 p-3 text-sm leading-relaxed">
        <p>{definition.body}</p>
        <p className="text-muted-foreground">{definition.note}</p>
      </PopoverContent>
    </Popover>
  );
}

function VerdictChip({ verdict, verbatim = false }: { verdict: string; verbatim?: boolean }) {
  const fail = verdict.includes("FAIL");
  const pass = verdict.includes("PASS");
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        pass && "bg-emerald-50 text-emerald-700",
        fail && "bg-red-50 text-red-700",
        !pass && !fail && "bg-muted text-muted-foreground",
      )}
    >
      {verbatim ? verdict : verdict.replace(/^AUDIT_/, "")}
    </span>
  );
}

const PASS_CHECK_LABELS: Record<string, string> = {
  partOfBigThought: "Part of the Big Thought, not a keyword of it",
  audienceLanguage: "Audience language, not an internal term",
  questionArises: "The question the Big Thought answers comes up here",
  wideEnough: "Wide enough for several Angles",
  siblingsDistinct: "Does not overlap a sibling Territory",
};

const ANGLE_PASS_CHECK_LABELS: Record<string, string> = {
  stakeHolds: "Still depends on the Territory, Big Thought, and Master Thought",
  observationShape: "An observation, narrower than the Territory and broader than an Idea",
  severalIdeas: "Enough for several Ideas",
  clearBoundary: "The boundary is clear",
  observationJob: "Not a because-reason and not a restatement of the Territory",
  ownSubject: "A short subject of its own, not the Territory's name",
  livedExample: "A concrete example of the observation",
  siblingsDistinct: "Does not overlap a sibling Angle",
};

const IDEA_PASS_CHECK_LABELS: Record<string, string> = {
  sentenceForm: "Names what is made, invited, shown, or created, then what becomes true",
  stakeHolds: "Still depends on the stake of the Angle and its ancestors",
  mechanismShape: "A mechanism, not an observation, area name, reason, or finished form",
  vehicle: "A comparison, experiment, demonstration, or situation",
  recognizable: "The mechanism is recognizable and its boundary is clear",
  situationFelt: "The reason is felt through the mechanism, not explained in words",
  causeLock: "The keys close the other explanations",
  siblingsDistinct: "Does not overlap a sibling Idea",
  K1: "A specific how-if proposal",
  K2: "A mechanism people already do in ordinary life",
  K3: "The mechanism can produce the stated value",
  K4: "A beneficiary, a need, and a benefit linked to the mechanism",
  K5: "Meaningfully different from passed, rejected, and unverified ideas",
  K6: "Shows the stored Master Thought, Big Thought, and Territory, and how each supports the idea",
  K7: "Fits the stored audience and can be adopted in their current life",
};

function checkRowFailed(
  verdict: string | null | undefined,
  checks?: Array<{ state: string }>,
): boolean {
  return verdict === "AUDIT_FAIL" || (checks ?? []).some((check) => check.state === "fail");
}

function TerritoryPassChecklist({
  checks,
  note,
  labelPrefix = "thinkingLab.territory.pass",
  onFix,
  fixing = false,
  blocked = false,
  showPending = false,
  report = null,
}: {
  checks?: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
  note?: string;
  labelPrefix?: string;
  onFix?: () => void;
  fixing?: boolean;
  blocked?: boolean;
  showPending?: boolean;
  report?: { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" | "unverified" } | null;
}) {
  const { t } = useAppTranslation();
  const labels = labelPrefix.endsWith("idea.pass")
    ? IDEA_PASS_CHECK_LABELS
    : labelPrefix.endsWith("angle.pass")
      ? ANGLE_PASS_CHECK_LABELS
      : PASS_CHECK_LABELS;
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
      {showPending && !report ? <p className="text-sm text-foreground">{t("thinkingLab.bt.pass.notYet", "No requirement has been checked yet.")}</p> : null}
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
                  {fixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Wrench className="h-3.5 w-3.5" />}
                  {t("thinkingLab.action.fix", "Fix")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TerritoryAuditNotes({
  notes,
  failedCodes,
  onRemoveCoveringTerritory,
}: {
  notes: TerritoryAuditNote[];
  failedCodes: Set<string>;
  onRemoveCoveringTerritory?: (code: string) => void;
}) {
  const { t } = useAppTranslation();
  const overlaps = notes.filter((note) => note.kind === "overlap");
  const containments = notes.filter((note) => note.kind === "containment");
  const notices = notes.filter((note) => note.kind === "notice");
  const pairNotes = overlaps.length > 0 || containments.length > 0;
  const removableCodes = [
    ...new Set([
      ...overlaps.flatMap((note) => [note.a.toUpperCase(), note.b.toUpperCase()]),
      ...containments.flatMap((note) => [note.container.toUpperCase(), note.contained.toUpperCase()]),
    ]),
  ]
    .filter((code) => failedCodes.has(code))
    .sort();
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div>
        <p className="text-sm font-medium">{t("thinkingLab.territory.failReason.title", "Why these Territories failed")}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {onRemoveCoveringTerritory
            ? t(
                "thinkingLab.territory.removeCoverHint",
                "Fix already ran. Remove one failed Territory from this conflict. The next step appears after it is gone.",
              )
            : t(
                "thinkingLab.territory.failReason.purpose",
                "Sibling audit found conflicts between Territories. Fix uses these notes when rewriting a Territory marked AUDIT_FAIL.",
              )}
        </p>
      </div>
      {pairNotes ? (
        <div
          className="rounded-md border border-border px-3"
          role="region"
          aria-label={t("thinkingLab.territory.failReason.title", "Why these Territories failed")}
        >
          <div className="space-y-3">
            {overlaps.length > 0 ? (
              <div>
                <p className="text-sm font-medium">{t("thinkingLab.territory.failReason.overlap", "Overlap")}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {t("thinkingLab.territory.failReason.overlapHint", "These two Territories would host the same angles.")}
                </p>
                <ul className="divide-y divide-border">
                  {overlaps.map((note) => (
                    <li key={`${note.a}-${note.b}-${note.explanation}`} className="py-2.5">
                      <p className="text-sm font-medium">
                        {note.a} · {note.b}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">{note.explanation}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {containments.length > 0 ? (
              <div>
                <p className="text-sm font-medium">
                  {t("thinkingLab.territory.failReason.containment", "One space covers another")}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {t(
                    "thinkingLab.territory.failReason.containmentHint",
                    "The first Territory already includes the space of the second.",
                  )}
                </p>
                <ul className="divide-y divide-border">
                  {containments.map((note) => (
                    <li key={`${note.container}-${note.contained}-${note.explanation}`} className="py-2.5">
                      <p className="text-sm font-medium">
                        {t("thinkingLab.territory.failReason.covers", "{{container}} covers {{contained}}", {
                          container: note.container,
                          contained: note.contained,
                        })}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">{note.explanation}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {onRemoveCoveringTerritory && removableCodes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {removableCodes.map((code) => (
            <Button
              key={code}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRemoveCoveringTerritory(code)}
            >
              {t("thinkingLab.territory.removeCover", "Remove {{code}}", { code })}
            </Button>
          ))}
        </div>
      ) : null}
      {notices.length > 0 ? (
        <ul className="space-y-1">
          {notices.map((note) => (
            <li key={note.text} className="text-sm text-muted-foreground">
              {note.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ideaNotesForCode(notes: string[], code: string): string[] {
  const token = code.trim().toUpperCase();
  return notes.flatMap((note) => {
    const pair = note.match(/^([A-Za-z0-9]+)\s·\s([A-Za-z0-9]+):\s*([\s\S]+)$/);
    if (pair) {
      const left = pair[1].toUpperCase();
      const right = pair[2].toUpperCase();
      if (left !== token && right !== token) return [];
      const other = left === token ? pair[2] : pair[1];
      return [`${other}: ${pair[3]}`];
    }
    const single = note.match(/^([A-Za-z0-9]+):\s*([\s\S]+)$/);
    if (single && single[1].toUpperCase() === token) return [single[2]];
    return [];
  });
}

function uncodedNotes(notes: string[]): string[] {
  return notes.filter((note) => !/^([A-Za-z0-9]+)(\s·\s[A-Za-z0-9]+)?:/.test(note));
}

function angleNotesLeftOutside(notes: string[], angles: Array<{ code: string; verdict?: string | null }>): string[] {
  const failCodes = angles.filter((angle) => angle.verdict === "AUDIT_FAIL").map((angle) => angle.code);
  const kept = failCodes.length > 0 ? notes.filter((note) => !uncodedNotes([note]).includes(note)) : notes;
  return ideaNotesWithoutCard(kept, failCodes);
}

function ideaNotesWithoutCard(notes: string[], codes: string[]): string[] {
  const known = new Set(codes.map((code) => code.trim().toUpperCase()));
  return notes.filter((note) => {
    const pair = note.match(/^([A-Za-z0-9]+)\s·\s([A-Za-z0-9]+):/);
    if (pair) return !known.has(pair[1].toUpperCase()) && !known.has(pair[2].toUpperCase());
    const single = note.match(/^([A-Za-z0-9]+):/);
    if (single) return !known.has(single[1].toUpperCase());
    return true;
  });
}

export function LabNodeInspector({
  kind,
  code,
  title,
  statement,
  example,
  checks,
  onFixNode,
  fixingNode = false,
  onUnlock,
  onDelete,
  unlockDisabled,
  onGenerateAngle,
  territoryId,
  angleReady = false,
  onGenerateIdea,
  angleId,
  ideaReady = false,
  ideas,
  ideaHistory = null,
  ideaRevisionTarget = null,
  onReviseIdea,
  ideaStage = null,
  onIdeaStage,
  onLockIdeas,
  onFixIdea,
  onDeleteIdea,
  fixingIdeaCodes,
  ideaNotes,
  ideaFixOffers,
  onPickIdeaFixOffer,
  ideaGenerateChecklist = null,
  angles,
  angleStage = null,
  angleGenerateChecklist = null,
  onAngleStage,
  onLockAngles,
  onFixAngle,
  onDeleteAngle,
  onFixFailedAngles,
  fixingAngleCodes,
  angleNotes,
  angleFixOffers,
  onPickAngleFixOffer,
  territories,
  territoryStage,
  onTerritoryStage,
  onFixTerritory,
  onDeleteTerritory,
  fixingTerritoryCodes,
  onLockTerritories,
  onGenerateTerritory,
  territoryGenerateChecklist = null,
  onAcceptGap,
  onSkipGap,
  onRemoveCoveringTerritory,
  pendingAction = null,
  notice,
  pathUp,
  territoryArea = null,
  linkSentence = null,
  areaQuestion = null,
  territoryPass = null,
  subject,
  subjectNotice,
  questionNotes,
  territoryNotes,
  territoryFixOffers,
  onPickTerritoryFixOffer,
  manualAdd = null,
  onEditStatement,
  onEditTerritory,
  onEditAngle,
  onEditIdea,
  executionReady = false,
  creativePath = null,
  executionProgress = null,
  executionChecklist = null,
  onStopExecution,
}: LabNodeInspectorProps) {
  const { t } = useAppTranslation();
  const childGenerateRunning =
    pendingAction === "generate" ||
    pendingAction === "generate-territory" ||
    pendingAction === "generate-angle" ||
    pendingAction === "generate-idea";
  const manualRunning = pendingAction?.startsWith("manual-") ?? false;
  const [territoryEditToken, setTerritoryEditToken] = useState<Record<string, number>>({});
  const [angleEditToken, setAngleEditToken] = useState<Record<string, number>>({});
  const [ideaEditToken, setIdeaEditToken] = useState<Record<string, number>>({});
  const [ideaListFilter, setIdeaListFilter] = useState<"LOLOS" | "DITOLAK">("LOLOS");
  const [openIdeaNotes, setOpenIdeaNotes] = useState<Record<string, boolean>>({});
  const [openAngleNotes, setOpenAngleNotes] = useState<Record<string, boolean>>({});
  const [showWriteIdea, setShowWriteIdea] = useState(false);
  const [statementEditToken, setStatementEditToken] = useState(0);
  useEffect(() => {
    setShowWriteIdea(false);
    setStatementEditToken(0);
    setIdeaListFilter("LOLOS");
  }, [angleId, territoryId, kind]);
  useEffect(() => {
    if (!ideaRevisionTarget) return;
    setIdeaListFilter(ideaRevisionTarget.decision === "LOLOS" ? "LOLOS" : "DITOLAK");
  }, [ideaRevisionTarget]);
  const ideaFilterEnabled = (ideas ?? []).some((idea) => idea.decision);
  const shownIdeas = (ideas ?? []).filter((idea) => {
    if (!ideaFilterEnabled) return true;
    if (ideaListFilter === "LOLOS") return idea.decision === "LOLOS" && idea.listed !== false;
    return idea.decision === "DITOLAK" || idea.decision === "BELUM_TERVERIFIKASI";
  });
  const showWriteIdeaAction = Boolean(kind === "angle" && manualAdd && !childGenerateRunning);
  const showGenerateIdeaAction = Boolean(kind === "angle" && ideaReady && onGenerateIdea && angleId && !manualRunning);
  const showIdeaStageAction = Boolean(
    kind === "angle" && ideaStage && onIdeaStage && !(ideaStage === "fix" && onFixIdea),
  );
  const ideaActionLabel =
    ideaStage === "audit"
      ? t("thinkingLab.action.audit", "Audit")
      : ideaStage === "fix"
        ? t("thinkingLab.action.fix", "Fix")
        : t("thinkingLab.action.lock", "Lock");
  const showAngleMenu =
    showWriteIdeaAction || showGenerateIdeaAction || Boolean(kind === "angle" && (onLockIdeas || onDelete));
  const showTerritoryStageAction = Boolean(
    kind === "bigThought" &&
      (territories?.length ?? 0) > 0 &&
      territoryStage &&
      territoryStage !== "lock" &&
      territoryStage !== "generate" &&
      onTerritoryStage &&
      !(territoryStage === "fix" && onFixTerritory),
  );
  const showTerritoryGenerateAction = Boolean(kind === "bigThought" && onGenerateTerritory);
  const territoryActionLabel =
    territoryStage === "audit"
      ? t("thinkingLab.action.audit", "Audit")
      : territoryStage === "challenger"
        ? t("thinkingLab.action.challenger", "Challenger")
        : territoryStage === "fix"
          ? t("thinkingLab.action.fix", "Fix")
          : territoryStage === "generate"
            ? t("thinkingLab.territory.generate", "Generate Territory")
            : t("thinkingLab.action.lock", "Lock");
  const showAngleStageMenu = Boolean(
    kind === "territory" &&
      angleStage &&
      onAngleStage &&
      pendingAction !== "generate-angle" &&
      !(angleStage === "generate" && manualRunning) &&
      !(angleStage === "fix" && onFixAngle),
  );
  const angleActionLabel =
    angleStage === "audit"
      ? t("thinkingLab.action.audit", "Audit")
      : angleStage === "challenger"
        ? t("thinkingLab.action.challenger", "Challenger")
        : angleStage === "fix"
          ? t("thinkingLab.action.fix", "Fix")
          : angleStage === "generate"
            ? t("thinkingLab.angle.generate", "Generate Angle")
            : t("thinkingLab.action.lock", "Lock");
  const showThoughtMenu = Boolean(
    kind === "bigThought" && (showTerritoryStageAction || showTerritoryGenerateAction || onLockTerritories || onDelete),
  );
  const label =
    kind === "master"
      ? t("thinkingLab.tree.masterThought", "Master Thought")
      : kind === "idea"
        ? t("thinkingLab.idea.list", "Idea")
        : kind === "angle"
        ? t("thinkingLab.tree.angle", "Angle")
        : kind === "territory"
          ? t("thinkingLab.tree.territory", "Territory")
      : t("thinkingLab.tree.bigThought", "Big Thought");
  const heading = (title?.trim() || (kind === "master" && subject?.trim()) || statement).trim();
  const detail = statement.trim() !== heading ? statement.trim() : "";
  const showTerritoryGenerate = Boolean(
    kind === "territory" &&
      angleReady &&
      onGenerateAngle &&
      territoryId &&
      !manualRunning &&
      pendingAction !== "audit" &&
      !(angleStage === "audit" && pendingAction !== "generate-angle"),
  );
  const showFixFailedAngles = Boolean(
    kind === "territory" && onFixFailedAngles && (angles ?? []).some((angle) => angle.verdict === "AUDIT_FAIL"),
  );
  const showIdeaHeaderMenu = Boolean(kind === "idea" && onDelete);
  const showTerritoryMenu = Boolean(
    kind === "territory" &&
      (showTerritoryGenerate || onEditStatement || onDelete || showAngleStageMenu || onLockAngles || showFixFailedAngles),
  );
  const pathBlock =
    pathUp && pathUp.length > 0 ? (
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("thinkingLab.tree.pathUp", "Path up")}</p>
        <ul className="space-y-2">
          {pathUp.map((item) => (
            <li key={`${item.label}-${item.title}`} className="border-l-2 border-border pl-2">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm text-foreground">{item.title}</p>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-start justify-between gap-3">
        <header className="min-w-0 flex-1 space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#1e4a86]">
            <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] bg-[#1e4a86]" aria-hidden />
            <span>{code?.trim() ? `${label} - ${code.trim()}` : label}</span>
            <NodeDefinitionInfo kind={kind} />
          </p>
          {onEditStatement && !title && kind !== "territory" ? (
            <EditableStatement statement={statement} enabled pending={Boolean(pendingAction)} onSave={onEditStatement} />
          ) : (
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">{heading}</h2>
          )}
          {kind === "territory" && linkSentence ? (
            <p className="text-[15px] leading-relaxed text-slate-600">{linkSentence}</p>
          ) : null}
          {kind === "territory" && areaQuestion ? (
            <p className="text-[15px] leading-relaxed text-slate-800">{areaQuestion}</p>
          ) : null}
          {kind !== "territory" && detail ? <p className="text-[15px] leading-relaxed text-slate-600">{detail}</p> : null}
          {kind === "angle" && example?.trim() ? (
            <p className="text-[15px] leading-relaxed text-slate-800">
              <span className="font-medium">{t("thinkingLab.angle.example", "Example")}. </span>
              {example.trim()}
            </p>
          ) : null}
          {kind === "angle" && checks ? (
            <TerritoryPassChecklist
              checks={checks}
              labelPrefix="thinkingLab.angle.pass"
              onFix={onFixNode}
              fixing={fixingNode}
              blocked={Boolean(pendingAction) && !fixingNode}
            />
          ) : null}
          {onEditStatement && title ? (
            <EditableStatement
              buttonOnly={Boolean(detail)}
              statement={statement}
              enabled
              pending={Boolean(pendingAction)}
              onSave={onEditStatement}
            />
          ) : null}
          {kind === "master" && subjectNotice ? <p className="text-sm text-muted-foreground">{subjectNotice}</p> : null}
        </header>
        {showThoughtMenu ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={t("thinkingLab.action.more", "More actions")}
                aria-busy={
                  pendingAction === "generate-territory" ||
                  (Boolean(pendingAction) && pendingAction === territoryStage)
                    ? true
                    : undefined
                }
              >
                {pendingAction === "generate-territory" ||
                (Boolean(pendingAction) && pendingAction === territoryStage) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              {showTerritoryGenerateAction ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "generate-territory"}
                  onSelect={() => onGenerateTerritory?.()}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("thinkingLab.territory.generate", "Generate Territory")}
                </DropdownMenuItem>
              ) : null}
              {showTerritoryStageAction ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === territoryStage || pendingAction === "generate-territory"}
                  onSelect={() => onTerritoryStage?.()}
                >
                  {territoryStage === "generate" ? <Sparkles className="h-3.5 w-3.5" /> : null}
                  {territoryStage === "audit" ? <ClipboardCheck className="h-3.5 w-3.5" /> : null}
                  {territoryStage === "fix" ? <Wrench className="h-3.5 w-3.5" /> : null}
                  {territoryActionLabel}
                </DropdownMenuItem>
              ) : null}
              {onLockTerritories ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "lock"}
                  onSelect={() => onLockTerritories()}
                >
                  <Lock className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.lock", "Lock")}
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  disabled={Boolean(pendingAction)}
                  onSelect={() => onDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.delete", "Delete")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : showAngleMenu ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={t("thinkingLab.action.more", "More actions")}
                aria-busy={pendingAction === "generate-idea" ? true : undefined}
              >
                {pendingAction === "generate-idea" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              {showWriteIdeaAction && manualAdd ? (
                <DropdownMenuItem className="cursor-pointer" onSelect={() => setShowWriteIdea(true)}>
                  {manualAdd.label}
                </DropdownMenuItem>
              ) : null}
              {showGenerateIdeaAction && onGenerateIdea && angleId ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "generate-idea"}
                  onSelect={() => onGenerateIdea(angleId)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("thinkingLab.idea.generate", "Generate Idea")}
                </DropdownMenuItem>
              ) : null}
              {onLockIdeas ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "lock"}
                  onSelect={() => onLockIdeas()}
                >
                  <Lock className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.lock", "Lock")}
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  disabled={Boolean(pendingAction)}
                  onSelect={() => onDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.delete", "Delete")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : showTerritoryMenu ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={t("thinkingLab.action.more", "More actions")}
                aria-busy={
                  pendingAction === "generate-angle" ||
                  pendingAction === "fix-angles" ||
                  (angleStage === "audit" && pendingAction === "audit")
                    ? true
                    : undefined
                }
              >
                {pendingAction === "generate-angle" ||
                pendingAction === "fix-angles" ||
                (angleStage === "audit" && pendingAction === "audit") ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              {showTerritoryGenerate && onGenerateAngle && territoryId ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "generate-angle"}
                  onSelect={() => onGenerateAngle(territoryId)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("thinkingLab.angle.generate", "Generate Angle")}
                </DropdownMenuItem>
              ) : null}
              {showAngleStageMenu && onAngleStage ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === angleStage}
                  onSelect={() => onAngleStage()}
                >
                  {angleStage === "generate" ? <Sparkles className="h-3.5 w-3.5" /> : null}
                  {angleStage === "audit" ? <ClipboardCheck className="h-3.5 w-3.5" /> : null}
                  {angleStage === "fix" ? <Wrench className="h-3.5 w-3.5" /> : null}
                  {angleStage === "lock" ? <Lock className="h-3.5 w-3.5" /> : null}
                  {angleActionLabel}
                </DropdownMenuItem>
              ) : null}
              {onLockAngles && angleStage !== "lock" && angleStage !== "challenger" ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "lock"}
                  onSelect={() => onLockAngles()}
                >
                  <Lock className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.lock", "Lock")}
                </DropdownMenuItem>
              ) : null}
              {showFixFailedAngles ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "fix-angles"}
                  onSelect={() => onFixFailedAngles?.()}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.fix", "Fix")}
                </DropdownMenuItem>
              ) : null}
              {onEditStatement ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  onSelect={() => setStatementEditToken((current) => current + 1)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("thinkingLab.manual.edit", "Edit")}
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  disabled={Boolean(pendingAction)}
                  onSelect={() => onDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.delete", "Hapus")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : showIdeaHeaderMenu ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={t("thinkingLab.action.more", "More actions")}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                disabled={Boolean(pendingAction)}
                onSelect={() => onDelete?.()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("thinkingLab.action.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {kind === "territory" && (territoryArea?.body || territoryPass?.body) ? (
        <div className="space-y-2">
          {territoryArea?.body ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-foreground">
              {territoryArea.lead ? <span className="font-semibold">{territoryArea.lead} </span> : null}
              {territoryArea.body}
            </p>
          ) : null}
          {territoryPass?.body ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-foreground">
              <span className="font-semibold">{territoryPass.lead}</span> {territoryPass.body}
            </p>
          ) : null}
        </div>
      ) : null}
      {kind === "territory" && onEditStatement && statementEditToken > 0 ? (
        <EditableStatement
          statement={statement}
          enabled
          showButton={false}
          editToken={statementEditToken}
          pending={Boolean(pendingAction)}
          onSave={onEditStatement}
        />
      ) : null}
      {kind === "territory" ? null : pathBlock}
      {onUnlock ? (
        <Button type="button" variant="outline" size="sm" onClick={onUnlock} disabled={unlockDisabled} aria-busy={unlockDisabled}>
          {unlockDisabled ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("thinkingLab.action.unlock", "Unlock")}
        </Button>
      ) : null}
      {kind === "idea" && executionReady && executionProgress ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {executionProgress.phase === "write"
              ? executionProgress.medium === "image"
                ? t("thinkingLab.execution.writingSlides", "Writing the slides for {{pillar}}...", {
                    pillar: executionProgress.pillarName,
                  })
                : t("thinkingLab.execution.writing", "Writing the voice-over script for {{pillar}}...", {
                    pillar: executionProgress.pillarName,
                  })
              : executionProgress.phase === "repair"
                ? t("thinkingLab.execution.repairing", "Repairing only the failing lines...")
                : executionProgress.phase === "line"
                  ? t("thinkingLab.execution.rewritingLine", "Rewriting this line so the requirements that are switched on still pass...")
                  : executionProgress.phase === "switch"
                    ? t("thinkingLab.execution.rewritingSwitch", "Rewriting the lines for this requirement...")
                  : executionProgress.phase === "recommend"
                    ? t("thinkingLab.execution.recommending", "Looking for a pillar that can carry this Idea...")
                    : t("thinkingLab.execution.auditing", "Tracing the script path up to the Master Thought...")}
          </p>
          {onStopExecution ? (
            <Button type="button" size="sm" variant="outline" onClick={onStopExecution}>
              {t("thinkingLab.execution.stop", "Stop")}
            </Button>
          ) : null}
          {executionChecklist && executionChecklist.length > 0 ? <ExecutionPassChecklist checks={executionChecklist} /> : null}
        </div>
      ) : null}
      {kind === "idea" && executionReady && creativePath ? <CreativePathPanel path={creativePath} pendingAction={pendingAction} /> : null}
      {kind === "angle" && showWriteIdea && manualAdd && !childGenerateRunning ? (
        <ManualStatementForm
          label={manualAdd.label}
          submitLabel={t("thinkingLab.manual.save", "Save")}
          pending={manualRunning}
          onSubmit={async (statement) => {
            const reason = await manualAdd.onSubmit(statement);
            if (!reason) setShowWriteIdea(false);
            return reason;
          }}
        />
      ) : null}
      {kind === "angle" && ideaGenerateChecklist ? (
        <TerritoryPassChecklist checks={ideaGenerateChecklist.checks} report={ideaGenerateChecklist.report} labelPrefix="thinkingLab.idea.pass" />
      ) : null}
      {kind === "angle" && ideas && ideas.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("thinkingLab.idea.list", "Ideas")}</p>
            {showIdeaStageAction ? (
              <Button
                type="button"
                size="sm"
                onClick={onIdeaStage}
                disabled={Boolean(pendingAction)}
                aria-busy={pendingAction === ideaStage}
              >
                {pendingAction === ideaStage ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {ideaActionLabel}
              </Button>
            ) : null}
          </div>
          {ideaFilterEnabled ? (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-1" role="group" aria-label={t("thinkingLab.idea.filter.label", "Idea history")}>
                {(
                  [
                    ["LOLOS", "thinkingLab.idea.filter.passed", "Passed", ideaHistory?.passed],
                    [
                      "DITOLAK",
                      "thinkingLab.idea.filter.rejected",
                      "Rejected",
                      ideaHistory ? ideaHistory.rejected + ideaHistory.unverified : undefined,
                    ],
                  ] as const
                ).map(([id, key, fallback, count]) => (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant={ideaListFilter === id ? "default" : "outline"}
                    aria-pressed={ideaListFilter === id}
                    onClick={() => setIdeaListFilter(id)}
                  >
                    {t(key, fallback)}
                    {typeof count === "number" ? ` ${count}` : ""}
                  </Button>
                ))}
              </div>
              {ideaHistory ? (
                <p className="text-xs text-muted-foreground">
                  {t(
                    "thinkingLab.idea.historySummary",
                    "{{passed}} passed · {{rejected}} rejected · most often failed: {{criterion}}",
                    {
                      passed: ideaHistory.passed,
                      rejected: ideaHistory.rejected + ideaHistory.unverified,
                      criterion: ideaHistory.topFailed ?? t("thinkingLab.idea.historyNone", "none"),
                    },
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
          {shownIdeas.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("thinkingLab.idea.filter.empty", "No idea is in this list.")}</p>
          ) : null}
          <ul className="space-y-2">
            {shownIdeas.map((idea) => {
              const ideaFixing =
                (fixingIdeaCodes ?? []).some((code) => code.toUpperCase() === idea.code.toUpperCase()) ||
                pendingAction === `fix-idea:${idea.code}`;
              const otherWorkRunning = Boolean(pendingAction) && !pendingAction.startsWith("fix-idea:");
              const ideaNeedsFix =
                !idea.decision &&
                (idea.verdict?.includes("FAIL") ||
                  idea.verdict === "UNRESOLVED" ||
                  (idea.checklist ?? []).some((check) => check.state === "fail"));
              const showIdeaMenu =
                Boolean(idea.editable && onEditIdea) ||
                (ideaNeedsFix && Boolean(onFixIdea)) ||
                Boolean(onDeleteIdea);
              const cardNotes = ideaNotesForCode(ideaNotes ?? [], idea.code);
              return (
              <li key={idea.id} className="rounded-lg border border-border bg-background px-3 py-3">
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{idea.code}</span>
                  {idea.verdict ? <VerdictChip verdict={idea.verdict} verbatim /> : null}
                  {showIdeaMenu ? (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="ml-auto h-6 w-6 shrink-0 text-muted-foreground"
                          aria-label={`${t("thinkingLab.action.more", "More actions")} ${idea.code}`}
                          aria-busy={ideaFixing || undefined}
                          disabled={ideaFixing || otherWorkRunning}
                        >
                          {ideaFixing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <MoreVertical className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[11rem]">
                        {idea.editable && onEditIdea ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            disabled={ideaFixing || otherWorkRunning}
                            onSelect={() =>
                              setIdeaEditToken((current) => ({
                                ...current,
                                [idea.id]: (current[idea.id] ?? 0) + 1,
                              }))
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t("thinkingLab.manual.edit", "Edit")}
                          </DropdownMenuItem>
                        ) : null}
                        {ideaNeedsFix && onFixIdea ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            disabled={ideaFixing || otherWorkRunning}
                            aria-busy={ideaFixing}
                            onSelect={() => onFixIdea(idea.code)}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            {t("thinkingLab.action.fix", "Fix")}
                          </DropdownMenuItem>
                        ) : null}
                        {onDeleteIdea ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                            disabled={ideaFixing || otherWorkRunning}
                            onSelect={() => onDeleteIdea(idea.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("thinkingLab.action.deleteIdea", "Delete Idea")}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
                <div className="space-y-3 [&_p]:leading-relaxed">
                <EditableStatement
                  compact
                  showButton={false}
                  editToken={ideaEditToken[idea.id] ?? 0}
                  statement={idea.statement}
                  enabled={Boolean(idea.editable && onEditIdea)}
                  pending={Boolean(pendingAction)}
                  onSave={(next) => onEditIdea?.(idea.id, next) ?? Promise.resolve(null)}
                />
                {idea.title && idea.title !== idea.statement ? <p className="text-sm font-medium text-foreground">{idea.title}</p> : null}
                {idea.concept ? (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">{t("thinkingLab.idea.concept", "Concept")}: </span>
                    {idea.concept}
                  </p>
                ) : null}
                {idea.mechanism ? (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">{t("thinkingLab.idea.mechanism", "Mechanism")}: </span>
                    {idea.mechanism}
                  </p>
                ) : null}
                {idea.value ? (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">{t("thinkingLab.idea.value", "Value")}: </span>
                    {idea.value}
                  </p>
                ) : null}
                {idea.decision && idea.decision !== "LOLOS" ? (
                  <p className="text-xs text-muted-foreground">
                    {t(`thinkingLab.idea.decision.${idea.decision}`, idea.decision === "DITOLAK" ? "Rejected" : "Not verified yet")}
                  </p>
                ) : null}
                <TerritoryPassChecklist
                  checks={idea.checklist}
                  note={idea.checklistNote}
                  labelPrefix="thinkingLab.idea.pass"
                  showPending={idea.showChecklistPending}
                  onFix={ideaNeedsFix && onFixIdea ? () => onFixIdea(idea.code) : undefined}
                  fixing={ideaFixing}
                  blocked={otherWorkRunning}
                />
                {idea.canRevise && onReviseIdea ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 gap-1.5"
                    disabled={Boolean(pendingAction)}
                    aria-busy={pendingAction === "revise-idea" || undefined}
                    onClick={() => onReviseIdea(idea.id)}
                  >
                    {pendingAction === "revise-idea" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    {t("thinkingLab.idea.revise", "Revise")}
                  </Button>
                ) : null}
                {(idea.decision === "DITOLAK" || idea.decision === "BELUM_TERVERIFIKASI") && idea.canRevise === false ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("thinkingLab.idea.revisionClosed", "This idea stays rejected. It has already been revised three times.")}
                  </p>
                ) : null}
                {idea.mechanismKeys && idea.mechanismKeys.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                      {t("thinkingLab.idea.keys", "Keys")}
                    </p>
                    {idea.mechanismKeys.map((key, index) => (
                      <p key={`${idea.id}-key-${index}`} className="text-sm leading-relaxed text-muted-foreground">
                        {key.otherExplanation}. {key.close}
                      </p>
                    ))}
                  </div>
                ) : null}
                {cardNotes.length > 0 ? (
                  ideaNeedsFix ? (
                    <div className="mt-2 space-y-1">
                      {cardNotes.map((note) => (
                        <p key={note} className="text-sm leading-relaxed text-muted-foreground">
                          {note}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
                        aria-expanded={Boolean(openIdeaNotes[idea.id])}
                        aria-label={`${t("thinkingLab.idea.note", "Note")} ${idea.code}`}
                        onClick={() =>
                          setOpenIdeaNotes((current) => ({ ...current, [idea.id]: !current[idea.id] }))
                        }
                      >
                        <ChevronRight
                          className={cn("h-3.5 w-3.5 transition-transform", openIdeaNotes[idea.id] && "rotate-90")}
                          aria-hidden
                        />
                        {t("thinkingLab.idea.note", "Note")}
                      </button>
                      {openIdeaNotes[idea.id] ? (
                        <div className="mt-1 space-y-1 pl-5">
                          {cardNotes.map((note) => (
                            <p key={note} className="text-sm leading-relaxed text-muted-foreground">
                              {note}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                ) : null}
                {onPickIdeaFixOffer
                  ? (ideaFixOffers ?? [])
                      .filter((offer) => offer.failedCode.toUpperCase() === idea.code.toUpperCase())
                      .map((offer) => (
                        <div key={offer.statement} className="mt-2 rounded-md border border-border p-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("thinkingLab.idea.fixOffer", "Recommended repair · AUDIT_PASS")}
                          </p>
                          <p className="mt-1 text-sm text-foreground">{offer.statement}</p>
                          <Button
                            type="button"
                            size="sm"
                            className="mt-2"
                            disabled={Boolean(pendingAction)}
                            onClick={() => onPickIdeaFixOffer(idea.code, offer.statement)}
                          >
                            {pendingAction === "pick-idea-fix" ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : null}
                            {t("thinkingLab.fix.pick", "Use this repair")}
                          </Button>
                        </div>
                      ))
                  : null}
                </div>
              </li>
              );
            })}
          </ul>
          {ideaNotesWithoutCard(ideaNotes ?? [], (ideas ?? []).map((idea) => idea.code)).length > 0 ? (
            <ul className="space-y-1 pt-2">
              {ideaNotesWithoutCard(ideaNotes ?? [], (ideas ?? []).map((idea) => idea.code)).map((note) => (
                <li key={note} className="text-sm text-muted-foreground">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {kind === "territory" && angleGenerateChecklist ? (
        <TerritoryPassChecklist checks={angleGenerateChecklist.checks} report={angleGenerateChecklist.report} labelPrefix="thinkingLab.angle.pass" showPending />
      ) : null}
      {kind === "territory" && angles && angles.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("thinkingLab.angle.list", "Angles")}</p>
          <ul className="space-y-2">
            {angles.map((angle) => {
              const angleFixing =
                (fixingAngleCodes ?? []).some((code) => code.toUpperCase() === angle.code.toUpperCase()) ||
                pendingAction === `fix-angle:${angle.code}`;
              const otherWorkRunning = Boolean(pendingAction) && !pendingAction.startsWith("fix-angle:");
              const angleNeedsFix = checkRowFailed(angle.verdict, angle.checklist);
              const showAngleMenu =
                Boolean(angle.editable && onEditAngle) ||
                (angleNeedsFix && Boolean(onFixAngle)) ||
                (angle.verdict === "AUDIT_PASS" && Boolean(onGenerateIdea)) ||
                Boolean(onDeleteAngle);
              return (
              <li key={angle.id} className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{angle.code}</span>
                  {angle.verdict ? <VerdictChip verdict={angle.verdict} verbatim /> : null}
                  {showAngleMenu ? (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="ml-auto h-6 w-6 shrink-0 text-muted-foreground"
                          aria-label={`${t("thinkingLab.action.more", "More actions")} ${angle.code}`}
                          aria-busy={angleFixing || undefined}
                          disabled={angleFixing || otherWorkRunning}
                        >
                          {angleFixing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <MoreVertical className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[11rem]">
                        {angle.editable && onEditAngle ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            disabled={angleFixing || otherWorkRunning}
                            onSelect={() =>
                              setAngleEditToken((current) => ({
                                ...current,
                                [angle.id]: (current[angle.id] ?? 0) + 1,
                              }))
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t("thinkingLab.manual.edit", "Edit")}
                          </DropdownMenuItem>
                        ) : null}
                        {angleNeedsFix && onFixAngle ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            disabled={angleFixing || otherWorkRunning}
                            aria-busy={angleFixing}
                            onSelect={() => onFixAngle(angle.code)}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            {t("thinkingLab.action.fix", "Fix")}
                          </DropdownMenuItem>
                        ) : null}
                        {angle.verdict === "AUDIT_PASS" && onGenerateIdea ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            disabled={Boolean(pendingAction)}
                            aria-busy={pendingAction === "generate-idea"}
                            onSelect={() => onGenerateIdea(angle.id)}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            {t("thinkingLab.idea.generate", "Generate Idea")}
                          </DropdownMenuItem>
                        ) : null}
                        {onDeleteAngle ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                            disabled={angleFixing || otherWorkRunning}
                            onSelect={() => onDeleteAngle(angle.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("thinkingLab.action.deleteAngle", "Delete Angle")}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
                {angle.subject ? <p className="text-sm font-medium text-foreground">{angle.subject}</p> : null}
                <EditableStatement
                  compact
                  showButton={false}
                  editToken={angleEditToken[angle.id] ?? 0}
                  statement={angle.statement}
                  enabled={Boolean(angle.editable && onEditAngle)}
                  pending={Boolean(pendingAction)}
                  onSave={(next) => onEditAngle?.(angle.id, next) ?? Promise.resolve(null)}
                />
                {angle.example?.trim() ? (
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    <span className="font-medium text-slate-700">{t("thinkingLab.angle.example", "Example")}. </span>
                    {angle.example.trim()}
                  </p>
                ) : null}
                <TerritoryPassChecklist
                  checks={angle.checklist}
                  note={angle.checklistNote}
                  labelPrefix="thinkingLab.angle.pass"
                  onFix={angleNeedsFix && onFixAngle ? () => onFixAngle(angle.code) : undefined}
                  fixing={angleFixing}
                  blocked={otherWorkRunning}
                />
                {angle.verdict === "AUDIT_FAIL" &&
                [...ideaNotesForCode(angleNotes ?? [], angle.code), ...uncodedNotes(angleNotes ?? [])].length > 0 ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
                      aria-expanded={Boolean(openAngleNotes[angle.id])}
                      aria-label={`${t("thinkingLab.angle.note", "Note")} ${angle.code}`}
                      onClick={() =>
                        setOpenAngleNotes((current) => ({ ...current, [angle.id]: !current[angle.id] }))
                      }
                    >
                      <ChevronRight
                        className={cn("h-3.5 w-3.5 transition-transform", openAngleNotes[angle.id] && "rotate-90")}
                        aria-hidden
                      />
                      {t("thinkingLab.angle.note", "Note")}
                    </button>
                    {openAngleNotes[angle.id] ? (
                      <div className="mt-1 space-y-1 pl-5">
                        {[...ideaNotesForCode(angleNotes ?? [], angle.code), ...uncodedNotes(angleNotes ?? [])].map((note) => (
                          <p key={note} className="text-sm leading-relaxed text-muted-foreground">
                            {note}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {onPickAngleFixOffer
                  ? (angleFixOffers ?? [])
                      .filter((offer) => offer.failedCode.toUpperCase() === angle.code.toUpperCase())
                      .map((offer) => (
                        <div key={offer.statement} className="mt-2 rounded-md border border-border p-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("thinkingLab.angle.fixOffer", "Recommended repair · AUDIT_PASS")}
                          </p>
                          <p className="mt-1 text-sm text-foreground">{offer.statement}</p>
                          <Button
                            type="button"
                            size="sm"
                            className="mt-2"
                            disabled={Boolean(pendingAction)}
                            onClick={() => onPickAngleFixOffer(angle.code, offer.statement)}
                          >
                            {pendingAction === "pick-angle-fix" ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : null}
                            {t("thinkingLab.fix.pick", "Use this repair")}
                          </Button>
                        </div>
                      ))
                  : null}
              </li>
              );
            })}
          </ul>
          {angleNotesLeftOutside(angleNotes ?? [], angles ?? []).length > 0 ? (
            <ul className="space-y-1 pt-2">
              {angleNotesLeftOutside(angleNotes ?? [], angles ?? []).map((note) => (
                <li key={note} className="text-sm text-muted-foreground">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
          {(angleStage &&
            angleStage !== "lock" &&
            angleStage !== "audit" &&
            onAngleStage &&
            pendingAction !== "generate-angle" &&
            !(angleStage === "generate" && manualRunning) &&
            !(angleStage === "fix" && onFixAngle)) ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {angleStage &&
              angleStage !== "lock" &&
              angleStage !== "audit" &&
              onAngleStage &&
              pendingAction !== "generate-angle" &&
              !(angleStage === "generate" && manualRunning) &&
              !(angleStage === "fix" && onFixAngle) ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onAngleStage}
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === angleStage}
                >
                  {pendingAction === angleStage ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {angleStage === "generate" ? <Sparkles className="h-3.5 w-3.5" /> : null}
                  {angleActionLabel}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {kind === "bigThought" && manualAdd && !childGenerateRunning ? (
        <ManualStatementForm
          label={manualAdd.label}
          submitLabel={t("thinkingLab.manual.save", "Save")}
          pending={manualRunning}
          onSubmit={manualAdd.onSubmit}
        />
      ) : null}
      {notice ? <p className="text-sm text-destructive">{notice}</p> : null}
      {kind === "bigThought" && questionNotes && questionNotes.length > 0 ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("thinkingLab.bigThought.question", "Question this Big Thought")}</p>
          <ul className="space-y-1">
            {questionNotes.map((note) => (
              <li key={note} className="text-sm text-muted-foreground">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {kind === "bigThought" && territoryGenerateChecklist ? (
        <TerritoryPassChecklist checks={territoryGenerateChecklist.checks} report={territoryGenerateChecklist.report} showPending />
      ) : null}
      {kind === "bigThought" && territories && territories.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("thinkingLab.territory.list", "Territories")}</p>
          <ul className="space-y-2">
            {territories.map((territory) => {
              const territoryFixing =
                (fixingTerritoryCodes ?? []).some((code) => code.toUpperCase() === territory.code.toUpperCase()) ||
                pendingAction === `fix-territory:${territory.code}`;
              const otherWorkRunning = Boolean(pendingAction) && !pendingAction.startsWith("fix-territory:");
              const territoryNeedsFix = checkRowFailed(territory.verdict, territory.checklist);
              const showTerritoryCardMenu =
                Boolean(territory.editable && onEditTerritory) ||
                (territory.verdict === "AUDIT_PASS" && Boolean(onGenerateAngle)) ||
                (territoryNeedsFix && Boolean(onFixTerritory)) ||
                Boolean(onDeleteTerritory);
              return (
              <li key={territory.id} className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{territory.code}</span>
                  {territory.verdict ? <VerdictChip verdict={territory.verdict} verbatim /> : null}
                  {showTerritoryCardMenu ? (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="ml-auto h-6 w-6 shrink-0 text-muted-foreground"
                          aria-label={`${t("thinkingLab.action.more", "More actions")} ${territory.code}`}
                          aria-busy={territoryFixing || undefined}
                          disabled={territoryFixing || otherWorkRunning}
                        >
                          {territoryFixing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <MoreVertical className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[11rem]">
                        {territory.editable && onEditTerritory ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            disabled={territoryFixing || otherWorkRunning}
                            onSelect={() =>
                              setTerritoryEditToken((current) => ({
                                ...current,
                                [territory.id]: (current[territory.id] ?? 0) + 1,
                              }))
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t("thinkingLab.manual.edit", "Edit")}
                          </DropdownMenuItem>
                        ) : null}
                        {territoryNeedsFix && onFixTerritory ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            disabled={territoryFixing || otherWorkRunning}
                            aria-busy={territoryFixing}
                            onSelect={() => onFixTerritory(territory.code)}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            {t("thinkingLab.action.fix", "Fix")}
                          </DropdownMenuItem>
                        ) : null}
                        {territory.verdict === "AUDIT_PASS" && onGenerateAngle ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            disabled={Boolean(pendingAction)}
                            aria-busy={pendingAction === "generate-angle"}
                            onSelect={() => onGenerateAngle(territory.id)}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            {t("thinkingLab.angle.generateBranch", "Generate Angle")}
                          </DropdownMenuItem>
                        ) : null}
                        {onDeleteTerritory ? (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                            disabled={territoryFixing || otherWorkRunning}
                            onSelect={() => onDeleteTerritory(territory.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("thinkingLab.action.deleteTerritory", "Delete Territory")}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
                <EditableStatement
                  compact
                  showButton={false}
                  editToken={territoryEditToken[territory.id] ?? 0}
                  statement={territory.statement}
                  enabled={Boolean(territory.editable && onEditTerritory)}
                  pending={Boolean(pendingAction)}
                  onSave={(next) => onEditTerritory?.(territory.id, next) ?? Promise.resolve(null)}
                />
                {territory.link ? (
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{territory.link}</p>
                ) : null}
                {territory.detail ? (
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{territory.detail}</p>
                ) : null}
                {territory.question ? (
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-800">{territory.question}</p>
                ) : null}
                <TerritoryPassChecklist
                  checks={territory.checklist}
                  note={territory.checklistNote}
                  onFix={
                    territoryNeedsFix && onFixTerritory ? () => onFixTerritory(territory.code) : undefined
                  }
                  fixing={territoryFixing}
                  blocked={otherWorkRunning}
                />
                {onPickTerritoryFixOffer
                  ? (territoryFixOffers ?? [])
                      .filter((offer) => offer.failedCode.toUpperCase() === territory.code.toUpperCase())
                      .map((offer) => (
                        <div key={offer.statement} className="mt-2 rounded-md border border-border p-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("thinkingLab.territory.fixOffer", "Recommended repair · AUDIT_PASS")}
                          </p>
                          <p className="mt-1 text-sm text-foreground">{offer.statement}</p>
                          {offer.detail ? (
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{offer.detail}</p>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            className="mt-2"
                            disabled={Boolean(pendingAction)}
                            onClick={() => onPickTerritoryFixOffer(territory.code, offer.statement)}
                          >
                            {pendingAction === "pick-territory-fix" ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : null}
                            {t("thinkingLab.fix.pick", "Use this repair")}
                          </Button>
                        </div>
                      ))
                  : null}
              </li>
              );
            })}
          </ul>
          {territoryNotes && territoryNotes.length > 0 ? (
            <TerritoryAuditNotes
              notes={territoryNotes}
              failedCodes={
                new Set(
                  territories.filter((row) => row.verdict === "AUDIT_FAIL").map((row) => row.code.toUpperCase()),
                )
              }
              onRemoveCoveringTerritory={onRemoveCoveringTerritory}
            />
          ) : null}
          {onAcceptGap || onSkipGap ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {onAcceptGap ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onAcceptGap}
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "accept-gap"}
                >
                  {pendingAction === "accept-gap" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {t("thinkingLab.territory.addCandidate", "Add this Territory")}
                </Button>
              ) : null}
              {onSkipGap ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onSkipGap}
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "skip-gap"}
                >
                  {pendingAction === "skip-gap" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {t("thinkingLab.territory.skipCandidate", "Skip")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {kind === "territory" ? pathBlock : null}
    </div>
  );
}
