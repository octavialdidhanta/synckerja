import { cn } from "@/shared/lib/utils";

function dotClass(qualityRaw: string, label: string): string {
  const raw = qualityRaw.toUpperCase();
  if (raw === "GREEN" || label === "High quality") return "bg-emerald-500";
  if (raw === "YELLOW" || label === "Medium quality") return "bg-amber-400";
  if (raw === "RED" || label === "Low quality") return "bg-red-500";
  if (raw === "UNKNOWN" || label === "Quality pending") return "bg-slate-400";
  return "bg-slate-300";
}

export function TemplateQualityBadge({
  label,
  qualityRaw = "",
  title,
}: {
  label: string;
  qualityRaw?: string;
  title?: string;
}) {
  if (label === "—") {
    return (
      <span className="text-sm text-muted-foreground" title={title}>
        —
      </span>
    );
  }

  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 text-sm text-slate-800"
      title={title ?? (label === "Quality pending" ? "Meta: UNKNOWN — belum cukup feedback/read-rate dari pelanggan." : undefined)}
    >
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", dotClass(qualityRaw, label))}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
