import { describe, expect, it } from 'vitest';
import {
  buildScheduleFromWizardPayload,
  parseDateFromDateTimeLocal,
  parseTimeFromDateTimeLocal,
} from './scheduleVisitFromWizard';

describe('scheduleVisitFromWizard', () => {
  it('parses datetime-local into time fields', () => {
    const startTime = parseTimeFromDateTimeLocal('2026-06-15T09:30');
    expect(startTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(parseDateFromDateTimeLocal('2026-06-15T09:30')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('builds office location + scheduled visit payload', () => {
    const result = buildScheduleFromWizardPayload(
      {
        name: 'Client Site A',
        address: 'Jl. Demo 1',
        latitude: -6.1,
        longitude: 106.7,
        radius_meters: 120,
        client_id: 'c1c1c1c1-1111-4111-8111-111111111101',
        sales_person_id: '001b6725-bf16-4a2f-81ae-8960cf86c46d',
        planned_start_time: '2026-06-20T10:00',
        planned_end_time: '2026-06-20T12:00',
        visit_purpose: 'presentation',
        notes: 'Demo notes',
      },
      '663c9336-8cb6-4a36-9ad9-313126e70a1a',
    );

    expect(result.clientId).toBe('c1c1c1c1-1111-4111-8111-111111111101');
    expect(result.officeLocation.is_client_location).toBe(true);
    expect(result.scheduledVisit.status).toBe('scheduled');
    expect(result.scheduledVisit.visit_purpose).toBe('presentation');
  });

  it('throws when client or employee missing', () => {
    expect(() =>
      buildScheduleFromWizardPayload(
        { sales_person_id: '001b6725-bf16-4a2f-81ae-8960cf86c46d' },
        '663c9336-8cb6-4a36-9ad9-313126e70a1a',
      ),
    ).toThrow('Client is required');
  });
});
