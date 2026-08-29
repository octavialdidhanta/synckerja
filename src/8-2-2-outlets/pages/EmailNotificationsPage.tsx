import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { EmailNotificationsSettings, useOperationalEmailSettings } from "@/8-2-4-email-notifications";
import { useOperationalEmailRecipients } from "@/8-2-4-email-notifications/hooks/useOperationalEmailRecipients";
import { OutletsModuleShell } from "../layout/OutletsModuleShell";
import { SettingsWorkspace } from "../layout/SettingsWorkspace";

export default function EmailNotificationsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const settings = useOperationalEmailSettings();
  const recipients = useOperationalEmailRecipients();
  const showContent = useDebouncedReady(
    !(orgBootstrapPending || settings.isLoading || recipients.isLoading),
    200,
  );

  return (
    <OutletsModuleShell showContent={showContent}>
      <SettingsWorkspace>
        <EmailNotificationsSettings />
      </SettingsWorkspace>
    </OutletsModuleShell>
  );
}
