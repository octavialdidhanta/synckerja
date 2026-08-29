type Props = {
  title: string;
  quantity: number;
  min?: number;
  max?: number | null;
  onChange: (qty: number) => void;
};

export function PosQtyStepper({ title, quantity, min = 1, max, onChange }: Props) {
  const atMin = quantity <= min;
  const atMax = max != null && quantity >= max;
  return (
    <section className="border-b border-slate-200 px-4 py-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-800">
        {title}
      </p>
      <div className="flex items-stretch gap-2">
        <div className="flex h-12 min-w-[4.5rem] items-center justify-center rounded-md border border-slate-200 bg-white text-lg font-semibold tabular-nums">
          {quantity}
        </div>
        <div className="flex h-12 flex-1 overflow-hidden rounded-md border border-slate-200 bg-white">
          <button
            type="button"
            className="flex-1 text-xl font-semibold text-slate-700 disabled:opacity-40"
            disabled={atMin}
            onClick={() => onChange(Math.max(min, quantity - 1))}
          >
            −
          </button>
          <div className="w-px bg-slate-200" />
          <button
            type="button"
            className="flex-1 text-xl font-semibold text-slate-700 disabled:opacity-40"
            disabled={atMax}
            onClick={() =>
              onChange(max != null ? Math.min(max, quantity + 1) : quantity + 1)
            }
          >
            +
          </button>
        </div>
      </div>
    </section>
  );
}
