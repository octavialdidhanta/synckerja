import { useTranslation } from "react-i18next";
import { XenditSettingsPanel } from "@/4-0-xendit-settings/components/XenditSettingsPanel";
import { XenditConnectPageWrapper } from "@/4-1-transaction/xendit/components/XenditConnectPageWrapper";
import { XenditConnectTabSkeleton } from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

export default function XenditConnectPage() {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { isLoading, data } = useXenditOrgSettings(organizationId);

  if (isLoading && !data) {
    return <XenditConnectTabSkeleton />;
  }

  const enabled = Boolean(data?.account?.is_enabled);
  const hasSubAccount = (data?.subAccounts?.length ?? 0) > 0;
  const modeLabel = data?.isSandbox
    ? t("xendit.sandboxMode", "Sandbox mode")
    : t("xendit.productionMode", "Production");

  const footerLeft = enabled
    ? hasSubAccount
      ? t("xendit.connect.footerConnected", "Xendit active · Akun connected")
      : t("xendit.connect.footerEnabled", "Xendit active · Akun not created")
    : t("xendit.connect.footerDisabled", "Xendit disabled");

  return (
    <XenditConnectPageWrapper footerLeft={footerLeft} footerRight={modeLabel}>
      <XenditSettingsPanel layout="page" />
    </XenditConnectPageWrapper>
  );
}
