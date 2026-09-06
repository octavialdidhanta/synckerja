import { ScanBarcode } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
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
    <div className={POS_PANEL.formRow}>
      <span className={POS_PANEL.rowLabel}>{t(POS_CASHIER_I18N.setupSku, "SKU")}</span>
      <div className="flex min-w-0 max-w-[62%] flex-1 items-center justify-end gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t(POS_CASHIER_I18N.setupSku, "SKU")}
          disabled={disabled}
          className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 text-right shadow-none focus-visible:ring-0"
        />
        <button
          type="button"
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-primary transition hover:bg-primary/10 disabled:opacity-40"
          disabled={disabled}
          onClick={onOpenScan}
          aria-label={t(POS_CASHIER_I18N.setupScanSku, "Scan SKU")}
        >
          <ScanBarcode className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
