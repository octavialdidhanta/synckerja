import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import {
  BLIBLI_STORE_INFO_URL,
  type BlibliConnectDraft,
} from './blibliConnectWizardTypes';

type Props = {
  draft: BlibliConnectDraft;
  onChange: (patch: Partial<BlibliConnectDraft>) => void;
};

export function BlibliConnectStepChecklist({ draft, onChange }: Props) {
  const { t } = useTranslation();

  const items = [
    t('operations.blibliOrders.connectWizard.checklist.itemAccount'),
    t('operations.blibliOrders.connectWizard.checklist.itemApiManager'),
    t('operations.blibliOrders.connectWizard.checklist.itemStoreCode'),
    t('operations.blibliOrders.connectWizard.checklist.itemSellerKey'),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {t('operations.blibliOrders.connectWizard.checklist.title')}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t('operations.blibliOrders.connectWizard.checklist.body')}
        </p>
      </div>

      <ul className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
        {items.map((text) => (
          <li key={text} className="flex gap-2 text-sm text-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      <a
        href={BLIBLI_STORE_INFO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        {t('operations.blibliOrders.connectWizard.checklist.storeInfoLink')}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>

      <div className="flex items-start gap-2 pt-1">
        <Checkbox
          id="blibli-wizard-ready"
          checked={draft.readyChecked}
          onCheckedChange={(v) => onChange({ readyChecked: v === true })}
        />
        <Label htmlFor="blibli-wizard-ready" className="cursor-pointer text-sm font-normal leading-snug">
          {t('operations.blibliOrders.connectWizard.checklist.readyLabel')}
        </Label>
      </div>
    </div>
  );
}
