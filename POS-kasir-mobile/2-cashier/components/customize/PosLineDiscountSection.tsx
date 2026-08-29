import { Switch } from "@/shared/components/ui/switch";
import { Input } from "@/shared/components/ui/input";
import type { PosCustomizeDiscount } from "../../hooks/usePosItemCustomizeOptions";

type Props = {
  title: string;
  customAmountLabel: string;
  discounts: PosCustomizeDiscount[];
  selectedId: string | null;
  customAmount: string;
  onSelect: (id: string | null) => void;
  onCustomAmountChange: (value: string) => void;
};

export function PosLineDiscountSection({
  title,
  customAmountLabel,
  discounts,
  selectedId,
  customAmount,
  onSelect,
  onCustomAmountChange,
}: Props) {
  if (discounts.length === 0) return null;
  const selected = discounts.find((d) => d.id === selectedId) ?? null;

  return (
    <section className="border-b border-slate-200 px-4 py-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-800">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {discounts.map((d) => {
          const on = selectedId === d.id;
          const subtitle =
            d.inputConfiguration === "customizable"
              ? customAmountLabel
              : d.amountUnit === "percent"
                ? `${d.amountValue ?? 0}%`
                : `Rp ${(d.amountValue ?? 0).toLocaleString("id-ID")}`;
          return (
            <label
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{d.name}</span>
                <span className="text-xs text-slate-500">{subtitle}</span>
              </span>
              <Switch
                checked={on}
                onCheckedChange={(checked) => onSelect(checked ? d.id : null)}
              />
            </label>
          );
        })}
      </div>
      {selected?.inputConfiguration === "customizable" ? (
        <Input
          className="mt-2 h-11"
          inputMode="numeric"
          value={customAmount}
          onChange={(e) => onCustomAmountChange(e.target.value.replace(/\D/g, ""))}
          placeholder={customAmountLabel}
        />
      ) : null}
    </section>
  );
}
