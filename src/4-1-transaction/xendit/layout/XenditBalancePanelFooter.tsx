import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { XenditPanelFooter } from '@/4-1-transaction/xendit/components/XenditPanelFooter';

type Props = {
  count?: number;
};

export function XenditBalancePanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const sectionLabel = t('xendit.tabs.balance', 'Balance & Withdrawals');

  return (
    <XenditPanelFooter
      left={t('xendit.balance.footer.showing', 'Showing {{count}} {{section}}', {
        count,
        section: sectionLabel,
      })}
      right={t('xendit.balance.footer.total', 'Total: {{count}}', { count })}
    />
  );
}
