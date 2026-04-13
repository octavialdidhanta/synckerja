import { MobileIncomesShell } from "@/mobile/3-dashboard/pages/MobileIncomesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileBankAccountSection } from "../section/MobileBankAccountSection";

export default function MobileBankAccountPage() {
  const { t } = useAppTranslation();
  return (
    <MobileIncomesShell
      title={t("incomes.pageTitle", "Incomes")}
      subtitle={t("incomes.bankAccTitle", "Bank Acc")}
      stretchScrollContent
    >
      <MobileBankAccountSection />
    </MobileIncomesShell>
  );
}
