import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { supabase } from '@/shared/lib/supabaseClient';
import type { NewLead } from '@/shared/types/leads';
import { useWhatsAppAccounts } from '@/5-3-whatsapp/hooks/useWhatsAppAccounts';
import { useSendWhatsAppTemplateFollowup } from '@/5-3-whatsapp/hooks/useSendWhatsAppTemplateFollowup';
import {
  buildLivechatFollowUpPrefill,
  slotCountForTemplateComponents,
} from '@/5-3-whatsapp/utils/buildLivechatFollowUpPrefill';
import { useWhatsAppMessageTemplates } from '@/5-3-whatsapp-template/hooks/useWhatsAppMessageTemplates';
import { useWhatsAppMessageTemplateByHsmId } from '@/5-3-whatsapp-template/hooks/useWhatsAppMessageTemplateByHsmId';
import { mapMetaTemplateToRow } from '@/5-3-whatsapp-template/utils/mapMetaTemplateToRow';
import { splitFlatParametersForPreview } from '@/5-3-whatsapp-template/utils/buildCampaignTemplateParameters';
import { WhatsAppTemplatePhonePreview } from '@/5-3-whatsapp-template/components/WhatsAppTemplatePhonePreview';
import type { MetaMessageTemplate, TemplateTableRow } from '@/5-3-whatsapp-template/types';

type LeadTemplateFollowUpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: NewLead | null;
  onSent?: () => void;
};

