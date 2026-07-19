import { useTranslation } from 'react-i18next';
import { maskSecret, type BlibliConnectDraft } from './blibliConnectWizardTypes';

type Props = {
  draft: BlibliConnectDraft;
};

export function BlibliConnectStepReview({ draft }: Props) {
  const { t } = useTranslation();

  const rows: Array<{ label: string; value: string }> = [
    {
      label: t('operations.blibliOrders.connectWizard.credentials.storeCode'),
      value: draft.storeCode.trim() || '—',
    },
    {
      label: t('operations.blibliOrders.connectWizard.credentials.username'),
      value: draft.username.trim() || '—',
    },
    {
      label: t('operations.blibliOrders.connectWizard.credentials.storeId'),
      value: draft.storeId.trim() || '—',
    },
    {
      label: t('operations.blibliOrders.connectWizard.credentials.apiSellerKey'),
      value: maskSecret(draft.apiSellerKey),
    },
    {
      label: t('operations.blibliOrders.connectWizard.credentials.signatureKey'),
      value: draft.signatureKey.trim()
        ? maskSecret(draft.signatureKey)
        : t('operations.blibliOrders.connectWizard.review.notSet'),
    },
    {
      label: t('operations.blibliOrders.connectWizard.credentials.displayName'),
      value: draft.displayName.trim() || t('operations.blibliOrders.connectWizard.review.notSet'),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {t('operations.blibliOrders.connectWizard.review.title')}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t('operations.blibliOrders.connectWizard.review.body')}
        </p>
      </div>

      <dl className="divide-y divide-border rounded-md border border-border">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-3 gap-2 px-3 py-2 text-xs sm:grid-cols-4">
            <dt className="col-span-1 text-muted-foreground">{row.label}</dt>
            <dd className="col-span-2 break-all font-medium text-foreground sm:col-span-3">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
