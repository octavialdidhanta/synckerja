import { CircleHelp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { DEFAULT_LEAD_MAGNET_FORM } from '../../types/leadMagnet.types';
import type { LeadMagnetCampaignForm } from '../../types/leadMagnet.types';
import { useLeadMagnetWhatsAppAccounts } from '../../hooks/useLeadMagnetWhatsAppAccounts';
import { LeadMagnetFlowPreviewPanel } from './LeadMagnetFlowPreviewPanel';
import { LeadMagnetWhatsAppTemplateMapper } from './LeadMagnetWhatsAppTemplateMapper';

type LeadMagnetContactChannelStepProps = {
  form: LeadMagnetCampaignForm;
  onChange: (patch: Partial<LeadMagnetCampaignForm>) => void;
};

function InfoHint({ info }: { info: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
            aria-label={info}
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
          {info}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function LeadMagnetContactChannelStep({ form, onChange }: LeadMagnetContactChannelStepProps) {
  const { t } = useTranslation();
  const { accounts, orgHasWhatsApp, isLoading: loadingWa } = useLeadMagnetWhatsAppAccounts();

  const patch = (partial: Partial<LeadMagnetCampaignForm>) => onChange(partial);

  const handleWhatsAppToggle = (checked: boolean) => {
    patch({
      contact_gate_enabled: checked,
      delivery_fallback_text:
        form.delivery_fallback_text || DEFAULT_LEAD_MAGNET_FORM.delivery_fallback_text,
    });
  };

  return (
    <div className="min-h-full rounded-lg bg-[#F5F5F5] p-4">
      <div className="space-y-5">
        <div className="rounded-lg border border-border/60 bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Label
                htmlFor="whatsapp-delivery-enabled"
                className="min-w-0 flex-1 cursor-pointer text-sm font-medium leading-tight"
              >
                {t('leadMagnet.contactGate.enableWhatsApp')}
              </Label>
              <InfoHint info={t('leadMagnet.contactGate.enableWhatsAppHint')} />
            </div>
            <Switch
              id="whatsapp-delivery-enabled"
              checked={form.contact_gate_enabled}
              onCheckedChange={handleWhatsAppToggle}
            />
          </div>
        </div>

        {form.contact_gate_enabled ? (
          <>
            <div className="space-y-2 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Label className="min-w-0 flex-1">{t('leadMagnet.contactGate.fallbackLabel')}</Label>
                <InfoHint info={t('leadMagnet.contactGate.fallbackHint')} />
              </div>
              <Textarea
                value={form.delivery_fallback_text}
                onChange={(e) => patch({ delivery_fallback_text: e.target.value })}
                rows={2}
                placeholder={DEFAULT_LEAD_MAGNET_FORM.delivery_fallback_text}
              />
            </div>

            {loadingWa ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : orgHasWhatsApp ? (
              <div className="space-y-3 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                <Label>{t('leadMagnet.contactGate.waAccount')}</Label>
                <Select
                  value={form.whatsapp_account_id ?? ''}
                  onValueChange={(v) =>
                    patch({
                      whatsapp_account_id: v || null,
                      whatsapp_template_name: null,
                      whatsapp_template_language: null,
                      whatsapp_template_params: {},
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('leadMagnet.contactGate.selectWa')} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.whatsapp_business_name || a.display_phone_number || a.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {form.whatsapp_account_id ? (
                  <LeadMagnetWhatsAppTemplateMapper
                    whatsappAccountId={form.whatsapp_account_id}
                    templateName={form.whatsapp_template_name}
                    templateLanguage={form.whatsapp_template_language}
                    templateParams={form.whatsapp_template_params}
                    onChange={(next) => patch(next)}
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-amber-700">{t('leadMagnet.contactGate.noWa')}</p>
            )}

            <LeadMagnetFlowPreviewPanel form={form} />
          </>
        ) : null}
      </div>
    </div>
  );
}
