import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

export function VerdictChip({ verdict, verbatim = false }: { verdict: string; verbatim?: boolean }) {
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

export function UncheckedBadge() {
  const { t } = useAppTranslation();
  return (
    <span
      className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
      title={t("thinkingLab.checks.uncheckedHint", "Disimpan saat sebagian syarat lolos OFF.")}
    >
      {t("thinkingLab.checks.unchecked", "Tanpa cek")}
    </span>
  );
}

export function ParentChangedBadge() {
  const { t } = useAppTranslation();
  return (
    <span
      className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800"
      title={t("thinkingLab.checks.parentChangedHint", "Kalimat induknya diubah setelah item ini lolos. Cek ulang bila perlu.")}
    >
      {t("thinkingLab.checks.parentChanged", "Induk berubah")}
    </span>
  );
}
