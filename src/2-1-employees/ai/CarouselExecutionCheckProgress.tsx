import { Check, Loader2, Minus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import {
  CAROUSEL_EXECUTION_CHECK_IDS,
  CAROUSEL_EXECUTION_CHECK_LABELS,
  type CarouselExecutionCheckId,
} from "./carouselGenerateRules";

export type ExecutionCheckRowState = "pending" | "pass" | "fail" | "skipped";

export type ExecutionCheckProgress = {
  open: boolean;
  phase: "pending" | "done" | "skipped" | "failed";
  rows: Array<{ id: CarouselExecutionCheckId; state: ExecutionCheckRowState }>;
  rejectCheck?: string;
};

function isExecutionCheckId(value: string | undefined): value is CarouselExecutionCheckId {
  return Boolean(value && (CAROUSEL_EXECUTION_CHECK_IDS as readonly string[]).includes(value));
}

/** Map hard anti-copy rejects onto the same checklist row users already know. */
function failCheckIdFromReject(rejectCheck: string | undefined): CarouselExecutionCheckId | null {
  if (!rejectCheck) return null;
  if (isExecutionCheckId(rejectCheck)) return rejectCheck;
  if (rejectCheck.startsWith("copy:")) return "messageStays";
  return null;
}

export function progressFromGenerateResult(args: {
  enabled: boolean;
  checks: Array<{ id: string; state: string }> | null | undefined;
  rejectCheck?: string;
  failed?: boolean;
}): ExecutionCheckProgress {
  if (!args.enabled) {
    return {
      open: true,
      phase: "skipped",
      rows: CAROUSEL_EXECUTION_CHECK_IDS.map((id) => ({ id, state: "skipped" })),
    };
  }
  const byId = new Map(
    (args.checks ?? [])
      .filter((row) => typeof row?.id === "string")
      .map((row) => [row.id, row.state === "fail" ? "fail" as const : "pass" as const]),
  );
  const hasRows = byId.size > 0;
  const rejectFailId = failCheckIdFromReject(args.rejectCheck);
  return {
    open: true,
    phase: args.failed ? "failed" : "done",
    rows: CAROUSEL_EXECUTION_CHECK_IDS.map((id) => {
      const known = byId.get(id);
      if (known) return { id, state: known };
      if (!args.failed) return { id, state: "pass" as const };
      // No per-check payload: mark the reject row Fail, others Pass (one verdict, not "skipped").
      if (!hasRows && rejectFailId === id) return { id, state: "fail" as const };
      if (!hasRows) return { id, state: "pass" as const };
      return { id, state: "fail" as const };
    }),
    rejectCheck: args.rejectCheck,
  };
}

function StatusIcon({ state }: { state: ExecutionCheckRowState }) {
  if (state === "pending") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />;
  }
  if (state === "pass") {
    return <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
  }
  if (state === "fail") {
    return <X className="h-3.5 w-3.5 text-destructive" aria-hidden />;
  }
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />;
}

function stateLabel(state: ExecutionCheckRowState): string {
  if (state === "pending") return "Menilai…";
  if (state === "pass") return "Pass";
  if (state === "fail") return "Fail";
  return "Dilewati";
}

type Props = {
  progress: ExecutionCheckProgress | null;
  onOpenChange: (open: boolean) => void;
};

/** Result dialog for Generate sekarang — opened after a quality-check failure (Pass/Fail rows). */
export function CarouselExecutionCheckProgressDialog({ progress, onOpenChange }: Props) {
  if (!progress) return null;
  const title =
    progress.phase === "pending"
      ? "Cek kualitas…"
      : progress.phase === "skipped"
        ? "Cek kualitas dilewati"
        : progress.phase === "failed"
          ? "Cek kualitas gagal"
          : "Hasil cek kualitas";
  const rejectLabel = (() => {
    const mapped = failCheckIdFromReject(progress.rejectCheck);
    if (mapped) return CAROUSEL_EXECUTION_CHECK_LABELS[mapped];
    if (progress.rejectCheck?.startsWith("copy:")) return CAROUSEL_EXECUTION_CHECK_LABELS.messageStays;
    return progress.rejectCheck ?? "";
  })();
  const description =
    progress.phase === "pending"
      ? "Satu penilaian untuk 10 poin — sedang berjalan."
      : progress.phase === "skipped"
        ? "Saklar OFF di Brief. Aturan generate (sistem) tetap berlaku."
        : rejectLabel
          ? `Ditolak: ${rejectLabel}`
          : "Status dari respons generate (bukan 10 panggilan terpisah).";

  return (
    <Dialog open={progress.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {progress.phase === "pending" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {progress.rows.map((row) => (
            <li
              key={row.id}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                row.state === "fail" && "border-destructive/40 bg-destructive/5",
                row.state === "pass" && "border-emerald-600/30 bg-emerald-50/50",
                row.state === "skipped" && "border-border bg-muted/40",
                row.state === "pending" && "border-border bg-background",
              )}
            >
              <StatusIcon state={row.state} />
              <span className="min-w-0 flex-1 text-foreground">
                {CAROUSEL_EXECUTION_CHECK_LABELS[row.id]}
              </span>
              <span
                className={cn(
                  "shrink-0 font-medium",
                  row.state === "pass" && "text-emerald-700",
                  row.state === "fail" && "text-destructive",
                  (row.state === "pending" || row.state === "skipped") && "text-muted-foreground",
                )}
              >
                {stateLabel(row.state)}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
