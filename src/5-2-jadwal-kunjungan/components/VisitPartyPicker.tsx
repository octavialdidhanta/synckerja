import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/shared/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import type { VisitPartyOption } from '@/shared/hooks/useVisitPartyOptions';

type Props = {
  value: string;
  onSelect: (party: VisitPartyOption) => void;
  leadParties: VisitPartyOption[];
  clientParties: VisitPartyOption[];
  selected?: VisitPartyOption;
  isLoading?: boolean;
  placeholder?: string;
  triggerClassName?: string;
};

export function VisitPartyPicker({
  value,
  onSelect,
  leadParties,
  clientParties,
  selected,
  isLoading,
  placeholder = 'Pilih lead atau klien',
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const label = selected?.label ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={isLoading}
          className={cn('mt-1 h-10 w-full justify-between font-normal', triggerClassName)}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari nama…" />
          <CommandList className="max-h-[min(60vh,280px)]">
            <CommandEmpty>{isLoading ? 'Memuat…' : 'Tidak ada hasil.'}</CommandEmpty>
            {leadParties.length > 0 ? (
              <CommandGroup heading="Lead">
                {leadParties.map((party) => (
                  <CommandItem
                    key={party.key}
                    value={`${party.label} ${party.key}`}
                    onSelect={() => {
                      onSelect(party);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === party.key ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{party.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {leadParties.length > 0 && clientParties.length > 0 ? <CommandSeparator /> : null}
            {clientParties.length > 0 ? (
              <CommandGroup heading="Klien">
                {clientParties.map((party) => (
                  <CommandItem
                    key={party.key}
                    value={`${party.label} ${party.key}`}
                    onSelect={() => {
                      onSelect(party);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === party.key ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{party.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
