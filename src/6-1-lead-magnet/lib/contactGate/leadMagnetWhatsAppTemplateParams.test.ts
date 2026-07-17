import { describe, expect, it } from 'vitest';
import {
  isLeadMagnetTemplateMappingComplete,
  leadMagnetTemplateMappingError,
  suggestLeadMagnetParameterValues,
} from './leadMagnetWhatsAppTemplateParams';

const SEVEN_VAR_COMPONENTS = [
  {
    type: 'BODY',
    text: 'Hai {{1}}, {{2}} {{3}} {{4}} {{5}} {{6}} {{7}}',
  },
];

const TWO_VAR_COMPONENTS = [
  {
    type: 'BODY',
    text: 'Hai {{1}}, unduh: {{2}}',
  },
];

describe('leadMagnetWhatsAppTemplateParams', () => {
  it('suggests username and delivery_url for multi-slot body', () => {
    const suggested = suggestLeadMagnetParameterValues(SEVEN_VAR_COMPONENTS);
    expect(suggested).toHaveLength(7);
    expect(suggested[0]).toBe('{{username}}');
    expect(suggested[6]).toBe('{{delivery_url}}');
    expect(suggested.slice(1, 6).every((v) => v === '-')).toBe(true);
  });

  it('detects incomplete mapping when parameter_values too short', () => {
    const params = {
      components_json: SEVEN_VAR_COMPONENTS,
      parameter_values: ['{{username}}', '{{delivery_url}}'],
    };
    expect(isLeadMagnetTemplateMappingComplete(params)).toBe(false);
    expect(leadMagnetTemplateMappingError(params)).toMatch(/7 variabel/);
  });

  it('accepts complete mapping for 2-var template', () => {
    const params = {
      components_json: TWO_VAR_COMPONENTS,
      parameter_values: ['{{username}}', '{{delivery_url}}'],
    };
    expect(isLeadMagnetTemplateMappingComplete(params)).toBe(true);
    expect(leadMagnetTemplateMappingError(params)).toBeNull();
  });
});
