import { useEffect, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { formatIngredientStockQty } from "../lib/ingredientStockStatus";
import { parseRecipeQtyText } from "../lib/recipeQtyText";

export type RecipeQtyInputProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
};

function display(value: number): string {
  return value > 0 ? formatIngredientStockQty(value).replace(".", ",") : "";
}

/**
 * Quantity field for recipe lines. Keeps the typed text while editing so "0", "0," and "1." stay
 * on screen (a number-only state would drop them), and accepts both "0,15" and "0.15".
 */
export function RecipeQtyInput({ value, onChange, className, ...rest }: RecipeQtyInputProps) {
  const [text, setText] = useState(() => display(value));

  // Follow outside changes (another line removed, form reset) without fighting the typed text.
  useEffect(() => {
    setText((current) => {
      const parsed = parseRecipeQtyText(current);
      return (parsed ?? 0) === value ? current : display(value);
    });
  }, [value]);

  return (
    <Input
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        if (!/^[\d\s.,]*$/.test(next)) return;
        setText(next);
        onChange(parseRecipeQtyText(next) ?? 0);
      }}
      onBlur={() => setText(display(value))}
      className={cn("h-8 w-24", className)}
      inputMode="decimal"
      {...rest}
    />
  );
}
