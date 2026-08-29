import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/hooks/use-toast";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";
import {
  appendPosCustomKeypadDigit,
  formatPosCustomKeypadDisplay,
  parsePosCustomKeypadDigits,
  POS_CUSTOM_DESCRIPTION_MIN_LEN,
} from "../../lib/posCustomAmount";

type Props = {
  onAdd: (amount: number, description: string) => void;
  disabled?: boolean;
};

const KEYS: string[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["0", "00"],
];

export function PosCustomKeypad({ onAdd, disabled }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const [digits, setDigits] = useState("");
  const [description, setDescription] = useState("");
  const amount = parsePosCustomKeypadDigits(digits);
  const desc = description.trim();
  const descOk = desc.length >= POS_CUSTOM_DESCRIPTION_MIN_LEN;
  const canAdd = amount > 0 && descOk && !disabled;

  const press = (key: string) => {
    if (disabled) return;
    setDigits((prev) => appendPosCustomKeypadDigit(prev, key));
  };

  const handleAdd = () => {
    if (disabled) return;
    if (!(amount > 0)) {
      toast({
        title: t(POS_CASHIER_I18N.customEmptyAmount, "Enter an amount greater than zero."),
      });
      return;
    }
    if (!descOk) {
      toast({
        title:
          desc.length === 0
            ? t(
                POS_CASHIER_I18N.customDescriptionRequired,
                "Enter a reason for this cash receipt",
              )
            : t(
                POS_CASHIER_I18N.customDescriptionTooShort,
                "Reason must be at least 3 characters",
              ),
      });
      return;
    }
    onAdd(amount, desc);
    setDigits("");
    setDescription("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white px-4 pb-3 pt-4">
      <div className="mb-3 flex-shrink-0">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled}
          placeholder={t(
            POS_CASHIER_I18N.customDescriptionPlaceholder,
            "e.g. Broken glass replacement",
          )}
          className="h-11"
          maxLength={120}
        />
      </div>

      <div className="mb-4 flex flex-shrink-0 justify-end">
        <p className="text-3xl font-semibold tabular-nums text-sky-600 sm:text-4xl">
          {formatPosCustomKeypadDisplay(digits)}
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-md flex-1 grid-cols-4 gap-2 sm:gap-3">
        <div className="col-span-3 grid grid-rows-4 gap-2 sm:gap-3">
          {KEYS.map((row) => (
            <div
              key={row.join("-")}
              className={cn("grid gap-2 sm:gap-3", row.length === 2 ? "grid-cols-2" : "grid-cols-3")}
            >
              {row.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => press(key)}
                  className="rounded-lg bg-slate-100 text-2xl font-medium text-slate-800 transition hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 sm:text-3xl"
                >
                  {key}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="grid grid-rows-4 gap-2 sm:gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => press("C")}
            aria-label={t(POS_CASHIER_I18N.customClear, "Clear")}
            className="rounded-lg bg-slate-100 text-xl font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
          >
            C
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => press("Del")}
            aria-label={t(POS_CASHIER_I18N.customDelete, "Delete")}
            className="rounded-lg bg-slate-100 text-lg font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
          >
            Del
          </button>
          <button
            type="button"
            disabled={!canAdd}
            onClick={handleAdd}
            aria-label={t(POS_CASHIER_I18N.customAdd, "Add other cash receipt")}
            className={cn(
              "row-span-2 flex items-center justify-center rounded-lg bg-red-500 text-white transition",
              "hover:bg-red-600 active:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <Plus className="h-10 w-10 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}
