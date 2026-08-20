import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  DEFAULT_INGREDIENT_UNIT_CODE,
  formatIngredientUnit,
  formatIngredientUnitCode,
  INGREDIENT_UNITS,
} from "../lib/ingredientUnits";

export type IngredientUnitSelectProps = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
};

export function IngredientUnitSelect({ value, onChange, disabled }: IngredientUnitSelectProps) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const selected = value || DEFAULT_INGREDIENT_UNIT_CODE;
  const label = formatIngredientUnitCode(selected);

  const units = useMemo(() => INGREDIENT_UNITS, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("ingredient.library.unitSearch", "Search unit...")} />
          <CommandList className="max-h-56">
            <CommandEmpty>{t("ingredient.library.unitEmpty", "No matching units.")}</CommandEmpty>
            <CommandGroup>
              {units.map((unit) => (
                <CommandItem
                  key={unit.code}
                  value={`${unit.name} ${unit.code}`}
                  onSelect={() => {
                    onChange(unit.code);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selected === unit.code ? "opacity-100" : "opacity-0")} />
                  {formatIngredientUnit(unit)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
