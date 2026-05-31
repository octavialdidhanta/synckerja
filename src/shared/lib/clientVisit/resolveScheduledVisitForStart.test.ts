import { describe, expect, it } from 'vitest';
import { pickScheduledVisitForStart } from './resolveScheduledVisitForStart';

describe('pickScheduledVisitForStart', () => {
  const scheduledAtWizard = {
    id: 'scheduled-wizard',
    validated_location_id: 'loc-wizard',
    lead_client_id: 'client-1',
    planned_start_time: '13:18:00',
    visit_purpose: 'negotiation',
  };

  const scheduledOther = {
    id: 'scheduled-other',
    validated_location_id: 'loc-gps',
    lead_client_id: 'client-1',
    planned_start_time: '09:00:00',
    visit_purpose: 'follow up',
  };

  it('prefers exact validated_location_id match', () => {
    const picked = pickScheduledVisitForStart(
      [scheduledAtWizard, scheduledOther],
      'loc-wizard',
      'client-1',
    );
    expect(picked?.id).toBe('scheduled-wizard');
  });

  it('falls back to same client when GPS location id differs', () => {
    const picked = pickScheduledVisitForStart([scheduledAtWizard], 'loc-gps', 'client-1');
    expect(picked?.id).toBe('scheduled-wizard');
  });

  it('picks earliest planned start when multiple rows share client', () => {
    const picked = pickScheduledVisitForStart(
      [scheduledAtWizard, scheduledOther],
      'loc-unknown',
      'client-1',
    );
    expect(picked?.id).toBe('scheduled-other');
  });
});
