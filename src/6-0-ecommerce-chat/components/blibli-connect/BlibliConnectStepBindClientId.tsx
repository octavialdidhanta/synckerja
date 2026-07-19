import { useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import type { BlibliConnectDraft } from './blibliConnectWizardTypes';

type Props = {
  draft: BlibliConnectDraft;
  onChange: (patch: Partial<BlibliConnectDraft>) => void;
  apiClientId: string | null;
};

export function BlibliConnectStepBindClientId({
  draft,
  onChange,
  apiClientId,
}: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!apiClientId) return;
    try {
      await navigator.clipboard.writeText(apiClientId);
      setCopied(true);
      toast.success(t('operations.blibliOrders.connectWizard.bind.copySuccess'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('operations.blibliOrders.connectWizard.bind.copyError'));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {t('operations.blibliOrders.connectWizard.bind.title')}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t('operations.blibliOrders.connectWizard.bind.body')}
        </p>
      </div>

      {apiClientId ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('operations.blibliOrders.connectWizard.bind.clientIdLabel')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1.5 text-xs">
              {apiClientId}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={() => void onCopy()}>
              {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              )}
              {t('operations.blibliOrders.connectWizard.bind.copy')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {t('operations.blibliOrders.connectWizard.bind.clientIdUnavailable')}
        </p>
      )}

      <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
        <li>{t('operations.blibliOrders.connectWizard.bind.step1')}</li>
        <li>{t('operations.blibliOrders.connectWizard.bind.step2')}</li>
        <li>{t('operations.blibliOrders.connectWizard.bind.step3')}</li>
      </ol>

      <p className="text-xs text-muted-foreground">
        {t('operations.blibliOrders.connectWizard.bind.apiManagerHint')}
      </p>

      <a
        href="https://seller.blibli.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        {t('operations.blibliOrders.connectWizard.bind.openSellerCenter')}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>

      <div className="flex items-start gap-2 pt-1">
        <Checkbox
          id="blibli-wizard-bound"
          checked={draft.bindChecked}
          disabled={!apiClientId}
          onCheckedChange={(v) => onChange({ bindChecked: v === true })}
        />
        <Label
          htmlFor="blibli-wizard-bound"
          className="cursor-pointer text-sm font-normal leading-snug"
        >
          {t('operations.blibliOrders.connectWizard.bind.confirmLabel')}
        </Label>
      </div>
    </div>
  );
}
