import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { ExecutionConfirmQuestion, ScriptConfirmation } from "@/thinking-lab/execution/confirm";

const WRITE_OWN = "\u0000write-own";
const ANSWER_LIMIT = 160;

export function ExecutionConfirmDialog({
  open,
  loading,
  failed,
  questions,
  pending = false,
  onOpenChange,
  onRetry,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  failed: boolean;
  questions: ExecutionConfirmQuestion[] | null;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onConfirm: (answers: ScriptConfirmation[]) => void;
}) {
  const { t } = useAppTranslation();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ownAnswers, setOwnAnswers] = useState<Record<string, string>>({});
  const answerFor = (questionId: string) => {
    const selected = answers[questionId] ?? "";
    if (selected !== WRITE_OWN) return selected.trim();
    return (ownAnswers[questionId] ?? "").trim();
  };
  const ready = Boolean(questions && questions.length > 0 && questions.every((question) => Boolean(answerFor(question.id))));

  useEffect(() => {
    setAnswers({});
    setOwnAnswers({});
  }, [questions, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 p-5 sm:max-w-lg">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">{t("thinkingLab.execution.confirmTitle", "Confirm before writing")}</DialogTitle>
          <DialogDescription>
            {t(
              "thinkingLab.execution.confirmHint",
              "The script does not yet say whose point of view it uses. Answer first, then it is written.",
            )}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t("thinkingLab.execution.confirmLoading", "Reading the idea to lock the point of view...")}
          </p>
        ) : null}
        {failed && !loading ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              {t("thinkingLab.execution.confirmFailed", "The confirmation questions could not be read. Try again.")}
            </p>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onRetry}>
              {t("thinkingLab.execution.confirmRetry", "Try again")}
            </Button>
          </div>
        ) : null}
        {questions && !loading ? (
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain max-h-[60vh] space-y-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {questions.map((question) => (
              <fieldset key={question.id} className="space-y-2">
                {question.category && question.category !== question.prompt ? (
                  <p className="text-xs font-medium text-muted-foreground">{question.category}</p>
                ) : null}
                <legend className="text-sm font-medium text-foreground">{question.prompt}</legend>
                <RadioGroup
                  value={answers[question.id] ?? ""}
                  disabled={pending}
                  aria-label={question.prompt}
                  onValueChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                >
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option;
                    return (
                      <label
                        key={option}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2",
                          selected ? "border-primary bg-primary/5" : "border-border bg-background",
                        )}
                      >
                        <RadioGroupItem value={option} className="mt-0.5" />
                        <span className="text-sm leading-snug text-foreground">{option}</span>
                      </label>
                    );
                  })}
                  <div
                    className={cn(
                      "rounded-lg border px-3 py-2",
                      answers[question.id] === WRITE_OWN ? "border-primary bg-primary/5" : "border-border bg-background",
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <RadioGroupItem value={WRITE_OWN} className="mt-0.5" />
                      <span className="text-sm leading-snug text-foreground">
                        {t("thinkingLab.execution.writeOwn", "Write your own")}
                      </span>
                    </label>
                    {answers[question.id] === WRITE_OWN ? (
                      <Textarea
                        className="mt-2 min-h-16"
                        maxLength={ANSWER_LIMIT}
                        disabled={pending}
                        value={ownAnswers[question.id] ?? ""}
                        aria-label={`${t("thinkingLab.execution.writeOwn", "Write your own")} ${question.prompt}`}
                        placeholder={t("thinkingLab.execution.writeOwnHint", "Write the choice for this question")}
                        onChange={(event) =>
                          setOwnAnswers((current) => ({ ...current, [question.id]: event.target.value.slice(0, ANSWER_LIMIT) }))
                        }
                      />
                    ) : null}
                  </div>
                </RadioGroup>
              </fieldset>
            ))}
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("thinkingLab.execution.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!ready || pending || loading}
            onClick={() => {
              if (!questions) return;
              onConfirm(questions.map((question) => ({ question: question.prompt, answer: answerFor(question.id) })));
            }}
          >
            {t("thinkingLab.execution.confirmWrite", "Write the script")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
