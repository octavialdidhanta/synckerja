import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent } from "@/shared/components/ui/popover";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  ingredientCategoryChoices,
  UNCATEGORIZED_CATEGORY_VALUE,
  type IngredientCategoryChoice,
} from "../lib/ingredientCategoryChoices";
import { CreateIngredientCategoryDialog } from "./CreateIngredientCategoryDialog";

export type IngredientCategoryComboboxProps = {
  value: string;
  categories: Array<{ id: string; name: string }>;
  outletId: string;
  disabled?: boolean;
  onChange: (categoryId: string) => void;
};

/**
 * Typeable category field: type to filter; when no category matches (or none exist yet)
 * a "create new" row opens a modal with a Save button.
 */
export function IngredientCategoryCombobox({
  value,
  categories,
  outletId,
  disabled,
  onChange,
}: IngredientCategoryComboboxProps) {
  const { t } = useAppTranslation();
  const listId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uncategorizedLabel = t("ingredient.library.uncategorized", "Uncategorized");
  const selected = categories.find((row) => row.id === value);
  const selectedLabel = selected?.name ?? uncategorizedLabel;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");

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

  const openList = () => {
    if (open) return;
    // Start with an empty query so every category is listed; the current value stays as placeholder.
    setQuery("");
    setOpen(true);
  };

  const choose = (choice: IngredientCategoryChoice) => {
    if (choice.kind === "uncategorized") {
      onChange(UNCATEGORIZED_CATEGORY_VALUE);
    } else if (choice.kind === "existing") {
      onChange(choice.id);
    } else {
      setCreateName(choice.name.trim());
      setCreateOpen(true);
    }
    setOpen(false);
    inputRef.current?.blur();
  };

  const labelFor = (choice: IngredientCategoryChoice) => {
    if (choice.kind === "uncategorized") return uncategorizedLabel;
    if (choice.kind === "existing") return choice.name;
    if (!choice.name) return t("ingredient.library.categoryCreateBlank", "Create new category");
    return t("ingredient.library.categoryCreateNew", "{{name}} (create new)", { name: choice.name });
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          <div ref={anchorRef} className="relative">
            <Input
              ref={inputRef}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              value={open ? query : selectedLabel}
              disabled={disabled}
              placeholder={open ? selectedLabel : uncategorizedLabel}
              className="pr-8"
              onFocus={openList}
              onClick={openList}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  return;
                }
                if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
                  event.preventDefault();
                  openList();
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
                  if (choice) choose(choice);
                }
              }}
            />
            <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          </div>
        </PopoverPrimitive.Anchor>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            // Clicking the input itself must not close (and reset) the list while typing.
            const target = event.target as Node | null;
            if (target && anchorRef.current?.contains(target)) event.preventDefault();
          }}
        >
          <div id={listId} role="listbox" className="max-h-56 overflow-y-auto">
            {choices.map((choice, index) => (
              <button
                key={choice.kind === "existing" ? choice.id : choice.kind === "create" ? `create:${choice.name}` : "uncategorized"}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  choice.kind === "create" && "font-medium text-primary",
                  index === activeIndex && "bg-accent text-accent-foreground",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(choice)}
              >
                {choice.kind === "create" ? <Plus className="h-4 w-4 shrink-0" /> : null}
                <span className="truncate">{labelFor(choice)}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <CreateIngredientCategoryDialog
        open={createOpen}
        initialName={createName}
        outletId={outletId}
        categories={categories}
        onOpenChange={setCreateOpen}
        onSaved={onChange}
      />
    </>
  );
}
