import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_OUTLET_SELECT_I18N } from "../lib/posOutletSelectCopy";

export type PosOutletOption = {
  id: string;
  name: string;
  address?: string | null;
};

type Props = {
  value: string;
  onChange: (id: string) => void;
  options: PosOutletOption[];
  disabled?: boolean;
  className?: string;
};

/**
 * Tablet POS outlet dropdown (post-2FA gate).
 * Uses theme tokens so trigger fill + white label always render (no arbitrary HSL that JIT may miss).
 */
export function PosOutletSelectField({ value, onChange, options, disabled, className }: Props) {
  const { t } = useAppTranslation();
  const placeholder = t(POS_OUTLET_SELECT_I18N.placeholder, "Select Outlet");
  const noOptions = options.length === 0;

  return (
    <Select
      value={value || undefined}
      onValueChange={onChange}
      disabled={disabled || noOptions}
    >
      <SelectTrigger
        className={cn(
          "h-12 w-full rounded-lg border-0 px-4 text-base font-medium shadow-none",
          "bg-primary text-primary-foreground",
          "focus:ring-2 focus:ring-primary/40 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-70",
          "[&>span]:line-clamp-1 [&>span]:text-left",
          className,
        )}
        aria-label={placeholder}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {row.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
