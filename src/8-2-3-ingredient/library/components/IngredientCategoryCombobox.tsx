import { useEffect, useId, useMemo, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent } from "@/shared/components/ui/popover";
import { Input } from "@/shared/components/ui/input";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useCatalogIngredientCategories } from "../../categories/hooks/useCatalogIngredientCategories";
import {
  ingredientCategoryChoices,
  UNCATEGORIZED_CATEGORY_VALUE,
  type IngredientCategoryChoice,
} from "../lib/ingredientCategoryChoices";

export type IngredientCategoryComboboxProps = {
  value: string;
  categories: Array<{ id: string; name: string }>;
  outletId: string;
  disabled?: boolean;
  onChange: (categoryId: string) => void;
};

export function IngredientCategoryCombobox({
  value,
  categories,
  outletId,
  disabled,
  onChange,
}: IngredientCategoryComboboxProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save } = useCatalogIngredientCategories();
  const listId = useId();
  const uncategorizedLabel = t("ingredient.library.uncategorized", "Uncategorized");
  const selected = categories.find((row) => row.id === value);
  const selectedLabel = selected?.name ?? uncategorizedLabel;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [creating, setCreating] = useState(false);

  const choices = useMemo(
    () => ingredientCategoryChoices({
      query: open ? query : "",
      categories,
      uncategorizedLabel,
    }),
    [categories, open, query, uncategorizedLabel],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const choose = async (choice: IngredientCategoryChoice) => {
    if (choice.kind === "uncategorized") {
      onChange(UNCATEGORIZED_CATEGORY_VALUE);
      setOpen(false);
      return;
    }
    if (choice.kind === "existing") {
      onChange(choice.id);
      setOpen(false);
      return;
    }
    const name = choice.name.trim();
    if (!name || creating) return;
    if (!outletId) {
      toast({
        title: t("ingredient.library.outletRequired", "Select an outlet first."),
        variant: "destructive",
      });
      return;
    }
    const already = categories.find((row) => row.name.trim().toLowerCase() === name.toLowerCase());
    if (already) {
      onChange(already.id);
      setOpen(false);
      return;
    }
    setCreating(true);
    try {
      const saved = await save({ name, outlet_id: outletId });
      onChange(saved.id);
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast({
        title:
          message === "ingredient_category_duplicate"
            ? t("ingredient.categories.duplicateName", "A category with this name already exists.")
            : t("ingredient.categories.saveFailed", "Could not save category."),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const labelFor = (choice: IngredientCategoryChoice) => {
    if (choice.kind === "uncategorized") return uncategorizedLabel;
    if (choice.kind === "existing") return choice.name;
    return t("ingredient.library.categoryCreateNew", "{{name}} (create new)", { name: choice.name });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className="relative">
          <Input
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            value={open ? query : selectedLabel}
            disabled={disabled || creating}
            placeholder={uncategorizedLabel}
            className="pr-8"
            onFocus={() => {
              setQuery(value === UNCATEGORIZED_CATEGORY_VALUE ? "" : selectedLabel);
              setOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                return;
              }
              if (!open || choices.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % choices.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => (index - 1 + choices.length) % choices.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                const choice = choices[activeIndex];
                if (choice) void choose(choice);
              }
            }}
          />
          <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div id={listId} role="listbox" className="max-h-56 overflow-y-auto">
          {choices.map((choice, index) => (
            <button
              key={choice.kind === "existing" ? choice.id : choice.kind === "create" ? `create:${choice.name}` : "uncategorized"}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                "flex w-full rounded-sm px-2 py-1.5 text-left text-sm",
                index === activeIndex && "bg-accent text-accent-foreground",
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void choose(choice)}
            >
              {labelFor(choice)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
