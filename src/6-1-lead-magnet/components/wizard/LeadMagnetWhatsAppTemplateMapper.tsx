import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  countTemplateBodySlots,
  templateSelectionKey,
  useApprovedWhatsAppTemplatesFlat,
} from '@/5-3-dashboard/omnichannel-settings/hooks/useApprovedWhatsAppTemplatesFlat';
import type { WhatsAppTemplateSelection } from '@/5-3-dashboard/omnichannel-settings/components/api-integration/WhatsAppTemplatePicker';
import { WhatsAppTemplatePicker } from '@/5-3-dashboard/omnichannel-settings/components/api-integration/WhatsAppTemplatePicker';
import { extractTemplateParameterSlots } from '@/5-3-whatsapp-template/utils/campaignTemplateContent';
import {
  buildLeadMagnetWhatsAppTemplateParamsPayload,
  isLeadMagnetTemplateMappingComplete,
  LEAD_MAGNET_WA_PARAM_TOKENS,
  parseLeadMagnetWhatsAppTemplateParams,
  suggestLeadMagnetParameterValues,
  type LeadMagnetWhatsAppTemplateParams,
} from '../../lib/contactGate/leadMagnetWhatsAppTemplateParams';

const MAPPER_ROW_CLASS =
  'grid grid-cols-[3rem_minmax(140px,1fr)_minmax(180px,1.2fr)] items-center gap-x-2 gap-y-1';

const TOKEN_VALUE_OPTIONS = [
  LEAD_MAGNET_WA_PARAM_TOKENS.username,
  LEAD_MAGNET_WA_PARAM_TOKENS.deliveryUrl,
  LEAD_MAGNET_WA_PARAM_TOKENS.campaignName,
  LEAD_MAGNET_WA_PARAM_TOKENS.empty,
  '__static__',
] as const;

function rowLanguageCode(languageCode: string): string {
  return languageCode === '—' ? 'id' : languageCode;
}

type LeadMagnetWhatsAppTemplateMapperProps = {
  whatsappAccountId: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  templateParams: Record<string, unknown>;
  onChange: (patch: {
    whatsapp_template_name: string | null;
    whatsapp_template_language: string | null;
    whatsapp_template_params: LeadMagnetWhatsAppTemplateParams;
  }) => void;
  disabled?: boolean;
};

