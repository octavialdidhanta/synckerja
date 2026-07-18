import type { TFunction } from 'i18next';
import type { LeadMagnetCampaignForm } from '../../types/leadMagnet.types';
import type { MissingContactField } from './skipMatrixPreview';
import {
  isLeadMagnetTemplateMappingComplete,
  leadMagnetTemplateMappingError,
  type LeadMagnetTemplateMappingErrorCode,
} from './leadMagnetWhatsAppTemplateParams';

function translateTemplateMappingError(
  err: LeadMagnetTemplateMappingErrorCode,
  t: TFunction,
): string {
  switch (err.type) {
    case 'selectTemplateAndMap':
      return t('leadMagnet.contactGate.validation.templateSelectAndMap');
    case 'needsMoreVars':
      return t('leadMagnet.contactGate.validation.templateNeedsVars', {
        expected: err.expected,
        actual: err.actual,
      });
    case 'fillAllVars':
      return t('leadMagnet.contactGate.validation.templateFillAllVars', {
        expected: err.expected,
      });
  }
}

export type EmailCollectionFormSlice = Pick<
  LeadMagnetCampaignForm,
  'email_collection_enabled' | 'contact_prompt_text' | 'contact_invalid_text'
>;

export type WhatsAppDeliveryFormSlice = Pick<
  LeadMagnetCampaignForm,
  | 'contact_gate_enabled'
  | 'delivery_fallback_text'
  | 'whatsapp_account_id'
  | 'whatsapp_template_name'
  | 'whatsapp_template_language'
  | 'whatsapp_template_params'
>;

export function validateEmailCollectionStep(
  form: EmailCollectionFormSlice,
  t: TFunction,
): string | null {
  if (!form.email_collection_enabled) return null;
  if (!form.contact_prompt_text?.trim()) {
    return t('leadMagnet.wizard.validation.emailPromptRequired');
  }
  if (!form.contact_invalid_text?.trim()) {
    return t('leadMagnet.wizard.validation.emailInvalidRequired');
  }
  return null;
}

export function validateWhatsAppDeliveryStep(
  form: WhatsAppDeliveryFormSlice,
  orgHasWhatsApp: boolean,
  t: TFunction,
): string | null {
  if (!form.contact_gate_enabled) return null;
  if (!form.delivery_fallback_text?.trim()) {
    return t('leadMagnet.contactGate.validation.fallbackRequired');
  }
  if (orgHasWhatsApp) {
    if (!form.whatsapp_account_id?.trim()) {
      return t('leadMagnet.contactGate.validation.waAccountRequired');
    }
    if (!form.whatsapp_template_name?.trim()) {
      return t('leadMagnet.contactGate.validation.waTemplateRequired');
    }
    const mappingErr = leadMagnetTemplateMappingError(form.whatsapp_template_params);
    if (mappingErr) return translateTemplateMappingError(mappingErr, t);
    if (!isLeadMagnetTemplateMappingComplete(form.whatsapp_template_params)) {
      return t('leadMagnet.contactGate.validation.mappingIncomplete');
    }
  }
  return null;
}

/** @deprecated Use validateWhatsAppDeliveryStep */
export function validateContactGateStep(
  form: WhatsAppDeliveryFormSlice,
  orgHasWhatsApp: boolean,
  t: TFunction,
): string | null {
  return validateWhatsAppDeliveryStep(form, orgHasWhatsApp, t);
}

export function contactGatePublishWarnings(
  _form: WhatsAppDeliveryFormSlice,
  _orgHasWhatsApp: boolean,
  _t: TFunction,
): string[] {
  return [];
}

export type { MissingContactField };
