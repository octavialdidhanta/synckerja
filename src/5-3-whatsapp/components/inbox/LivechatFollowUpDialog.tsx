import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
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
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';
import { supabase } from '@/shared/lib/supabaseClient';
import type { WhatsAppAccount, WhatsAppConversation } from '../../types';
import { getConversationTicketId } from './ConversationList';
import { useSendWhatsAppTemplateFollowup } from '../../hooks/useSendWhatsAppTemplateFollowup';
import { getFollowUpSendErrorMessage } from '../../utils/followUpSendError';
import {
  buildLivechatFollowUpPrefill,
  slotCountForTemplateComponents,
} from '../../utils/buildLivechatFollowUpPrefill';
import { useWhatsAppMessageTemplates } from '@/5-3-whatsapp-template/hooks/useWhatsAppMessageTemplates';
import { useWhatsAppMessageTemplateByHsmId } from '@/5-3-whatsapp-template/hooks/useWhatsAppMessageTemplateByHsmId';
import { mapMetaTemplateToRow } from '@/5-3-whatsapp-template/utils/mapMetaTemplateToRow';
import { splitFlatParametersForPreview } from '@/5-3-whatsapp-template/utils/buildCampaignTemplateParameters';
import { WhatsAppTemplatePhonePreview } from '@/5-3-whatsapp-template/components/WhatsAppTemplatePhonePreview';
import type { MetaMessageTemplate, TemplateTableRow } from '@/5-3-whatsapp-template/types';

type LivechatFollowUpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: WhatsAppConversation;
  waAccounts: WhatsAppAccount[];
};

function FollowUpDialogTitle({
  isMobile,
  onClose,
  title,
}: {
  isMobile: boolean;
  onClose: () => void;
  title: string;
}) {
  return (
    <FollowUpDialogTitleRow isMobile={isMobile}>
      {isMobile ? (
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      ) : null}
      <DialogTitle className={cn(isMobile ? 'text-lg' : 'text-base')}>{title}</DialogTitle>
    </FollowUpDialogTitleRow>
  );
}

function FollowUpDialogTitleRow({ isMobile, children }: { isMobile: boolean; children: ReactNode }) {
  return <div className={cn('flex items-center gap-2', isMobile && 'pr-2')}>{children}</div>;
}

export function LivechatFollowUpDialog({
  open,
  onOpenChange,
  conversation,
  waAccounts,
}: LivechatFollowUpDialogProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { sendFollowUp, isSendingFollowUp } = useSendWhatsAppTemplateFollowup();

  const matchedAccount = useMemo(() => {
    const pn = conversation.phone_number_id?.trim();
    if (!pn) return waAccounts[0] ?? null;
    return waAccounts.find((a) => a.phone_number_id === pn) ?? waAccounts[0] ?? null;
  }, [conversation.phone_number_id, waAccounts]);

  const waAccountId = matchedAccount?.id ?? null;
  const tplQuery = useWhatsAppMessageTemplates(open ? waAccountId : null);
  const [templateHsmId, setTemplateHsmId] = useState('');
  const [parameterValues, setParameterValues] = useState<string[]>([]);
  const [agentName, setAgentName] = useState('');

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

  const ticketId = getConversationTicketId(conversation);

  const prefillContext = useMemo(
    () => ({
      customerName: conversation.customer_name,
      ticketId,
      agentName,
      customerWaId: conversation.customer_wa_id,
    }),
    [conversation.customer_name, conversation.customer_wa_id, ticketId, agentName],
  );

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
    if (!selectedMeta?.name || !selectedMeta?.language) {
      toast.error(t('whatsappInbox.followUp.needTemplate', 'Pilih template pesan.'));
      return;
    }
    try {
      await sendFollowUp({
        conversation_id: conversation.id,
        template_name: selectedMeta.name,
        template_language: selectedMeta.language,
        template_hsm_id: templateHsmId || null,
        template_components_json: componentsJson,
        parameter_values: parameterValues,
      });
      toast.success(t('whatsappInbox.followUp.sent', 'Follow-up template terkirim.'));
      onOpenChange(false);
    } catch (e) {
      toast.error(getFollowUpSendErrorMessage(e, t));
    }
  }, [
    componentsJson,
    conversation.id,
    onOpenChange,
    parameterValues,
    selectedMeta?.language,
    selectedMeta?.name,
    sendFollowUp,
    t,
    templateHsmId,
  ]);

  const slotCount = slotCountForTemplateComponents(componentsJson);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          isMobile
            ? 'fixed left-0 right-0 top-0 max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none modal-above-safe-area'
            : 'max-h-[90vh] max-w-3xl w-[95vw]',
        )}
        hideCloseButton={isMobile}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b px-4 text-left',
            isMobile ? 'safe-area-top pb-3 pt-4' : 'py-3',
          )}
        >
          <FollowUpDialogTitle
            isMobile={isMobile}
            onClose={() => onOpenChange(false)}
            title={t('whatsappInbox.followUp.title', 'Follow-up')}
          />
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {conversation.customer_name?.trim() || conversation.customer_wa_id}
            {ticketId ? ` · ${ticketId}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'scrollbar-hide seamless-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4',
            isMobile && '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          <div className={cn('grid min-w-0 gap-6', isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2')}>
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
                {tplQuery.isLoading ? (
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    {t('whatsappInbox.followUp.loadingTemplates', 'Memuat template…')}
                  </p>
                ) : null}
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

        <div
          className={cn(
            'flex flex-shrink-0 items-center gap-2 border-t bg-muted/30 px-4 py-3',
            isMobile ? 'justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'justify-end',
          )}
        >
          {isMobile ? (
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onOpenChange(false)}>
              {t('common.cancel', 'Batal')}
            </Button>
          ) : null}
          <Button
            type="button"
            className={cn(isMobile && 'min-w-[120px] flex-1')}
            disabled={!templateHsmId || isSendingFollowUp || templateDetail.isFetching}
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
