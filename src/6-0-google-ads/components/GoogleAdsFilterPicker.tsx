import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { GOOGLE_ADS_FILTER_ALL } from "@/google-ads/metrics/filterTypes";
import {
  findSelectedGoogleAdsFilterOption,
  type GoogleAdsFilterOptionMatch,
} from "@/google-ads/metrics/findSelectedGoogleAdsFilterOption";

export type GoogleAdsFilterPickerOption = GoogleAdsFilterOptionMatch;

type GoogleAdsFilterPickerProps = {
  label: string;
  countLabel: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel?: string;
  allLabel?: string;
  viewAllLabel?: string;
  value: string | null;
  options: GoogleAdsFilterPickerOption[];
  isLoading?: boolean;
  disabled?: boolean;
  showAllOption?: boolean;
  triggerClassName?: string;
  onChange: (id: string | null) => void;
};

export function GoogleAdsFilterPicker({
  label,
  countLabel,
  placeholder,
  searchPlaceholder,
  emptyLabel = "No results.",
  allLabel,
  viewAllLabel,
  value,
  options,
  isLoading,
  disabled,
  showAllOption = true,
  triggerClassName,
  onChange,
}: GoogleAdsFilterPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = findSelectedGoogleAdsFilterOption(value, options);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            "h-auto min-h-9 min-w-[min(200px,42vw)] max-w-[min(320px,55vw)] flex-col items-start gap-0 px-3 py-1.5 text-left font-normal",
            value && value !== GOOGLE_ADS_FILTER_ALL && "border-brand-blue/30 bg-brand-blue/[0.04]",
            triggerClassName,
          )}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {countLabel}
          </span>
          <span className="flex w-full min-w-0 items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {isLoading ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  …
                </span>
              ) : selected ? (
                selected.name
              ) : showAllOption && (value === GOOGLE_ADS_FILTER_ALL || !value) ? (
                allLabel
              ) : (
                placeholder
              )}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(400px,92vw)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList
            className={cn(
              "scrollbar-hide seamless-scroll nested-scroll-touch-chain max-h-[min(240px,45vh)]",
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {showAllOption && allLabel ? (
              <>
                <CommandGroup>
                  <CommandItem
                    value={allLabel}
                    onSelect={() => {
                      onChange(null);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !value || value === GOOGLE_ADS_FILTER_ALL ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="font-medium">{viewAllLabel ?? allLabel}</span>
                  </CommandItem>
                </CommandGroup>
                {options.length > 0 ? <CommandSeparator /> : null}
              </>
            ) : null}
            <CommandGroup heading={label}>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.name} ${opt.status ?? ""}`}
                  onSelect={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === opt.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{opt.name}</p>
                    {opt.status ? (
                      <p className="truncate text-xs text-muted-foreground">{opt.status}</p>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
