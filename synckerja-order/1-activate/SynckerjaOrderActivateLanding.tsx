import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SYNCKERJA_ORDER_I18N } from "@/synckerja-order/shared/lib/orderCopy";

const TERMS_VERSION = "2026-08-30";

type Props = {
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
  onActivate: () => void;
  busy?: boolean;
};

export function SynckerjaOrderActivateLanding({
  accepted,
  onAcceptedChange,
  onActivate,
  busy,
}: Props) {
  const { t } = useAppTranslation();
  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          {t(SYNCKERJA_ORDER_I18N.activateTitle, "Activate Synckerja Order")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t(
            SYNCKERJA_ORDER_I18N.activateBody,
            "Publish a guest QR menu per outlet. Guests order from their phone without signing in. Dine-in can pay with QRIS now or send an open bill to the cashier.",
          )}
        </p>
        <div className="mt-6 max-h-64 overflow-y-auto rounded-md border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
          <p className="font-medium">
            {t("synckerjaOrder.activate.termsHeading", "Organization terms")}
          </p>
          <p className="mt-2 text-muted-foreground">
            {t(
              "synckerjaOrder.activate.termsBody",
              "You confirm this organization owns the menu, pricing, and payment account shown to guests. Public links identify a single outlet by its public code. Do not share codes across brands. Pickup order-ahead is not available yet.",
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">v{TERMS_VERSION}</p>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <Checkbox
            checked={accepted}
            onCheckedChange={(v) => onAcceptedChange(v === true)}
          />
          {t(SYNCKERJA_ORDER_I18N.activateAccept, "I agree to the terms")}
        </label>
        <div className="mt-4">
          <Button type="button" disabled={!accepted || busy} onClick={onActivate}>
            {t(SYNCKERJA_ORDER_I18N.activateCta, "Continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const SYNCKERJA_ORDER_TERMS_VERSION = TERMS_VERSION;
