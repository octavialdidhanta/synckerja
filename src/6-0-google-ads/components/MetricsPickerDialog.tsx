import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { MetricCatalogCategory } from "@/google-ads/metrics/types";

const MAX_METRICS = 30;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: MetricCatalogCategory[];
  selectedKeys: string[];
  onApply: (keys: string[]) => void;
  isSaving?: boolean;
};

export function MetricsPickerDialog({
  open,
  onOpenChange,
  categories,
  selectedKeys,
  onApply,
  isSaving,
}: Props) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>(selectedKeys);

  useEffect(() => {
    if (open) setDraft(selectedKeys);
  }, [open, selectedKeys]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        metrics: cat.metrics.filter(
          (m) =>
            m.label.toLowerCase().includes(q) ||
            m.key.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.metrics.length > 0);
  }, [categories, search]);

  const toggle = (key: string, checked: boolean) => {
    setDraft((prev) => {
      if (checked) {
        if (prev.includes(key)) return prev;
        if (prev.length >= MAX_METRICS) return prev;
        return [...prev, key];
      }
      return prev.filter((k) => k !== key);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 border-l p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 space-y-2 border-b border-border px-4 py-4 pr-12 text-left">
          <SheetTitle>Metrics</SheetTitle>
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            {draft.length} / {MAX_METRICS} selected
          </p>
        </SheetHeader>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TooltipProvider delayDuration={300}>
            {filteredCategories.map((cat) => (
              <div key={cat.id} className="mb-3">
                <p className="px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground">
                  {cat.label}
                </p>
                <ul className="space-y-0.5">
                  {cat.metrics.map((m) => {
                    const checked = draft.includes(m.key);
                    const disabled = !checked && draft.length >= MAX_METRICS;
                    return (
                      <li
                        key={m.key}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                      >
                        <Checkbox
                          id={`metric-${m.key}`}
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(v) => toggle(m.key, v === true)}
                        />
                        <Label
                          htmlFor={`metric-${m.key}`}
                          className="flex-1 cursor-pointer text-sm font-normal"
                        >
                          {m.label}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={m.description}
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs text-xs">
                            {m.description}
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </TooltipProvider>
        </div>

        <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSaving || draft.length === 0}
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
