import { useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PaymentMethodsDisplay } from "../lib/paymentMethodsTypes";
import {
  PaymentMethodsCategoryBlock,
  PaymentMethodsGrandTotalRow,
} from "./PaymentMethodsCategoryBlock";
import { PaymentMethodsReconciliationNote } from "./PaymentMethodsReconciliationNote";

type Props = {
  display: PaymentMethodsDisplay;
};

function defaultExpandedCategory(display: PaymentMethodsDisplay): string | null {
  const withData = display.categories.find(
    (cat) => cat.transactionCount > 0 || cat.totalCollected > 0.01,
  );
  return withData?.category ?? display.categories[0]?.category ?? null;
}

export function PaymentMethodsTable({ display }: Props) {
  const { t } = useAppTranslation();
  const [expanded, setExpanded] = useState<string | null>(() =>
    defaultExpandedCategory(display),
  );

  const toggle = (category: string) => {
    setExpanded((prev) => (prev === category ? null : category));
  };

  if (display.categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("reports.paymentMethods.empty", "No payments recorded in this period.")}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-medium">
                {t("reports.paymentMethods.colMethod", "Payment Method")}
              </th>
              <th className="px-3 py-2.5 text-right font-medium">
                {t("reports.paymentMethods.colTransactions", "Number of Transactions")}
              </th>
              <th className="px-3 py-2.5 text-right font-medium">
                {t("reports.paymentMethods.colCollected", "Total Collected")}
              </th>
            </tr>
          </thead>
          <tbody>
            {display.categories.map((block) => (
              <PaymentMethodsCategoryBlock
                key={block.category}
                block={block}
                expanded={expanded === block.category}
                onToggle={() => toggle(block.category)}
              />
            ))}
            <PaymentMethodsGrandTotalRow
              transactionCount={display.grandTotal.transactionCount}
              totalCollected={display.grandTotal.totalCollected}
            />
          </tbody>
        </table>
      </div>
      <PaymentMethodsReconciliationNote display={display} />
    </div>
  );
}
