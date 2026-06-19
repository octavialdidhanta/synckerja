import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { XenditContentCard } from '@/4-1-transaction/xendit/components/XenditContentCard';
import { XenditPanelFooter } from '@/4-1-transaction/xendit/components/XenditPanelFooter';
import {
  XENDIT_MAIN_GRID,
  XENDIT_TABLE_SECTION,
} from '@/4-1-transaction/xendit/layout/xenditPageLayout';

type XenditConnectPageWrapperProps = {
  children: ReactNode;
  footerLeft: ReactNode;
  footerRight?: ReactNode;
};

export function XenditConnectPageWrapper({
  children,
  footerLeft,
  footerRight,
}: XenditConnectPageWrapperProps) {
  const { t } = useTranslation();

  return (
    <div className={XENDIT_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
        <div className={XENDIT_TABLE_SECTION}>
          <XenditContentCard
            header={
              <div className="space-y-1 p-4 [@media(max-height:900px)]:p-3">
                <h2 className="text-base font-semibold text-foreground">
                  {t('xendit.tabs.connect', 'Connect account')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'xendit.connect.subtitle',
                    'Enable xenPlatform, verify API keys, and create your akun.',
                  )}
                </p>
              </div>
            }
            footer={<XenditPanelFooter left={footerLeft} right={footerRight} />}
            bodyClassName="p-4 [@media(max-height:900px)]:p-3"
          >
            <div className="mx-auto w-full max-w-2xl">{children}</div>
          </XenditContentCard>
        </div>
      </div>
    </div>
  );
}
