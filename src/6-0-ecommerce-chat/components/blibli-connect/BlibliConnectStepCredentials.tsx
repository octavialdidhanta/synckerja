import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  BLIBLI_STORE_INFO_URL,
  type BlibliConnectDraft,
} from './blibliConnectWizardTypes';

type Props = {
  draft: BlibliConnectDraft;
  onChange: (patch: Partial<BlibliConnectDraft>) => void;
};

export function BlibliConnectStepCredentials({ draft, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {t('operations.blibliOrders.connectWizard.credentials.title')}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t('operations.blibliOrders.connectWizard.credentials.body')}
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="blibli-wiz-store-code">
            {t('operations.blibliOrders.connectWizard.credentials.storeCode')}
          </Label>
          <Input
            id="blibli-wiz-store-code"
            value={draft.storeCode}
            onChange={(e) => onChange({ storeCode: e.target.value })}
            placeholder="TOQ-…"
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            {t('operations.blibliOrders.connectWizard.credentials.storeCodeHint')}{' '}
            <a
              href={BLIBLI_STORE_INFO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              {t('operations.blibliOrders.connectWizard.credentials.openStoreInfo')}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="blibli-wiz-username">
            {t('operations.blibliOrders.connectWizard.credentials.username')}
          </Label>
          <Input
            id="blibli-wiz-username"
            type="email"
            value={draft.username}
            onChange={(e) => onChange({ username: e.target.value })}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="blibli-wiz-store-id">
            {t('operations.blibliOrders.connectWizard.credentials.storeId')}
          </Label>
          <Input
            id="blibli-wiz-store-id"
            inputMode="numeric"
            value={draft.storeId}
            onChange={(e) => onChange({ storeId: e.target.value })}
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            {t('operations.blibliOrders.connectWizard.credentials.storeIdHint')}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="blibli-wiz-api-key">
            {t('operations.blibliOrders.connectWizard.credentials.apiSellerKey')}
          </Label>
          <Input
            id="blibli-wiz-api-key"
            type="password"
            value={draft.apiSellerKey}
            onChange={(e) => onChange({ apiSellerKey: e.target.value })}
            autoComplete="new-password"
          />
          <p className="text-[11px] text-muted-foreground">
            {t('operations.blibliOrders.connectWizard.credentials.apiSellerKeyHint')}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="blibli-wiz-sig-key">
            {t('operations.blibliOrders.connectWizard.credentials.signatureKey')}
          </Label>
          <Input
            id="blibli-wiz-sig-key"
            type="password"
            value={draft.signatureKey}
            onChange={(e) => onChange({ signatureKey: e.target.value })}
            autoComplete="new-password"
          />
          <p className="text-[11px] text-muted-foreground">
            {t('operations.blibliOrders.connectWizard.credentials.signatureKeyHint')}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="blibli-wiz-display-name">
            {t('operations.blibliOrders.connectWizard.credentials.displayName')}
          </Label>
          <Input
            id="blibli-wiz-display-name"
            value={draft.displayName}
            onChange={(e) => onChange({ displayName: e.target.value })}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
