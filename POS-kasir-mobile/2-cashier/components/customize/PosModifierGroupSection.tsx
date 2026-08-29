import { cn } from "@/shared/lib/utils";
import type { PosCustomizeModifierGroup } from "../../hooks/usePosItemCustomizeOptions";

type Props = {
  group: PosCustomizeModifierGroup;
  pickOneLabel: string;
  pickManyLabel: string;
  outOfStockLabel: string;
  selectedIds: string[];
  onToggle: (optionId: string) => void;
};

export function PosModifierGroupSection({
  group,
  pickOneLabel,
  pickManyLabel,
  outOfStockLabel,
  selectedIds,
  onToggle,
}: Props) {
  const hint = group.singleSelect ? pickOneLabel : pickManyLabel;
  return (
    <section className="border-b border-slate-200 px-4 py-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-800">
        {group.name}
        <span className="ml-1 font-normal text-slate-400">| {hint}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {group.options.map((opt) => {
          const active = selectedIds.includes(opt.id);
          const disabled = opt.outOfStock;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onToggle(opt.id);
              }}
              className={cn(
                "min-h-12 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                disabled
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/40 bg-white text-slate-900 hover:bg-primary/5",
              )}
            >
              {opt.name}
              {disabled ? (
                <span className="mt-0.5 block text-[11px] opacity-80">
                  {outOfStockLabel}
                </span>
              ) : opt.extraPrice > 0 ? (
                <span className="mt-0.5 block text-[11px] opacity-80">
                  +{opt.extraPrice.toLocaleString("id-ID")}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
