import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { EditableStatement, ManualStatementForm } from "@/thinking-lab/section/ManualStatementForm";

type InspectorAngle = {
  id: string;
  code: string;
  statement: string;
  relation?: string;
  verdict?: string | null;
  editable?: boolean;
};

type InspectorTerritory = {
  id: string;
  code: string;
  statement: string;
  verdict?: string | null;
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
  onUnlock?: () => void;
  onDelete?: () => void;
  unlockDisabled?: boolean;
  onGenerateAngle?: (territoryId: string) => void;
  territoryId?: string;
  angleReady?: boolean;
  onGenerateIdea?: (angleId: string) => void;
  angleId?: string;
  ideaReady?: boolean;
  ideas?: Array<{ id: string; code: string; statement: string; editable?: boolean; verdict?: string | null }>;
  ideaStage?: "fix" | "audit" | "downtop" | "lock" | null;
  onIdeaStage?: () => void;
  ideaNotes?: string[];
  ideaFixOffers?: Array<{ failedCode: string; statement: string }>;
  onPickIdeaFixOffer?: (failedCode: string, statement: string) => void;
  angles?: InspectorAngle[];
  angleStage?: "fix" | "generate" | "audit" | "challenger" | "lock" | null;
  onAngleStage?: () => void;
  onLockAngles?: () => void;
  angleNotes?: string[];
  angleFixOffers?: Array<{ failedCode: string; statement: string }>;
  onPickAngleFixOffer?: (failedCode: string, statement: string) => void;
  territories?: InspectorTerritory[];
  territoryStage?: "fix" | "generate" | "audit" | "challenger" | "lock" | null;
  onTerritoryStage?: () => void;
  onAcceptGap?: () => void;
  onSkipGap?: () => void;
  onRemoveCoveringTerritory?: (code: string) => void;
  pendingAction?: string | null;
  notice?: string | null;
  pathUp?: Array<{ label: string; title: string }>;
  territoryArea?: { lead: string; body: string } | null;
  territoryPass?: { lead: string; body: string } | null;
  subject?: string | null;
  subjectNotice?: string | null;
  questionNotes?: string[];
  territoryNotes?: TerritoryAuditNote[];
  territoryFixOffers?: Array<{ failedCode: string; statement: string }>;
  onPickTerritoryFixOffer?: (failedCode: string, statement: string) => void;
  manualAdd?: ManualAdd | null;
  onEditStatement?: (statement: string) => Promise<string | null>;
  onEditTerritory?: (id: string, statement: string) => Promise<string | null>;
  onEditAngle?: (id: string, statement: string) => Promise<string | null>;
  onEditIdea?: (id: string, statement: string) => Promise<string | null>;
  executionReady?: boolean;
  executions?: Array<{ id: string; pillar: string; label: string; statement: string; admission: string }>;
  pillars?: Array<{ id: string; label: string }>;
  onGenerateExecution?: (pillar: string) => void;
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
    body: "Territory menunjuk ruang di dunia audiens: kata atau frasa benda, tanpa klaim. Di area itu pertanyaan yang dijawab Big Thought memang muncul.",
    note: "Bahasanya bahasa audiens, bukan istilah internal. Cukup luas untuk beberapa Angle.",
  },
  angle: {
    label: "Angle",
    body: "Angle mengangkat pengamatan di dalam Territory: hal yang jarang disadari, kontradiksi, atau ketegangan.",
    note: "Bukan alasan. Kalau kalimatnya masuk mulus ke bentuk karena, ia sedang mengerjakan pekerjaan Big Thought.",
  },
  idea: {
    label: "Idea",
    body: "Idea merancang mekanisme yang membuat Angle terjadi, terlihat, atau terbukti, tanpa menjelaskan alasan Big Thought secara verbal.",
    note: "Mekanismenya mengunci penjelasan lain, sehingga subjek Master Thought menjadi penyebab yang masuk akal. Bentuk produksi dipilih nanti.",
  },
} as const;

