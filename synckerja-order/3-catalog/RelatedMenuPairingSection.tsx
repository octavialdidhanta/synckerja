import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type CategoryOption = {
  id: string;
  name: string;
};

type Props = {
  categories: CategoryOption[];
  pairings: Record<string, string>;
  disabled?: boolean;
  onChange: (fromCategoryId: string, toCategoryId: string | null) => void;
  /** Sits on the same row as the Related menu card. Pairings open full width underneath. */
  leading?: ReactNode;
};

export function RelatedMenuPairingSection({
  categories,
  pairings,
  disabled,
  onChange,
  leading,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const pairedCount = categories.filter((category) => Boolean(pairings[category.id])).length;

  if (categories.length === 0 && !leading) return null;

  const trigger = (
    <CollapsibleTrigger
      type="button"
      className={cn(
        "flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-muted/30",
        leading ? "h-full rounded-md border border-border" : "border-b",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {t("synckerjaOrder.catalog.relatedMenu", "Related menu")}
          {pairedCount > 0 ? (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">({pairedCount})</span>
          ) : null}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {t(
            "synckerjaOrder.catalog.relatedMenuHint",
            "When a guest checks out items from a category, suggest items from the paired category.",
          )}
        </p>
      </div>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
          open && "rotate-180",
        )}
        aria-hidden
      />
    </CollapsibleTrigger>
  );

  const pairingsGrid = (
    <div
      className={cn(
        "grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3",
        leading ? "mt-3 rounded-md border border-border p-2" : "p-2",
      )}
    >
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{category.name}</span>
                <select
                  className="h-8 w-[9.5rem] shrink-0 rounded-md border border-input bg-background px-1.5 text-xs"
                  disabled={disabled}
                  value={pairings[category.id] ?? ""}
                  onChange={(e) => onChange(category.id, e.target.value || null)}
                >
                  <option value="">
                    {t("synckerjaOrder.catalog.relatedMenuNone", "No suggestion")}
                  </option>
                  {categories
                    .filter((other) => other.id !== category.id)
                    .map((other) => (
                      <option key={other.id} value={other.id}>
                        {other.name}
                      </option>
                    ))}
                </select>
              </label>
            ))}
    </div>
  );

  if (leading) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="grid grid-cols-2 items-stretch gap-3">
          <div className="flex min-w-0 items-end rounded-md border border-border px-3 py-2">{leading}</div>
          {categories.length > 0 ? trigger : <div />}
        </div>
        {categories.length > 0 ? <CollapsibleContent>{pairingsGrid}</CollapsibleContent> : null}
      </Collapsible>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="rounded-md border border-border">
        {trigger}
        <CollapsibleContent>{pairingsGrid}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
