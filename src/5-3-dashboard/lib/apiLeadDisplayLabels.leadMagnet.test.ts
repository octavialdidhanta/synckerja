import { describe, expect, it } from 'vitest';
import {
  formatLeadWebPropertyCell,
  shouldShowLeadWebPropertyAsEmpty,
} from '@/5-3-dashboard/lib/apiLeadDisplayLabels';

describe('apiLeadDisplayLabels lead magnet', () => {
  it('shows empty web property for Lead Magnet leads', () => {
    expect(shouldShowLeadWebPropertyAsEmpty({ source: 'Lead Magnet' })).toBe(true);
    expect(formatLeadWebPropertyCell({ source: 'Lead Magnet', web_id: 'vialdi' })).toBe('');
  });

  it('still formats website web_id for normal leads', () => {
    expect(formatLeadWebPropertyCell({ source: 'Website form', web_id: 'synckerja' })).toBe('Synckerja');
  });
});
