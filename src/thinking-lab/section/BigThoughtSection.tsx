import { Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { becauseSentence } from "@/thinking-lab/big-thought/because";
import { bigThoughtHeading } from "@/thinking-lab/big-thought/label";
import { EditableStatement } from "@/thinking-lab/section/ManualStatementForm";
import type { FixModelResponse } from "@/thinking-lab/big-thought/fix";
import type { BigThoughtFacts } from "@/thinking-lab/big-thought/types";
import type { AuditVerdict, IndividualAdmission, TriState } from "@/thinking-lab/shared/verdict";

function groupFixResponses(responses: FixModelResponse[]): Array<{ code: string; steps: FixModelResponse[] }> {
  const groups: Array<{ code: string; steps: FixModelResponse[] }> = [];
  for (const response of responses) {
    const code = response.code?.trim() || "—";
    const current = groups[groups.length - 1];
    if (current?.code === code) current.steps.push(response);
    else groups.push({ code, steps: [response] });
  }
  return groups;
}

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

function FixProgress({ steps }: { steps: FixModelResponse[] | undefined }) {
  const { t } = useAppTranslation();
  if (!steps || steps.length === 0) return null;
  return (
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
      {steps.map((step, index) => (
        <span key={`${step.kind}-${index}`}>
          {index > 0 ? <span className="px-1.5 text-border">·</span> : null}
          {t(`thinkingLab.fix.${step.kind}`, step.kind)}{" "}
          <span className={step.valid ? "text-emerald-700" : "text-destructive"}>
            {step.valid ? t("thinkingLab.fix.valid", "Valid") : t("thinkingLab.fix.notValid", "Not valid")}
          </span>
        </span>
      ))}
    </p>
  );
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
};

type BigThoughtSectionProps = {
  parentStatement?: string;
  rows: BigThoughtRowView[];
  missingWhy: { description: string; boundary: string } | null;
  notice: string | null;
  auditProgress: AuditProgress | null;
  fixResponses: FixModelResponse[];
  fixOffers?: Array<{ failedCode: string; statement: string }>;
  onPickFixOffer?: (failedCode: string, statement: string) => void;
  generateBusy?: boolean;
  onGenerateTerritory?: (bigThoughtId: string) => void;
  onEditBigThought?: (id: string, statement: string) => Promise<string | null>;
  onDeleteBigThought?: (bigThoughtId: string) => void;
};

export function BigThoughtSection({
  parentStatement = "",
  rows,
  missingWhy,
  notice,
  auditProgress,
  fixResponses,
  fixOffers = [],
  onPickFixOffer,
  generateBusy = false,
  onGenerateTerritory,
  onEditBigThought,
  onDeleteBigThought,
}: BigThoughtSectionProps) {
  const { t } = useAppTranslation();
  const showProgress = Boolean(auditProgress && (auditProgress.done > 0 || auditProgress.current));

  return (
    <div className="space-y-3">
      {showProgress && auditProgress ? (
        <div className="space-y-1 text-sm">
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
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("thinkingLab.bt.empty", "No Big Thoughts yet.")}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {auditProgress?.current?.code === row.code ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                    ) : null}
                    <span className="text-sm font-medium">{bigThoughtHeading(row.code, row.label ?? "")}</span>
                    <Badge variant="secondary">{row.admission}</Badge>
                    {row.audit ? (
                      <Badge variant={row.audit === "AUDIT_FAIL" ? "destructive" : "default"}>{row.audit}</Badge>
                    ) : null}
                  </div>
                  <EditableStatement
                    lead={parentStatement ? undefined : `${t("thinkingLab.bt.keyBelief", "Key Belief")}:`}
                    statement={parentStatement ? becauseSentence(parentStatement, row.statement) : row.statement}
                    enabled={row.status === "candidate" && Boolean(onEditBigThought)}
                    pending={generateBusy}
                    onSave={(statement) => onEditBigThought?.(row.id, statement) ?? Promise.resolve(null)}
                  />
                </div>
                {onDeleteBigThought ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    aria-label={t("thinkingLab.action.deleteBigThought", "Delete Big Thought")}
                    disabled={generateBusy}
                    onClick={() => onDeleteBigThought(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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
              <FixProgress steps={groupFixResponses(fixResponses).find((group) => group.code.toUpperCase() === row.code.toUpperCase())?.steps} />
              {onPickFixOffer
                ? fixOffers
                    .filter((offer) => offer.failedCode.toUpperCase() === row.code.toUpperCase())
                    .map((offer) => (
                      <div key={offer.statement} className="mt-2 rounded-md border border-border p-2">
                        <p className="text-sm text-foreground">{offer.statement}</p>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-2"
                          disabled={generateBusy}
                          onClick={() => onPickFixOffer(row.code, offer.statement)}
                        >
                          {t("thinkingLab.fix.pick", "Use this repair")}
                        </Button>
                      </div>
                    ))
                : null}
              <AuditDetails row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