export function LeadTemplateFollowUpDialog({
  open,
  onOpenChange,
  lead,
  onSent,
}: LeadTemplateFollowUpDialogProps) {
  const { t } = useAppTranslation();
  const { data: waAccounts = [] } = useWhatsAppAccounts();
  const { sendFollowUp, isSendingFollowUp } = useSendWhatsAppTemplateFollowup();

  const activeAccounts = useMemo(
    () => waAccounts.filter((a) => a.is_active !== false),
    [waAccounts],
  );
  const matchedAccount = activeAccounts[0] ?? null;
  const waAccountId = matchedAccount?.id ?? null;

  const tplQuery = useWhatsAppMessageTemplates(open ? waAccountId : null);
  const [templateHsmId, setTemplateHsmId] = useState('');
  const [parameterValues, setParameterValues] = useState<string[]>([]);
  const [agentName, setAgentName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  const templateDetail = useWhatsAppMessageTemplateByHsmId({
    hsmId: open && templateHsmId ? templateHsmId : null,
    whatsappAccountId: waAccountId,
  });

  const templateRows: TemplateTableRow[] = useMemo(() => {
    const pages = tplQuery.data?.pages ?? [];
    const metas = pages.flatMap((p) => p.data ?? []) as MetaMessageTemplate[];
    return metas.map((m) => mapMetaTemplateToRow(m)).filter((x): x is TemplateTableRow => Boolean(x));
  }, [tplQuery.data?.pages]);

  const approvedTemplates = useMemo(
    () => templateRows.filter((row) => row.statusRaw === 'APPROVED'),
    [templateRows],
  );

  const selectedMeta = templateDetail.data?.data?.[0] as MetaMessageTemplate | undefined;
  const previewRow = useMemo(() => (selectedMeta ? mapMetaTemplateToRow(selectedMeta) : null), [selectedMeta]);
  const componentsJson = useMemo(() => {
    const c = selectedMeta?.components;
    return Array.isArray(c) ? c : [];
  }, [selectedMeta?.components]);

  const ticketId = (lead?.ticket_id ?? '').trim();
  const prefillContext = useMemo(
    () => ({
      customerName: lead?.client ?? lead?.title ?? '',
      ticketId: ticketId || undefined,
      agentName,
      customerWaId: phoneDigits,
    }),
    [lead?.client, lead?.title, ticketId, agentName, phoneDigits],
  );

  useEffect(() => {
    if (!open || !lead) return;
    void (async () => {
      setPhoneLoading(true);
      try {
        const { data: leadRow } = await supabase
          .from('leads')
          .select('phone_number')
          .eq('id', lead.id)
          .maybeSingle();
        let phone = String(leadRow?.phone_number ?? '').trim();
        if (!phone) {
          const { fetchLeadSubmissionForProfile } = await import('@/shared/lib/leadSubmissionProfile');
          const submission = await fetchLeadSubmissionForProfile(lead.id, lead.organization_id);
          phone = String(submission?.phone_number ?? '').trim();
        }
        setPhoneDigits(phone.replace(/\D/g, ''));
      } finally {
        setPhoneLoading(false);
      }
    })();
  }, [open, lead?.id]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      setAgentName(profile?.full_name?.trim() || user.email || '');
    })();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setTemplateHsmId('');
      setParameterValues([]);
    }
  }, [open]);

  useEffect(() => {
    const n = slotCountForTemplateComponents(componentsJson);
    if (!templateHsmId || n === 0) {
      setParameterValues([]);
      return;
    }
    setParameterValues(buildLivechatFollowUpPrefill(n, prefillContext));
  }, [templateHsmId, componentsJson, prefillContext]);

  const previewSamples = useMemo(() => {
    if (!componentsJson.length) return null;
    return splitFlatParametersForPreview(componentsJson, parameterValues);
  }, [componentsJson, parameterValues]);

  const senderLabel =
    matchedAccount?.whatsapp_business_name?.trim() ||
    matchedAccount?.display_phone_number?.trim() ||
    matchedAccount?.phone_number_id ||
    '—';

  const handleSend = useCallback(async () => {
    if (!lead) return;
    if (!phoneDigits || phoneDigits.length < 8) {
      toast.error(
        t(
          'leadsManagement.templateFollowUp.missingPhone',
          'Nomor telepon tidak valid. Isi di profil klien atau data lead.',
        ),
      );
      return;
    }
    if (!selectedMeta?.name || !selectedMeta?.language) {
      toast.error(t('whatsappInbox.followUp.needTemplate', 'Pilih template pesan.'));
      return;
    }
    try {
      await sendFollowUp({
        lead_id: lead.id,
        template_name: selectedMeta.name,
        template_language: selectedMeta.language,
        template_hsm_id: templateHsmId || null,
        template_components_json: componentsJson,
        parameter_values: parameterValues,
      });
      toast.success(t('whatsappInbox.followUp.sent', 'Follow-up template terkirim.'));
      onOpenChange(false);
      onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('whatsappInbox.followUp.sendFailed', 'Gagal mengirim follow-up.'));
    }
  }, [
    componentsJson,
    lead,
    onOpenChange,
    onSent,
    parameterValues,
    phoneDigits,
    selectedMeta?.language,
    selectedMeta?.name,
    sendFollowUp,
    t,
    templateHsmId,
  ]);

  const slotCount = slotCountForTemplateComponents(componentsJson);

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl w-[95vw] flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 border-b px-4 py-3 text-left">
          <DialogTitle className="text-base">
            {t('leadsManagement.templateFollowUp.title', 'Follow-up template')}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {lead.client || lead.title}
            {phoneDigits ? ` · +${phoneDigits}` : phoneLoading ? ' · …' : ''}
            {ticketId ? ` · ${ticketId}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                <Label>{t('whatsappInbox.followUp.sender', 'Nomor pengirim')}</Label>
                <p className="text-sm font-medium text-foreground">{senderLabel}</p>
              </div>

              <div className="space-y-2">
                <Label>{t('whatsappInbox.followUp.template', 'Template pesan')}</Label>
                <Select
                  value={templateHsmId}
                  onValueChange={setTemplateHsmId}
                  disabled={!waAccountId || tplQuery.isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('whatsappInbox.followUp.selectTemplate', 'Pilih template…')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {approvedTemplates.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.templateName} · {row.languageLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {slotCount > 0 ? (
                <div className="space-y-2">
                  <Label>{t('whatsappInbox.followUp.variables', 'Variabel template')}</Label>
                  {Array.from({ length: slotCount }, (_, i) => (
                    <FollowUpVariableInput
                      key={i}
                      index={i}
                      value={parameterValues[i] ?? ''}
                      slotCount={slotCount}
                      onChange={setParameterValues}
                    />
                  ))}
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                <Link
                  to="/omnichannel/campaign/templates"
                  className="font-medium text-primary underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('whatsappInbox.followUp.manageTemplates', 'Kelola template')}
                </Link>
              </p>
            </div>

            <div className="flex min-h-0 flex-col items-center justify-start">
              {previewRow ? (
                <WhatsAppTemplatePhonePreview
                  headerText={previewRow.headerText}
                  mediaFormat={previewRow.mediaFormat}
                  headerMediaPreviewUrl={previewRow.headerMediaPreviewUrl}
                  bodyText={previewRow.bodyFull}
                  bodyVariableExamples={
                    previewSamples?.bodyVariableExamples?.length
                      ? previewSamples.bodyVariableExamples
                      : previewRow.bodyVariableExamples
                  }
                  headerVariableExamples={
                    previewSamples?.headerVariableExamples?.length
                      ? previewSamples.headerVariableExamples
                      : previewRow.headerVariableExamples
                  }
                  footerText={previewRow.footerText}
                  buttonLabels={previewRow.previewButtonLabels}
                  previewAt={previewRow.lastEditedAt ?? previewRow.createdAt}
                  metaSyncLoading={templateDetail.isFetching}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('whatsappInbox.followUp.previewHint', 'Pilih template untuk melihat preview.')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t bg-muted/30 px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Batal')}
          </Button>
          <Button
            type="button"
            disabled={!templateHsmId || isSendingFollowUp || !phoneDigits || phoneLoading}
            onClick={() => void handleSend()}
          >
            {isSendingFollowUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t('whatsappInbox.followUp.sending', 'Mengirim…')}
              </>
            ) : (
              t('whatsappInbox.followUp.sendNow', 'Kirim sekarang')
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FollowUpVariableInput({
  index,
  value,
  slotCount,
  onChange,
}: {
  index: number;
  value: string;
  slotCount: number;
  onChange: Dispatch<SetStateAction<string[]>>;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{`{{${index + 1}}}`}</Label>
      <Input
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange((prev) => {
            const next = [...prev];
            while (next.length < slotCount) next.push('');
            next[index] = v;
            return next;
          });
        }}
        maxLength={1024}
      />
    </div>
  );
}
