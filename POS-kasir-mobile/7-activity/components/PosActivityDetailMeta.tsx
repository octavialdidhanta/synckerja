import type { LucideIcon } from "lucide-react";
import { Clock, FileText, UserRound, Wallet } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";

type MetaRow = {
  icon: LucideIcon;
  label: string;
  value: string;
};

type Props = {
  paymentMethod: string;
  receiptNumber: string;
  purchaseTime: string;
  customer: string;
};

export function PosActivityDetailMeta({
  paymentMethod,
  receiptNumber,
  purchaseTime,
  customer,
}: Props) {
  const { t } = useAppTranslation();

  const rows: MetaRow[] = [
    {
      icon: Wallet,
      label: t(POS_ACTIVITY_I18N.paymentMethod, "Payment method"),
      value: paymentMethod,
    },
    {
      icon: FileText,
      label: t(POS_ACTIVITY_I18N.receiptNumber, "Receipt number"),
      value: receiptNumber,
    },
    {
      icon: Clock,
      label: t(POS_ACTIVITY_I18N.purchaseTime, "Purchase time"),
      value: purchaseTime,
    },
    {
      icon: UserRound,
      label: t(POS_ACTIVITY_I18N.customer, "Customer"),
      value: customer,
    },
  ];

  return (
    <section>
      <p className={POS_PANEL.sectionTitle}>
        {t(POS_ACTIVITY_I18N.detailSection, "DETAIL")}
      </p>
      <div className={POS_PANEL.card}>
        <ul>
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.label} className={POS_PANEL.row}>
                <span className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-slate-500">{row.label}</span>
                    <span className="block text-sm font-medium text-slate-900">
                      {row.value}
                    </span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
