import { useTranslation } from 'react-i18next';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { BlibliSellerConnectPanel } from '@/6-0-ecommerce-chat/components/BlibliSellerConnectPanel';
import { BlibliOrdersModuleShell } from '../layout/BlibliOrdersModuleShell';

/**
 * Settings for Blibli Shop — same connect panel / edge `blibli-seller-config` /
 * DB connections as E-Commerce Chat → Blibli tab.
 */
export default function BlibliOrdersSettingsPage() {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();

  return (
    <BlibliOrdersModuleShell>
      {/* Natural height (no min-h viewport stretch) so long form scrolls cleanly above OS taskbar */}
      <div className="flex w-full min-w-0 max-w-3xl flex-col">
        <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              {t('operations.blibliOrders.settingsTitle')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t('operations.blibliOrders.settingsDesc')}
            </p>
          </div>
          <BlibliSellerConnectPanel organizationId={organizationId} embedded />
        </div>
      </div>
      {/* Extra bottom clearance so Save & connect is not covered by OS / browser chrome */}
      <div
        className="h-16 flex-shrink-0 sm:h-20 [@media(max-height:900px)]:h-24"
        aria-hidden
      />
    </BlibliOrdersModuleShell>
  );
}