function NodeDefinitionInfo({ kind }: { kind: keyof typeof NODE_DEFINITIONS }) {
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

function VerdictChip({ verdict }: { verdict: string }) {
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
      {verdict.replace(/^AUDIT_/, "")}
    </span>
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

export function LabNodeInspector({
  kind,
  title,
  statement,
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
  ideaStage = null,
  onIdeaStage,
  ideaNotes,
  ideaFixOffers,
  onPickIdeaFixOffer,
  angles,
  angleStage = null,
  onAngleStage,
  onLockAngles,
  angleNotes,
  angleFixOffers,
  onPickAngleFixOffer,
  territories,
  territoryStage,
  onTerritoryStage,
  onAcceptGap,
  onSkipGap,
  onRemoveCoveringTerritory,
  pendingAction = null,
  notice,
  pathUp,
  territoryArea = null,
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
  executions,
  pillars,
  onGenerateExecution,
}: LabNodeInspectorProps) {
  const { t } = useAppTranslation();
  const childGenerateRunning =
    pendingAction === "generate" ||
    pendingAction === "generate-territory" ||
    pendingAction === "generate-angle" ||
    pendingAction === "generate-idea";
  const manualRunning = pendingAction?.startsWith("manual-") ?? false;
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
            <span>{label}</span>
            <NodeDefinitionInfo kind={kind} />
          </p>
          {onEditStatement && !title && kind !== "territory" ? (
            <EditableStatement statement={statement} enabled pending={Boolean(pendingAction)} onSave={onEditStatement} />
          ) : (
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">{heading}</h2>
          )}
          {kind !== "territory" && detail ? <p className="text-[15px] leading-relaxed text-slate-600">{detail}</p> : null}
          {onEditStatement && title ? (
            <EditableStatement statement={statement} enabled pending={Boolean(pendingAction)} onSave={onEditStatement} />
          ) : null}
          {kind === "master" && subjectNotice ? <p className="text-sm text-muted-foreground">{subjectNotice}</p> : null}
        </header>
        {kind === "bigThought" && onDelete ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
            aria-label={t("thinkingLab.action.deleteBigThought", "Delete Big Thought")}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      {kind === "territory" && (territoryArea?.body || territoryPass?.body) ? (
        <div className="space-y-2">
          {territoryArea?.body ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-foreground">
              <span className="font-semibold">{territoryArea.lead}</span> {territoryArea.body}
            </p>
          ) : null}
          {territoryPass?.body ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-foreground">
              <span className="font-semibold">{territoryPass.lead}</span> {territoryPass.body}
            </p>
          ) : null}
        </div>
      ) : null}
      {kind === "territory" && (showTerritoryGenerate || onEditStatement || onDelete) ? (
        <div className="flex flex-wrap items-center gap-2">
          {showTerritoryGenerate && onGenerateAngle && territoryId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onGenerateAngle(territoryId)}
              disabled={Boolean(pendingAction)}
              aria-busy={pendingAction === "generate-angle"}
            >
              {pendingAction === "generate-angle" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("thinkingLab.angle.generate", "Buat ulang Angle")}
            </Button>
          ) : null}
          {onEditStatement ? (
            <EditableStatement
              buttonOnly
              statement={statement}
              enabled
              pending={Boolean(pendingAction)}
              onSave={onEditStatement}
            />
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              aria-label={t("thinkingLab.action.deleteTerritory", "Delete Territory")}
              onClick={onDelete}
            >
              {t("thinkingLab.action.delete", "Hapus")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {kind === "territory" ? null : pathBlock}
      {onUnlock ? (
        <Button type="button" variant="outline" size="sm" onClick={onUnlock} disabled={unlockDisabled} aria-busy={unlockDisabled}>
          {unlockDisabled ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("thinkingLab.action.unlock", "Unlock")}
        </Button>
      ) : null}
      {kind === "idea" && executionReady && pillars && onGenerateExecution ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("thinkingLab.execution.pillars", "Pillar")}</p>
          <p className="text-xs text-muted-foreground">
            {t(
              "thinkingLab.execution.flashSale",
              "Flash Sale Hook is valid only when the Master Thought is actually selling something.",
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {pillars.map((pillar) => (
              <Button
                key={pillar.id}
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(pendingAction)}
                onClick={() => onGenerateExecution(pillar.id)}
              >
                {pendingAction === `execution-${pillar.id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {pillar.label}
              </Button>
            ))}
          </div>
          {executions && executions.length > 0 ? (
            <ul className="space-y-2 pt-1">
              {executions.map((row) => (
                <li key={row.id} className="text-sm text-foreground">
                  <p className="font-medium">
                    {row.label}
                    <span className="ml-2 text-xs text-muted-foreground">{row.admission}</span>
                  </p>
                  <p className="mt-1 leading-relaxed">{row.statement}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {kind === "angle" && manualAdd && !childGenerateRunning ? (
        <ManualStatementForm
          label={manualAdd.label}
          submitLabel={t("thinkingLab.manual.save", "Save")}
          pending={manualRunning}
          onSubmit={manualAdd.onSubmit}
        />
      ) : null}
      {kind === "angle" && ideaReady && onGenerateIdea && angleId && !manualRunning ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full"
          onClick={() => onGenerateIdea(angleId)}
          disabled={Boolean(pendingAction)}
          aria-busy={pendingAction === "generate-idea"}
        >
          {pendingAction === "generate-idea" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("thinkingLab.idea.generate", "Generate Idea")}
        </Button>
      ) : null}
      {kind === "angle" && ideas && ideas.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("thinkingLab.idea.list", "Ideas")}</p>
          <ul className="space-y-2">
            {ideas.map((idea) => (
              <li key={idea.id} className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{idea.code}</span>
                  {idea.verdict ? <VerdictChip verdict={idea.verdict} /> : null}
                </div>
                <EditableStatement
                  compact
                  statement={idea.statement}
                  enabled={Boolean(idea.editable && onEditIdea)}
                  pending={Boolean(pendingAction)}
                  onSave={(next) => onEditIdea?.(idea.id, next) ?? Promise.resolve(null)}
                />
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
              </li>
            ))}
          </ul>
          {ideaNotes && ideaNotes.length > 0 ? (
            <ul className="space-y-1 pt-2">
              {ideaNotes.map((note) => (
                <li key={note} className="text-sm text-muted-foreground">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
          {ideaStage && onIdeaStage ? (
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={onIdeaStage}
              disabled={Boolean(pendingAction)}
              aria-busy={pendingAction === ideaStage}
            >
              {pendingAction === ideaStage ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {ideaStage === "audit"
                ? t("thinkingLab.action.audit", "Audit")
                : ideaStage === "downtop"
                  ? t("thinkingLab.idea.downTop", "Down-top")
                  : ideaStage === "fix"
                    ? t("thinkingLab.action.fix", "Fix")
                    : t("thinkingLab.action.lock", "Lock")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {kind === "territory" && angles && angles.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("thinkingLab.angle.list", "Angles")}</p>
          <ul className="space-y-2">
            {angles.map((angle) => (
              <li key={angle.id} className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{angle.code}</span>
                  {angle.verdict ? <VerdictChip verdict={angle.verdict} /> : null}
                </div>
                <EditableStatement
                  compact
                  statement={angle.statement}
                  enabled={Boolean(angle.editable && onEditAngle)}
                  pending={Boolean(pendingAction)}
                  onSave={(next) => onEditAngle?.(angle.id, next) ?? Promise.resolve(null)}
                />
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
            ))}
          </ul>
          {angleNotes && angleNotes.length > 0 ? (
            <ul className="space-y-1 pt-2">
              {angleNotes.map((note) => (
                <li key={note} className="text-sm text-muted-foreground">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
          {(angleStage &&
            onAngleStage &&
            pendingAction !== "generate-angle" &&
            !(angleStage === "generate" && manualRunning)) ||
          (onLockAngles && angleStage !== "lock" && angleStage !== "challenger") ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {angleStage &&
              onAngleStage &&
              pendingAction !== "generate-angle" &&
              !(angleStage === "generate" && manualRunning) ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onAngleStage}
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === angleStage}
                >
                  {pendingAction === angleStage ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {angleStage === "audit"
                    ? t("thinkingLab.action.audit", "Audit")
                    : angleStage === "challenger"
                      ? t("thinkingLab.action.challenger", "Challenger")
                      : angleStage === "fix"
                        ? t("thinkingLab.action.fix", "Fix")
                        : angleStage === "generate"
                          ? t("thinkingLab.angle.generate", "Buat ulang Angle")
                          : t("thinkingLab.action.lock", "Lock")}
                </Button>
              ) : null}
              {onLockAngles && angleStage !== "lock" && angleStage !== "challenger" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onLockAngles}
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "lock"}
                >
                  {pendingAction === "lock" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {t("thinkingLab.action.lock", "Lock")}
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
      {kind === "bigThought" && territories && territories.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("thinkingLab.territory.list", "Territories")}</p>
          <ul className="space-y-2">
            {territories.map((territory) => (
              <li key={territory.id} className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{territory.code}</span>
                  {territory.verdict ? <VerdictChip verdict={territory.verdict} /> : null}
                </div>
                <EditableStatement
                  compact
                  statement={territory.statement}
                  enabled={Boolean(territory.editable && onEditTerritory)}
                  pending={Boolean(pendingAction)}
                  onSave={(next) => onEditTerritory?.(territory.id, next) ?? Promise.resolve(null)}
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
            ))}
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
          {territoryStage &&
          onTerritoryStage &&
          pendingAction !== "generate-territory" &&
          !(territoryStage === "generate" && manualRunning) ? (
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={onTerritoryStage}
              disabled={Boolean(pendingAction)}
              aria-busy={pendingAction === territoryStage}
            >
              {pendingAction === territoryStage ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {territoryStage === "audit"
                ? t("thinkingLab.action.audit", "Audit")
                : territoryStage === "challenger"
                  ? t("thinkingLab.action.challenger", "Challenger")
                  : territoryStage === "fix"
                    ? t("thinkingLab.action.fix", "Fix")
                    : territoryStage === "generate"
                      ? t("thinkingLab.territory.generate", "Generate Territory")
                      : t("thinkingLab.action.lock", "Lock")}
            </Button>
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
