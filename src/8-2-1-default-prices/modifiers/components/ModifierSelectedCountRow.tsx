import { Minus, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { stripToDigits } from "../../utils/formatIdUnitPrice";

type Props = {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
};

export function ModifierSelectedCountRow({ label, value, onChange, min = 1 }: Props) {
  const commit = (raw: number) => {
    const n = Number.isFinite(raw) ? Math.max(min, Math.round(raw)) : min;
    onChange(n);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => commit(value - 1)}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Input
          className="h-8 w-14 text-center"
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => {
            const n = parseInt(stripToDigits(e.target.value) || String(min), 10);
            commit(n);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => commit(value + 1)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
