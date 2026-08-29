import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";

type Props = {
  amountDue: number;
};

export function PosQrisAmount({ amountDue }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className="px-4 pt-5 text-center">
      <p className="text-sm text-slate-500">
        {t("pos.payment.qris.totalPrice", "Total Harga")}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-primary">
        {formatStoreCheckoutRp(amountDue)}
      </p>
    </div>
  );
}