export function LeadMagnetWhatsAppTemplateMapper({
  whatsappAccountId,
  templateName,
  templateLanguage,
  templateParams,
  onChange,
  disabled = false,
}: LeadMagnetWhatsAppTemplateMapperProps) {
  const { t } = useTranslation();
  const tokenOptions = useMemo(
    () =>
      TOKEN_VALUE_OPTIONS.map((value) => {
        if (value === LEAD_MAGNET_WA_PARAM_TOKENS.empty) {
          return { value, label: t('leadMagnet.contactGate.waTokenEmpty') };
        }
        if (value === '__static__') {
          return { value, label: t('leadMagnet.contactGate.waTokenStatic') };
        }
        return { value, label: value };
      }),
    [t],
  );
  const { rows, isLoading } = useApprovedWhatsAppTemplatesFlat({
    enabled: Boolean(whatsappAccountId),
    whatsappAccountId,
  });

  const templateSelection: WhatsAppTemplateSelection | null = templateName
    ? { name: templateName, language: templateLanguage || 'id' }
    : null;

  const matchedRow = useMemo(() => {
    if (!templateName?.trim()) return undefined;
    const key = templateSelectionKey(templateName, templateLanguage || 'id');
    return rows.find(
      (row) => templateSelectionKey(row.templateName, rowLanguageCode(row.languageCode)) === key,
    );
  }, [rows, templateName, templateLanguage]);

  const componentsJson = useMemo(() => {
    const parsed = parseLeadMagnetWhatsAppTemplateParams(templateParams);
    if (Array.isArray(parsed.components_json) && parsed.components_json.length > 0) {
      return parsed.components_json;
    }
    return matchedRow?.componentsJson ?? [];
  }, [templateParams, matchedRow]);

  const slots = useMemo(() => extractTemplateParameterSlots(componentsJson), [componentsJson]);

  const parsedValues = parseLeadMagnetWhatsAppTemplateParams(templateParams).parameter_values ?? [];

  const [slotValues, setSlotValues] = useState<string[]>([]);
  const [staticModes, setStaticModes] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (slots.length === 0) {
      setSlotValues([]);
      setStaticModes({});
      return;
    }
    const next = [...parsedValues];
    while (next.length < slots.length) next.push('');
    setSlotValues(next.slice(0, slots.length));
    const modes: Record<number, boolean> = {};
    for (let i = 0; i < slots.length; i++) {
      const v = next[i] ?? '';
      const isKnownToken = tokenOptions.some((o) => o.value !== '__static__' && o.value === v);
      modes[i + 1] = Boolean(v) && !isKnownToken;
    }
    setStaticModes(modes);
  }, [templateName, templateLanguage, slots.length, parsedValues.join('\0')]);

  const emitParams = useCallback(
    (values: string[], components: unknown[]) => {
      onChange({
        whatsapp_template_name: templateName,
        whatsapp_template_language: templateLanguage,
        whatsapp_template_params: buildLeadMagnetWhatsAppTemplateParamsPayload({
          componentsJson: components,
          parameterValues: values,
        }),
      });
    },
    [onChange, templateName, templateLanguage],
  );

  const handleTemplateChange = (next: WhatsAppTemplateSelection | null) => {
    if (!next) {
      onChange({
        whatsapp_template_name: null,
        whatsapp_template_language: null,
        whatsapp_template_params: {},
      });
      return;
    }
    const key = templateSelectionKey(next.name, next.language || 'id');
    const row = rows.find(
      (r) => templateSelectionKey(r.templateName, rowLanguageCode(r.languageCode)) === key,
    );
    const components = row?.componentsJson ?? [];
    const suggested = suggestLeadMagnetParameterValues(components);
    onChange({
      whatsapp_template_name: next.name,
      whatsapp_template_language: next.language || 'id',
      whatsapp_template_params: buildLeadMagnetWhatsAppTemplateParamsPayload({
        componentsJson: components,
        parameterValues: suggested,
      }),
    });
  };

  const updateSlot = (slotIndex: number, value: string) => {
    const idx = slotIndex - 1;
    const next = [...slotValues];
    next[idx] = value;
    setSlotValues(next);
    emitParams(next, componentsJson);
  };

  const bodySlotCount = matchedRow ? countTemplateBodySlots(matchedRow) : 0;
  const mappingComplete = isLeadMagnetTemplateMappingComplete(templateParams);
  const idealTemplate = bodySlotCount === 2;

  return (
    <div className="space-y-3">
      <WhatsAppTemplatePicker
        id="lead-magnet-wa-template"
        purpose="lead_magnet"
        value={templateSelection}
        onChange={handleTemplateChange}
        whatsappAccountId={whatsappAccountId}
        queryEnabled={Boolean(whatsappAccountId)}
        leadMappingComplete={mappingComplete}
        hideApprovedHint
        disabled={disabled || isLoading}
      />

      {matchedRow ? (
        <div className="flex flex-wrap items-center gap-2">
          {idealTemplate ? (
            <Badge variant="secondary" className="text-xs">
              {t('leadMagnet.contactGate.waTemplateIdeal')}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-amber-800">
              {t('leadMagnet.contactGate.waTemplateManyVars', { count: slots.length })}
            </Badge>
          )}
          {matchedRow.mediaFormat ? (
            <Badge variant="outline" className="text-xs">
              {t('leadMagnet.contactGate.waMediaHeader')}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {slots.length > 0 ? (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <Label className="text-sm">{t('leadMagnet.contactGate.waVarMapping')}</Label>
          <div className="space-y-2">
            {slots.map((slot) => {
              const idx = slot.index - 1;
              const current = slotValues[idx] ?? '';
              const isStatic = staticModes[slot.index] ?? false;
              const selectValue = isStatic ? '__static__' : current || LEAD_MAGNET_WA_PARAM_TOKENS.empty;

              return (
                <div key={slot.index} className={MAPPER_ROW_CLASS}>
                  <span className="font-mono text-xs text-muted-foreground">{slot.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {slot.region === 'header'
                      ? t('leadMagnet.contactGate.waSlotHeader')
                      : t('leadMagnet.contactGate.waSlotBody')}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1 sm:flex-row">
                    <Select
                      value={selectValue}
                      onValueChange={(v) => {
                        if (v === '__static__') {
                          setStaticModes((m) => ({ ...m, [slot.index]: true }));
                          updateSlot(slot.index, current && !tokenOptions.some((o) => o.value === current) ? current : '');
                          return;
                        }
                        setStaticModes((m) => ({ ...m, [slot.index]: false }));
                        updateSlot(slot.index, v);
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-9 font-mono text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tokenOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="font-mono text-sm">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isStatic ? (
                      <Input
                        value={current}
                        onChange={(e) => updateSlot(slot.index, e.target.value)}
                        placeholder={t('leadMagnet.contactGate.waStaticPlaceholder')}
                        disabled={disabled}
                        className="h-9 min-w-0 flex-1 font-mono text-sm"
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {!mappingComplete ? (
            <p className="text-xs text-amber-700">{t('leadMagnet.contactGate.waMappingIncomplete')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
