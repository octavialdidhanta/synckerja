import { cn } from "@/shared/lib/utils";

type Props = {
  title: string;
  hint: string;
  options: Array<{ id: string; label: string; disabled?: boolean }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function PosVariantSection({
  title,
  hint,
  options,
  selectedId,
  onSelect,
}: Props) {
  return (
    <section className="border-b border-slate-200 px-4 py-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-800">
        {title}
        <span className="ml-1 font-normal text-slate-400">| {hint}</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const active = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={opt.disabled}
              onClick={() => onSelect(opt.id)}
              className={cn(
                "min-h-12 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                opt.disabled && "cursor-not-allowed opacity-40",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/40 bg-white text-slate-900 hover:bg-primary/5",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
