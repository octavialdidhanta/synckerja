import { ScanBarcode } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_CASHIER_I18N } from "../../../lib/posCashierCopy";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onOpenScan: () => void;
  disabled?: boolean;
};

export function PosCreateItemSkuField({ value, onChange, onOpenScan, disabled }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(POS_CASHIER_I18N.setupSku, "SKU")}
        disabled={disabled}
        className="h-11 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-10 w-10 shrink-0 text-primary"
        disabled={disabled}
        onClick={onOpenScan}
        aria-label={t(POS_CASHIER_I18N.setupScanSku, "Scan SKU")}
      >
        <ScanBarcode className="h-5 w-5" />
      </Button>
    </div>
  );
}
