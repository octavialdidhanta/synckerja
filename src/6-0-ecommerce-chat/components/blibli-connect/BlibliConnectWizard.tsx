import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { UseMutationResult } from '@tanstack/react-query';
import type { BlibliSellerConnectInput } from '../../hooks/useBlibliSellerSettings';
import { BlibliConnectStepChecklist } from './BlibliConnectStepChecklist';
import { BlibliConnectStepBindClientId } from './BlibliConnectStepBindClientId';
import { BlibliConnectStepCredentials } from './BlibliConnectStepCredentials';
import { BlibliConnectStepReview } from './BlibliConnectStepReview';
import {
  EMPTY_BLIBLI_CONNECT_DRAFT,
  validateCredentialsStep,
  type BlibliConnectDraft,
  type BlibliConnectWizardStep,
} from './blibliConnectWizardTypes';

type Props = {
  apiClientId: string | null;
  serverConfigured: boolean;
  isFirstStore: boolean;
  connect: UseMutationResult<unknown, Error, BlibliSellerConnectInput, unknown>;
  onCancel?: () => void;
  onSuccess?: () => void;
  className?: string;
};

export function BlibliConnectWizard({
  apiClientId,
  serverConfigured,
  isFirstStore,
  connect,
  onCancel,
  onSuccess,
  className,
}: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<BlibliConnectWizardStep>(1);
  const [draft, setDraft] = useState<BlibliConnectDraft>(EMPTY_BLIBLI_CONNECT_DRAFT);

  const patch = (p: Partial<BlibliConnectDraft>) => setDraft((d) => ({ ...d, ...p }));

  const canNext =
    step === 1
      ? draft.readyChecked
      : step === 2
        ? Boolean(apiClientId) && draft.bindChecked
        : step === 3
          ? validateCredentialsStep(draft) === null
          : true;

  const goNext = () => {
    if (step === 3) {
      const err = validateCredentialsStep(draft);
      if (err === 'storeId') {
        toast.error(t('operations.ecommerceChat.blibli.invalidStoreId'));
        return;
      }
      if (err) {
        toast.error(t('operations.blibliOrders.connectWizard.credentials.incomplete'));
        return;
      }
    }
    if (step < 4) setStep((s) => (s + 1) as BlibliConnectWizardStep);
  };

  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as BlibliConnectWizardStep);
  };

  const onSubmit = async () => {
    const err = validateCredentialsStep(draft);
    if (err) {
      toast.error(
        err === 'storeId'
          ? t('operations.ecommerceChat.blibli.invalidStoreId')
          : t('operations.blibliOrders.connectWizard.credentials.incomplete'),
      );
      return;
    }
    try {
      await connect.mutateAsync({
        store_code: draft.storeCode.trim(),
        username: draft.username.trim(),
        store_id: Number(draft.storeId.trim()),
        api_seller_key: draft.apiSellerKey.trim(),
        ...(draft.signatureKey.trim() ? { signature_key: draft.signatureKey.trim() } : {}),
        ...(draft.displayName.trim() ? { display_name: draft.displayName.trim() } : {}),
        is_default: isFirstStore,
      });
      toast.success(t('operations.ecommerceChat.blibli.connectSuccess'));
      setDraft(EMPTY_BLIBLI_CONNECT_DRAFT);
      setStep(1);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('operations.ecommerceChat.blibli.connectError'));
    }
  };

  const stepLabels = [
    t('operations.blibliOrders.connectWizard.steps.prepare'),
    t('operations.blibliOrders.connectWizard.steps.bind'),
    t('operations.blibliOrders.connectWizard.steps.credentials'),
    t('operations.blibliOrders.connectWizard.steps.review'),
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <nav aria-label={t('operations.blibliOrders.connectWizard.progressLabel')} className="space-y-2">
        <ol className="flex flex-wrap gap-2">
          {stepLabels.map((label, i) => {
            const n = (i + 1) as BlibliConnectWizardStep;
            const active = n === step;
            const done = n < step;
            return (
              <li
                key={label}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]',
                  active && 'border-primary bg-primary/10 font-medium text-primary',
                  done && 'border-border text-foreground',
                  !active && !done && 'border-border text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                    active || done ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {n}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </li>
            );
          })}
        </ol>
        <p className="text-[11px] text-muted-foreground">
          {t('operations.blibliOrders.connectWizard.stepOf', { current: step, total: 4 })}
        </p>
      </nav>

      <div className="min-h-[200px]">
        {step === 1 && <BlibliConnectStepChecklist draft={draft} onChange={patch} />}
        {step === 2 && (
          <BlibliConnectStepBindClientId
            draft={draft}
            onChange={patch}
            apiClientId={apiClientId}
          />
        )}
        {step === 3 && <BlibliConnectStepCredentials draft={draft} onChange={patch} />}
        {step === 4 && <BlibliConnectStepReview draft={draft} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex gap-2">
          {step > 1 ? (
            <Button type="button" size="sm" variant="outline" onClick={goBack} disabled={connect.isPending}>
              {t('operations.blibliOrders.connectWizard.back')}
            </Button>
          ) : onCancel ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              {t('operations.blibliOrders.connectWizard.cancel')}
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          {step < 4 ? (
            <Button type="button" size="sm" onClick={goNext} disabled={!canNext}>
              {t('operations.blibliOrders.connectWizard.next')}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => void onSubmit()}
              disabled={connect.isPending || !serverConfigured || !canNext}
            >
              {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {t('operations.blibliOrders.connectWizard.submit')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
