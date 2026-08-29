import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useState } from "react";

type Props = {
  onCancel: () => void;
  cancelDisabled?: boolean;
};

export function PosQrisHeader({ onCancel, cancelDisabled }: Props) {
  const { t } = useAppTranslation();
  const [gpnFailed, setGpnFailed] = useState(false);

  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <img
          src="/iconQris.png"
          alt="QRIS"
          className="h-9 w-auto max-w-[140px] object-contain object-left"
        />
        {gpnFailed ? (
          <span className="text-xs font-semibold tracking-wide text-slate-500">GPN</span>
        ) : (
          <img
            src="/Gerbang_Pembayaran_Nasional_logo.svg"
            alt="Gerbang Pembayaran Nasional"
            className="h-8 w-auto max-w-[72px] object-contain"
            onError={() => setGpnFailed(true)}
          />
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 border-primary/40 px-4 text-primary"
        disabled={cancelDisabled}
        onClick={onCancel}
      >
        {t("pos.payment.qris.cancel", "Cancel")}
      </Button>
    </div>
  );
}
