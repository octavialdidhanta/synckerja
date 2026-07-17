import type { LeadMagnetCampaignForm } from '../../types/leadMagnet.types';
import type { MissingContactField } from './skipMatrixPreview';
import {
  isLeadMagnetTemplateMappingComplete,
  leadMagnetTemplateMappingError,
} from './leadMagnetWhatsAppTemplateParams';

export type ContactGateFormSlice = Pick<
  LeadMagnetCampaignForm,
  | 'contact_gate_enabled'
  | 'contact_prompt_text'
  | 'contact_invalid_text'
  | 'delivery_fallback_text'
  | 'whatsapp_account_id'
  | 'whatsapp_template_name'
  | 'whatsapp_template_language'
  | 'whatsapp_template_params'
  | 'email_subject'
  | 'email_html_body'
  | 'email_from_name'
>;

export function validateContactGateStep(
  form: ContactGateFormSlice,
  orgHasWhatsApp: boolean,
): string | null {
  if (!form.contact_gate_enabled) return null;
  if (!form.contact_prompt_text?.trim()) return 'Teks DM minta kontak wajib diisi';
  if (!form.contact_invalid_text?.trim()) return 'Teks DM invalid wajib diisi';
  if (!form.delivery_fallback_text?.trim()) return 'Teks DM fallback IG wajib diisi';
  if (orgHasWhatsApp) {
    if (!form.whatsapp_account_id?.trim()) return 'Pilih akun WhatsApp';
    if (!form.whatsapp_template_name?.trim()) return 'Pilih template WhatsApp APPROVED';
    const mappingErr = leadMagnetTemplateMappingError(form.whatsapp_template_params);
    if (mappingErr) return mappingErr;
    if (!isLeadMagnetTemplateMappingComplete(form.whatsapp_template_params)) {
      return 'Lengkapi mapping variabel template WhatsApp';
    }
  }
  return null;
}

export function contactGatePublishWarnings(
  form: ContactGateFormSlice,
  orgHasWhatsApp: boolean,
): string[] {
  const warnings: string[] = [];
  if (!form.contact_gate_enabled) return warnings;
  if (!orgHasWhatsApp && !form.email_html_body?.trim()) {
    warnings.push('Email belum dikonfigurasi — delivery hanya via fallback DM IG jika WA tidak tersedia.');
  }
  return warnings;
}

export type { MissingContactField };
