import { useState } from "react";
import { Check, Circle, Loader2, MoreVertical, Pencil, Sparkles, Trash2, Wrench, X } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { becauseSentence } from "@/thinking-lab/big-thought/because";
import { bigThoughtListed, checklistFromFailure, confirmedPassChecklist, PASS_GATE_IDS, type PassChecklist, type PassGateId, type PassGateState } from "@/thinking-lab/big-thought/checklist";
import { GENERATE_ADMISSION_GATES } from "@/thinking-lab/big-thought/passChecks";
import { bigThoughtHeading } from "@/thinking-lab/big-thought/label";
import { EditableStatement } from "@/thinking-lab/section/ManualStatementForm";
import type { BigThoughtFacts, GateFailure } from "@/thinking-lab/big-thought/types";
import type { AuditVerdict, IndividualAdmission, TriState } from "@/thinking-lab/shared/verdict";

export type BigThoughtRowView = {
  id: string;
  code: string;
  label?: string;
  statement: string;
  status?: "candidate" | "locked" | string;
  admission: IndividualAdmission;
  audit: AuditVerdict | null;
  facts: BigThoughtFacts | null;
  siblingDistinct: TriState | null;
  siblingPairs: Array<{ a: string; b: string; explanation?: string }> | null;
  reasonContribution: string | null;
  siblingUnresolvedReasons: string[] | null;
  gateFailure?: GateFailure | null;
  auditGatesChecked?: boolean;
  auditGateFailure?: GateFailure | null;
  canGenerateTerritory?: boolean;
  territories?: Array<{
    id: string;
    code: string;
    statement: string;
    status?: string;
    canGenerateAngle?: boolean;
    angles?: Array<{ id: string; code: string; statement: string; relation?: string }>;
  }>;
};

function storedValue(value: string | number | boolean | null | undefined, notStored: string): string {
  if (value == null) return notStored;
  return String(value);
}

function storedList(values: string[] | null, notStored: string): string {
  if (values == null) return notStored;
  return values.length === 0 ? "[]" : values.join(", ");
}

function storedPairs(
  pairs: Array<{ a: string; b: string; explanation?: string }> | null,
  notStored: string,
  none: string,
): string {
  if (pairs == null) return notStored;
  return pairs.length === 0 ? none : pairs.map((pair) => `${pair.a} / ${pair.b}`).join(", ");
}

function AuditDetails({ row }: { row: BigThoughtRowView }) {
  const { t } = useAppTranslation();
  const notStored = t("thinkingLab.bt.notStored", "Not stored");
  const facts: BigThoughtFacts | null = row.facts;

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm text-muted-foreground">
        {t("thinkingLab.bt.auditDetails", "Audit details")}
      </summary>
      <div className="mt-2 space-y-1">
        <FactLine label={t("thinkingLab.bt.detail.verdict", "Audit verdict")} value={storedValue(row.audit, notStored)} />
        <FactLine label={t("thinkingLab.bt.detail.primaryReason", "Primary reason")} value={notStored} />
        <FactLine
          label={t("thinkingLab.bt.detail.whatItSays", "What it says")}
          value={storedValue(facts?.whatItSays, notStored)}
        />
        <FactLine
          label={t("thinkingLab.bt.detail.relation", "Relation to parent")}
          value={storedValue(facts?.relationToParent, notStored)}
        />
        <FactLine
          label={t("thinkingLab.bt.detail.supportRole", "Support role")}
          value={storedValue(facts?.supportRole, notStored)}
        />
        <FactLine
          label={t("thinkingLab.bt.detail.explainsWhy", "Explains why parent is true")}
          value={storedValue(facts?.explainsWhyParentIsTrue, notStored)}
        />
        <FactLine
          label={t("thinkingLab.bt.detail.unsupportedPremise", "Unsupported premise")}
          value={storedValue(facts?.introducesUnsupportedPremise, notStored)}
        />
        <FactLine
          label={t("thinkingLab.bt.detail.unsupportedExplanation", "Unsupported premise explanation")}
          value={notStored}
        />
        <FactLine
          label={t("thinkingLab.bt.detail.reasonContribution", "Reason contribution")}
          value={storedValue(row.reasonContribution, notStored)}
        />
        {(row.siblingPairs ?? [])
          .filter((pair) => pair.a.toUpperCase() === row.code.toUpperCase() || pair.b.toUpperCase() === row.code.toUpperCase())
          .map((pair) => {
            const other = pair.a.toUpperCase() === row.code.toUpperCase() ? pair.b : pair.a;
            return (
              <FactLine
                key={`${pair.a}-${pair.b}`}
                label={t("thinkingLab.bt.detail.reasonOverlap", "Reason overlap with {{code}}", { code: other })}
                value={storedValue(pair.explanation, notStored)}
              />
            );
          })}
        <FactLine
          label={t("thinkingLab.bt.detail.siblingDistinct", "Overall sibling set distinctness")}
          value={storedValue(row.siblingDistinct, notStored)}
        />
        <FactLine
          label={t("thinkingLab.bt.detail.duplicateOfCode", "Duplicate of")}
          value={facts ? storedValue(facts.duplicateOfCode, "null") : notStored}
        />
        <FactLine
          label={t("thinkingLab.bt.detail.duplicatePairs", "Duplicate pairs involving this BT")}
          value={storedPairs(row.siblingPairs, notStored, t("thinkingLab.bt.detail.noPairs", "none"))}
        />
        <FactLine
          label={t("thinkingLab.bt.detail.unresolvedReasons", "Unresolved reasons")}
          value={storedList(facts?.unresolvedReasons ?? null, notStored)}
        />
        <FactLine
          label={t("thinkingLab.bt.detail.siblingUnresolvedReasons", "Sibling unresolved reasons")}
          value={storedList(row.siblingUnresolvedReasons, notStored)}
        />
      </div>
    </details>
  );
}

