import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { DEFAULT_LEAD_MAGNET_FORM } from '../../types/leadMagnet.types';
import type { LeadMagnetCampaignForm } from '../../types/leadMagnet.types';
import { useLeadMagnetWhatsAppAccounts } from '../../hooks/useLeadMagnetWhatsAppAccounts';
import { LeadMagnetFlowPreviewPanel } from './LeadMagnetFlowPreviewPanel';
import { LeadMagnetWhatsAppTemplateMapper } from './LeadMagnetWhatsAppTemplateMapper';

type LeadMagnetContactChannelStepProps = {
  form: LeadMagnetCampaignForm;
  onChange: (patch: Partial<LeadMagnetCampaignForm>) => void;
};

export function LeadMagnetContactChannelStep({ form, onChange }: LeadMagnetContactChannelStepProps) {
  const { t } = useTranslation();
  const { accounts, orgHasWhatsApp, isLoading: loadingWa } = useLeadMagnetWhatsAppAccounts();

  const patch = (partial: Partial<LeadMagnetCampaignForm>) => onChange(partial);

  const handleContactGateToggle = (checked: boolean) => {
    patch({
      contact_gate_enabled: checked,
      skip_material_offer: checked ? true : form.skip_material_offer,
      contact_prompt_text: form.contact_prompt_text || DEFAULT_LEAD_MAGNET_FORM.contact_prompt_text,
      contact_invalid_text: form.contact_invalid_text || DEFAULT_LEAD_MAGNET_FORM.contact_invalid_text,
      delivery_fallback_text:
        form.delivery_fallback_text || DEFAULT_LEAD_MAGNET_FORM.delivery_fallback_text,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="contact-gate-enabled"
          checked={form.contact_gate_enabled}
          onCheckedChange={(v) => handleContactGateToggle(v === true)}
        />
        <div className="space-y-1">
          <Label htmlFor="contact-gate-enabled" className="cursor-pointer font-medium">
            {t('leadMagnet.contactGate.enable', 'Aktifkan Contact Gate')}
          </Label>
          <p className="text-sm text-muted-foreground">
            {t(
              'leadMagnet.contactGate.enableHint',
              'Kumpulkan WA/email sebelum delivery. Default OFF — kampanye lama tidak berubah.',
            )}
          </p>
        </div>
      </div>

      {form.contact_gate_enabled ? (
        <>
          <div className="space-y-2">
            <Label>{t('leadMagnet.contactGate.promptLabel', 'DM minta kontak')}</Label>
            <Textarea
              value={form.contact_prompt_text}
              onChange={(e) => patch({ contact_prompt_text: e.target.value })}
              rows={8}
              placeholder={DEFAULT_LEAD_MAGNET_FORM.contact_prompt_text}
            />
            <p className="text-xs text-muted-foreground">
              {t(
                'leadMagnet.contactGate.promptDeliveryHint',
                'Setelah user kirim kontak valid, materi dikirim via WhatsApp atau email — tidak ada DM konfirmasi di Instagram.',
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('leadMagnet.contactGate.invalidLabel', 'DM invalid / retry')}</Label>
            <Textarea
              value={form.contact_invalid_text}
              onChange={(e) => patch({ contact_invalid_text: e.target.value })}
              rows={4}
              placeholder={DEFAULT_LEAD_MAGNET_FORM.contact_invalid_text}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('leadMagnet.contactGate.fallbackLabel', 'DM fallback IG (jika WA/email gagal)')}</Label>
            <Textarea
              value={form.delivery_fallback_text}
              onChange={(e) => patch({ delivery_fallback_text: e.target.value })}
              rows={2}
              placeholder={DEFAULT_LEAD_MAGNET_FORM.delivery_fallback_text}
            />
            <p className="text-xs text-muted-foreground">
              {t(
                'leadMagnet.contactGate.fallbackHint',
                'Hanya dikirim jika delivery WhatsApp atau email gagal setelah kontak valid.',
              )}
            </p>
          </div>

          {loadingWa ? (
            <p className="text-sm text-muted-foreground">{t('common.loading', 'Memuat…')}</p>
          ) : orgHasWhatsApp ? (
            <div className="space-y-3 rounded-lg border p-4">
              <Label>{t('leadMagnet.contactGate.waAccount', 'Akun WhatsApp')}</Label>
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
                  <SelectValue placeholder={t('leadMagnet.contactGate.selectWa', 'Pilih akun WA')} />
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
            <p className="text-sm text-amber-700">
              {t(
                'leadMagnet.contactGate.noWa',
                'Org belum punya akun WhatsApp aktif — delivery via email atau fallback DM IG.',
              )}
            </p>
          )}

          <div className="space-y-3 rounded-lg border p-4">
            <Label>{t('leadMagnet.contactGate.emailSection', 'Email (Resend, opsional)')}</Label>
            <Input
              value={form.email_subject}
              onChange={(e) => patch({ email_subject: e.target.value })}
              placeholder={t('leadMagnet.contactGate.emailSubject', 'Subjek email')}
            />
            <Input
              value={form.email_from_name ?? ''}
              onChange={(e) => patch({ email_from_name: e.target.value || null })}
              placeholder={t('leadMagnet.contactGate.emailFromName', 'Nama pengirim')}
            />
            <p className="text-xs text-muted-foreground">
              {t(
                'leadMagnet.contactGate.emailFromHint',
                'Alamat pengirim dikelola Synckerja (domain terverifikasi). Isi nama tampilan saja — contoh inbox: PT. ABC via Synckerja.',
              )}
            </p>
            <Textarea
              value={form.email_html_body}
              onChange={(e) => patch({ email_html_body: e.target.value })}
              rows={5}
              placeholder={'<p>Hai {{username}}, link: {{delivery_url}}</p>'}
            />
          </div>

          <LeadMagnetFlowPreviewPanel form={form} />
        </>
      ) : null}
    </div>
  );
}
