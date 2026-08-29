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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  INDONESIA_BANKS,
  normalizeIndonesiaBankName,
  resolveIndonesiaBank,
} from "../lib/indonesiaBanks";

type Props = {
  value: string;
  onChange: (bankName: string) => void;
  disabled?: boolean;
  /** Extra classes for the trigger button (e.g. h-8 for dense forms). */
  triggerClassName?: string;
};

export function BankNameSelect({
  value,
  onChange,
  disabled,
  triggerClassName,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => resolveIndonesiaBank(value), [value]);
  const displayLabel = selected?.name || value.trim() || null;

  const pick = (bankName: string) => {
    onChange(normalizeIndonesiaBankName(bankName) || bankName);
    setOpen(false);
  };

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between font-normal",
            triggerClassName,
          )}
        >
          <span
            className={cn("truncate", !displayLabel && "text-muted-foreground")}
          >
            {displayLabel ??
              t("settings.bankAccount.selectBank", "Select Bank")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[80] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput
            placeholder={t("settings.bankAccount.searchBank", "Search bank…")}
          />
          <CommandList>
            <CommandEmpty>
              {t("settings.bankAccount.noBankFound", "No bank found")}
            </CommandEmpty>
            <CommandGroup>
              {INDONESIA_BANKS.map((bank) => {
                const isActive =
                  selected?.id === bank.id || value === bank.name;
                return (
                  <CommandItem
                    key={bank.id}
                    value={`${bank.name} ${bank.id}`}
                    className="w-full justify-start text-left"
                    onMouseDown={(e) => {
                      // Keep focus so click registers inside Sheet/Dialog
                      e.preventDefault();
                    }}
                    onSelect={() => pick(bank.name)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {bank.name}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
