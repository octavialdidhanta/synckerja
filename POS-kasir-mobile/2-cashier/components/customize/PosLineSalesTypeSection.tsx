import { cn } from "@/shared/lib/utils";
import type { PosCustomizeSalesTypePrice } from "../../hooks/usePosItemCustomizeOptions";

type Props = {
  title: string;
  hint: string;
  options: PosCustomizeSalesTypePrice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function PosLineSalesTypeSection({
  title,
  hint,
  options,
  selectedId,
  onSelect,
}: Props) {
  if (options.length === 0) return null;
  return (
    <section className="border-b border-slate-200 px-4 py-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-800">
        {title}
        <span className="ml-1 font-normal text-slate-400">| {hint}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = selectedId === opt.salesTypeId;
          return (
            <button
              key={`${opt.salesTypeId}:${opt.variantId ?? ""}`}
              type="button"
              onClick={() => onSelect(opt.salesTypeId)}
              className={cn(
                "min-h-12 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/40 bg-white text-slate-900 hover:bg-primary/5",
              )}
            >
              {opt.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
