import { cn } from '@/lib/utils';
import { Button } from '@/features/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/mobile/components/ui/drawer';
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: string;
  placeholder: string;
  options: DrawerSelectOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full h-10 justify-between text-sm font-normal"
          disabled={disabled}
        >
          <span className={cn('truncate', value ? 'text-foreground' : 'text-muted-foreground')}>
            {selectedLabel}
          </span>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>
      </DrawerTrigger>
      <DrawerContent overlayClassName="z-[60]" className="z-[60] max-h-[85dvh] flex flex-col">
        <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
          <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">Select {title}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
          {options.map((opt) => {
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
                  'flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0',
                  active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'
                )}
              >
                <span className="truncate">{opt.label}</span>
                {active ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
