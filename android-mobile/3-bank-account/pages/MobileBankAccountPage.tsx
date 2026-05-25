import { MobileIncomesShell } from "@/mobile/3-dashboard/pages/MobileIncomesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileBankAccountSection } from "../section/MobileBankAccountSection";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

export default function MobileBankAccountPage() {
  const { t } = useAppTranslation();
  return (
    <MobileIncomesShell
      title={t("incomes.pageTitle", "Incomes")}
      subtitle={t("incomes.bankAccTitle", "Bank Acc")}
      pagePath={MOBILE_PAGE_PATH.incomesTransaction}
      stretchScrollContent
    >
      <MobileBankAccountSection />
    </MobileIncomesShell>
  );
}
