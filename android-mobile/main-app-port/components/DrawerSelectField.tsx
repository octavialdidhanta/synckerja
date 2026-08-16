import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/mobile-app/components/ui/drawer';
import { Check, ChevronDown } from 'lucide-react';

export type DrawerSelectOption = { value: string; label: string };

export function DrawerSelectField({
  open,
  onOpenChange,
  title,
  value,
  placeholder,
  options,
  onSelect,
  disabled = false,
  overlayClassName,
  contentClassName,
  triggerClassName,
  wrapLabel = false,
  emptyText,
  searchPlaceholder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: string;
  placeholder: string;
  options: DrawerSelectOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  overlayClassName?: string;
  contentClassName?: string;
  triggerClassName?: string;
  wrapLabel?: boolean;
  emptyText?: string;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState('');
  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchPlaceholder || !q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query, searchPlaceholder]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-10 w-full justify-between text-sm font-normal',
            wrapLabel && 'h-auto min-h-10 py-2',
            triggerClassName,
          )}
          disabled={disabled}
        >
          <span
            className={cn(
              'min-w-0 text-left',
              wrapLabel ? 'whitespace-normal break-words line-clamp-2' : 'truncate',
              value ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {selectedLabel}
          </span>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        overlayClassName={cn('z-[60]', overlayClassName)}
        className={cn('z-[60] max-h-[85dvh] flex flex-col', contentClassName)}
      >
        <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
          <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">Select {title}</DrawerDescription>
        </DrawerHeader>
        {searchPlaceholder ? (
          <div className="px-4 pb-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10"
            />
          </div>
        ) : null}
        <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              {emptyText || 'Tidak ada opsi'}
            </p>
          ) : (
            filteredOptions.map((opt) => {
              const active = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onSelect(opt.value);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0',
                    active ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted/50',
                  )}
                >
                  <span
                    className={cn(
                      'min-w-0',
                      wrapLabel ? 'whitespace-normal break-words' : 'truncate',
                    )}
                  >
                    {opt.label}
                  </span>
                  {active ? <Check className="h-4 w-4 flex-shrink-0 text-primary" /> : null}
                </button>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
