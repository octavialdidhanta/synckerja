import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { FieldInfoTip } from "@/8-2-1-default-prices/components/FieldInfoTip";

type Props = {
  checked: boolean;
  disabled?: boolean;
  outletName?: string | null;
  onCheckedChange: (checked: boolean) => void;
  embedded?: boolean;
};

export function ProductOrderPublishSection({
  checked,
  disabled,
  outletName,
  onCheckedChange,
  embedded,
}: Props) {
  const { t } = useAppTranslation();
  const label = outletName?.trim() || t("outlets.filter.label", "Outlet");

  return (
    <section className={embedded ? "" : "rounded-lg border p-4"}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="text-sm font-semibold">
            {t("synckerjaOrder.productPublish.title", "Synckerja Order")}
          </h3>
          <FieldInfoTip
            text={
              disabled
                ? t(
                    "synckerjaOrder.productPublish.disabledHint",
                    "Assign this outlet first. Guests only see items published for outlets that sell the product.",
                  )
                : t("synckerjaOrder.productPublish.hint", "Show this item on the QR menu for {{outlet}}.", {
                    outlet: label,
                  })
            }
          />
        </div>
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-label={t("synckerjaOrder.productPublish.title", "Synckerja Order")}
        />
      </div>
    </section>
  );
}
