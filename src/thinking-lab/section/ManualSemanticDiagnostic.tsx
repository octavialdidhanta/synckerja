import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { askThinkingLab } from "@/thinking-lab/shared/ai";
import {
  diagnoseBigThought,
  type ManualSemanticDiagnosticResult,
} from "@/thinking-lab/section/diagnoseBigThought";

type ManualSemanticDiagnosticProps = {
  parentStatement: string;
  validSiblings: Array<{ code: string; statement: string }>;
};

function displayValue(value: string | number | boolean | null | undefined): string {
  if (value == null) return "null";
  return String(value);
}

export function ManualSemanticDiagnostic({ parentStatement, validSiblings }: ManualSemanticDiagnosticProps) {
  const { t } = useAppTranslation();
  const [candidate, setCandidate] = useState("");
  const [includeSiblings, setIncludeSiblings] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ManualSemanticDiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRun = async () => {
    const statement = candidate.trim();
    if (!statement || running) return;
    setRunning(true);
    setError(null);
    try {
      const next = await diagnoseBigThought({
        parentStatement,
        candidate: statement,
        siblings: includeSiblings ? validSiblings : [],
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      setResult(next);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
    } finally {
      setRunning(false);
    }
  };

  const facts = result?.facts;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground">
          {t("thinkingLab.diagnostic.title", "Manual Semantic Diagnostic")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(
            "thinkingLab.diagnostic.hint",
            "Runs the production individual judge on this candidate. Nothing is saved.",
          )}
        </p>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{t("thinkingLab.diagnostic.candidate", "Candidate Big Thought")}</span>
        <Textarea
          value={candidate}
          onChange={(event) => setCandidate(event.target.value)}
          rows={4}
          disabled={running}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={includeSiblings}
          onChange={(event) => setIncludeSiblings(event.target.checked)}
          disabled={running}
        />
        {t("thinkingLab.diagnostic.includeSiblings", "Include current valid siblings")}
      </label>
      <Button type="button" onClick={() => void onRun()} disabled={running || !candidate.trim()}>
        {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {t("thinkingLab.diagnostic.run", "Run Diagnostic")}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result && facts ? (
        <dl className="space-y-1 rounded-md border border-border p-3 text-sm">
          <Fact label={t("thinkingLab.diagnostic.statement", "Candidate statement")} value={result.statement} />
          <Fact label={t("thinkingLab.bt.detail.relation", "Relation to parent")} value={facts.relationToParent} />
          <Fact label={t("thinkingLab.bt.detail.supportRole", "Support role")} value={facts.supportRole} />
          <Fact
            label={t("thinkingLab.bt.detail.explainsWhy", "Explains why parent is true")}
            value={displayValue(facts.explainsWhyParentIsTrue)}
          />
          <Fact
            label={t("thinkingLab.bt.detail.unsupportedPremise", "Unsupported premise")}
            value={displayValue(facts.introducesUnsupportedPremise)}
          />
          <Fact
            label={t("thinkingLab.bt.detail.duplicateOfCode", "Duplicate of")}
            value={displayValue(facts.duplicateOfCode)}
          />
          <Fact label={t("thinkingLab.diagnostic.resolution", "Resolution")} value={facts.resolution} />
          <Fact
            label={t("thinkingLab.bt.detail.unresolvedReasons", "Unresolved reasons")}
            value={facts.unresolvedReasons.length === 0 ? "[]" : facts.unresolvedReasons.join(", ")}
          />
          {facts.confidence !== undefined ? (
            <Fact label={t("thinkingLab.diagnostic.confidence", "Confidence")} value={displayValue(facts.confidence)} />
          ) : null}
          <Fact label={t("thinkingLab.diagnostic.admission", "Individual admission")} value={result.admission} />
        </dl>
      ) : null}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