function passLabel(id: PassGateId, t: (key: string, fallback?: string) => string): string {
  const labels: Record<PassGateId, [string, string]> = {
    resolved: ["thinkingLab.bt.pass.resolved", "The judgment is finished."],
    relation: ["thinkingLab.bt.pass.relation", "Not a restatement, elaboration, outcome, or method."],
    role: ["thinkingLab.bt.pass.role", "Role is premise, reason, or evidence."],
    explains: ["thinkingLab.bt.pass.explains", "Explains why the Master Thought is true."],
    premise: ["thinkingLab.bt.pass.premise", "The premise is supported."],
    duplicate: ["thinkingLab.bt.pass.duplicate", "Not a duplicate of a Big Thought that already passed."],
    sibling: ["thinkingLab.bt.pass.sibling", "Distinct from the other Big Thoughts."],
  };
  const [key, fallback] = labels[id];
  return t(key, fallback);
}

function PassChecklistCard({
  checklist,
  reveal,
  gates = PASS_GATE_IDS,
}: {
  checklist: PassChecklist;
  reveal: boolean;
  gates?: readonly PassGateId[];
}) {
  const { t } = useAppTranslation();
  const report = checklist.report;
  const reportLabel = report ? passLabel(report.gate, t) : "";
  const reportText = !reveal
    ? null
    : report?.phase === "checking"
      ? t("thinkingLab.bt.pass.checking", "Checking this requirement: {{gate}}", { gate: reportLabel })
      : report?.phase === "checked"
        ? report.outcome === "fail"
          ? t("thinkingLab.bt.pass.checkedFail", "Checked: {{gate}} It did not pass.", { gate: reportLabel })
          : t("thinkingLab.bt.pass.checkedPass", "Checked: {{gate}} It passed.", { gate: reportLabel })
        : t("thinkingLab.bt.pass.notYet", "No requirement has been checked yet.");
  return (
    <div className="space-y-2">
      {reportText ? <p className="text-sm text-foreground">{reportText}</p> : null}
      <ul className="space-y-1" aria-label={t("thinkingLab.bt.pass.list", "Pass checklist")}>
        {gates.map((id) => {
          const item = checklist.items.find((entry) => entry.id === id);
          const state: PassGateState = item?.state ?? "pending";
          const mark =
            state === "pass" ? (
              <Check className="h-3.5 w-3.5 text-foreground" aria-hidden />
            ) : state === "fail" ? (
              <X className="h-3.5 w-3.5 text-destructive" aria-hidden />
            ) : state === "checking" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" aria-hidden />
            ) : (
              <Circle className={`h-3.5 w-3.5 ${state === "unchecked" ? "text-muted-foreground/40" : "text-muted-foreground"}`} aria-hidden />
            );
          return (
            <li key={id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5">{mark}</span>
              <span className={state === "unchecked" || state === "pending" ? "text-muted-foreground/70" : "text-foreground"}>
                {passLabel(id, t)}
                <span className="sr-only">
                  {state === "pass"
                    ? t("thinkingLab.bt.pass.passed", "Passed")
                    : state === "fail"
                      ? t("thinkingLab.bt.pass.failed", "Failed")
                      : state === "checking"
                        ? t("thinkingLab.bt.pass.checkingNow", "Checking")
                        : t("thinkingLab.bt.pass.pending", "Not checked yet")}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FactLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value}</span>
    </p>
  );
}

export type AuditProgress = {
  done: number;
  total: number;
  current: { code: string; statement: string } | null;
  checklist?: PassChecklist | null;
};

type BigThoughtSectionProps = {
  parentStatement?: string;
  rows: BigThoughtRowView[];
  missingWhy: { description: string; boundary: string } | null;
  notice: string | null;
  auditProgress: AuditProgress | null;
  generateBusy?: boolean;
  generating?: boolean;
  generateChecklist?: PassChecklist | null;
  onGenerateTerritory?: (bigThoughtId: string) => void;
  onEditBigThought?: (id: string, statement: string) => Promise<string | null>;
  onDeleteBigThought?: (bigThoughtId: string) => void;
  onFixBigThought?: (code: string) => void;
  checklists?: Record<string, PassChecklist>;
  fixingCodes?: string[];
};

export function BigThoughtSection({
  parentStatement = "",
  rows,
  missingWhy,
  notice,
  auditProgress,
  generateBusy = false,
  generating = false,
  generateChecklist = null,
  onGenerateTerritory,
  onEditBigThought,
  onDeleteBigThought,
  onFixBigThought,
  checklists,
  fixingCodes = [],
}: BigThoughtSectionProps) {
  const { t } = useAppTranslation();
  const showProgress = Boolean(
    auditProgress && (auditProgress.done > 0 || auditProgress.current || auditProgress.checklist),
  );
  const [editToken, setEditToken] = useState<Record<string, number>>({});
  const shownRows = rows.filter((row) => bigThoughtListed(row));

  return (
    <div className="space-y-3">
      {showProgress && auditProgress ? (
        <div className="space-y-2 text-sm" role="status" aria-live="polite">
          {auditProgress.done > 0 ? (
            <p className="text-foreground">
              {auditProgress.done}/{auditProgress.total}
            </p>
          ) : null}
          {auditProgress.current ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              <span className="min-w-0 truncate">
                {auditProgress.current.code ? `${auditProgress.current.code} ` : ""}
                {auditProgress.current.statement}
              </span>
            </p>
          ) : null}
          {auditProgress.checklist ? <PassChecklistCard checklist={auditProgress.checklist} reveal /> : null}
        </div>
      ) : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      {missingWhy ? (
        <div className="rounded-md border border-border p-3 text-sm">
          <p className="font-medium">{t("thinkingLab.bt.missingWhy", "Missing distinct material support")}</p>
          <p>{missingWhy.description}</p>
          <p className="text-muted-foreground">{missingWhy.boundary}</p>
          <p className="text-foreground">
            {t(
              "thinkingLab.bt.missingWhyNext",
              "Generate adds one Big Thought for this WHY. Then run Audit and Challenger again. Lock stays closed until the set is complete.",
            )}
          </p>
        </div>
      ) : null}
      {generating ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>{t("thinkingLab.bt.generating", "Generating Big Thoughts…")}</span>
          </div>
          {generateChecklist ? (
            <PassChecklistCard checklist={generateChecklist} reveal gates={GENERATE_ADMISSION_GATES} />
          ) : null}
        </div>
      ) : null}
      {shownRows.length === 0 ? (
        generating ? null : (
          <p className="text-sm text-muted-foreground">{t("thinkingLab.bt.empty", "No Big Thoughts yet.")}</p>
        )
      ) : (
        <ul className="space-y-2">
          {shownRows.map((row) => {
            const canEdit = row.status === "candidate" && Boolean(onEditBigThought);
            const canDelete = Boolean(onDeleteBigThought);
            const liveChecklist = checklists?.[row.code.toUpperCase()];
            const needsFix =
              Boolean(onFixBigThought) &&
              (row.audit === "AUDIT_FAIL" || (liveChecklist?.items ?? []).some((item) => item.state === "fail"));
            const fixing = fixingCodes.some((code) => code.toUpperCase() === row.code.toUpperCase());
            return (
            <li key={row.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {auditProgress?.current?.code === row.code ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                    ) : null}
                    <span className="text-sm font-medium">{bigThoughtHeading(row.code, row.label ?? "")}</span>
                    {row.admission !== "GENERATE_VALID" ? <Badge variant="secondary">{row.admission}</Badge> : null}
                    {row.audit ? (
                      <Badge variant={row.audit === "AUDIT_FAIL" ? "destructive" : "default"}>{row.audit}</Badge>
                    ) : null}
                  </div>
                  <EditableStatement
                    lead={parentStatement ? undefined : `${t("thinkingLab.bt.keyBelief", "Key Belief")}:`}
                    statement={parentStatement ? becauseSentence(parentStatement, row.statement) : row.statement}
                    enabled={canEdit}
                    showButton={false}
                    editToken={editToken[row.id] ?? 0}
                    pending={generateBusy}
                    onSave={(statement) => onEditBigThought?.(row.id, statement) ?? Promise.resolve(null)}
                  />
                  {liveChecklist ? (
                    <div className="mt-2">
                      <PassChecklistCard checklist={liveChecklist} reveal />
                    </div>
                  ) : row.auditGatesChecked || (row.facts?.passConfirmed && !row.auditGateFailure && !row.gateFailure) ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-foreground">
                        {t("thinkingLab.bt.pass.allChecked", "Every pass requirement was checked.")}
                      </p>
                      <PassChecklistCard checklist={confirmedPassChecklist()} reveal={false} />
                    </div>
                  ) : row.auditGateFailure ? (
                    <div className="mt-2">
                      <PassChecklistCard checklist={checklistFromFailure(row.auditGateFailure)} reveal={false} />
                    </div>
                  ) : row.gateFailure ? (
                    <div className="mt-2">
                      <PassChecklistCard checklist={checklistFromFailure(row.gateFailure)} reveal={false} />
                    </div>
                  ) : null}
                  {needsFix ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-8 gap-2"
                      disabled={generateBusy || fixingCodes.length > 0}
                      onClick={() => onFixBigThought?.(row.code)}
                    >
                      {fixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Wrench className="h-3.5 w-3.5" aria-hidden />}
                      {t("thinkingLab.action.fix", "Fix")}
                    </Button>
                  ) : null}
                </div>
                {canEdit || canDelete || needsFix ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        disabled={generateBusy || fixing}
                        aria-busy={fixing || undefined}
                        aria-label={t("thinkingLab.action.more", "More actions")}
                      >
                        {fixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <MoreVertical className="h-3.5 w-3.5" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[9rem]">
                      {needsFix ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          disabled={generateBusy || fixingCodes.length > 0}
                          onSelect={() => onFixBigThought?.(row.code)}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          {t("thinkingLab.action.fix", "Fix")}
                        </DropdownMenuItem>
                      ) : null}
                      {canEdit ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          disabled={generateBusy}
                          onSelect={() => {
                            window.setTimeout(() => {
                              setEditToken((current) => ({ ...current, [row.id]: (current[row.id] ?? 0) + 1 }));
                            }, 0);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t("thinkingLab.manual.edit", "Edit")}
                        </DropdownMenuItem>
                      ) : null}
                      {canDelete ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                          disabled={generateBusy}
                          onSelect={() => {
                            window.setTimeout(() => onDeleteBigThought?.(row.id), 0);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("thinkingLab.action.delete", "Delete")}
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
              {row.canGenerateTerritory && onGenerateTerritory ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={generateBusy}
                  onClick={() => onGenerateTerritory(row.id)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("thinkingLab.territory.generate", "Generate Territory")}
                </Button>
              ) : null}
              {row.territories && row.territories.length > 0 ? (
                <div className="mt-3">
                  <p className="text-sm font-medium">{t("thinkingLab.territory.list", "Territories")}</p>
                  <ul className="mt-1 space-y-1">
                    {row.territories.map((territory) => (
                      <li key={territory.id} className="text-sm text-foreground">
                        <span className="font-medium">{territory.code}</span> {territory.statement}
                        {territory.angles && territory.angles.length > 0 ? (
                          <div className="mt-2 border-l border-border pl-3">
                            <p className="text-sm font-medium">{t("thinkingLab.angle.list", "Angles")}</p>
                            <ul className="mt-1 space-y-1">
                              {territory.angles.map((angle) => (
                                <li key={angle.id}>
                                  <span className="font-medium">{angle.code}</span>
                                  {angle.relation ? (
                                    <span className="ml-2 text-xs text-muted-foreground">{angle.relation}</span>
                                  ) : null}{" "}
                                  {angle.statement}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <AuditDetails row={row} />
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
