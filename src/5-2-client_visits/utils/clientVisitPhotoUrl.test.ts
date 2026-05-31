import { describe, expect, it } from 'vitest';
import { buildClientVisitPhotoObjectCandidates } from './clientVisitPhotoUrl';

describe('buildClientVisitPhotoObjectCandidates', () => {
  const employeeId = '001b6725-bf16-4a2f-81ae-8960cf86c46d';
  const userId = '4ad75249-72b8-45e8-ba90-23c9868a8f64';
  const legacyPath = `visits/${userId}/1780210154914_start.jpg`;

  it('includes full legacy path and employee remapped candidate', () => {
    const candidates = buildClientVisitPhotoObjectCandidates(legacyPath, employeeId);
    expect(candidates[0]).toBe(legacyPath);
    expect(candidates).toContain(`${userId}/1780210154914_start.jpg`);
    expect(candidates).toContain(`${employeeId}/1780210154914_start.jpg`);
  });

  it('handles employee-folder visit paths', () => {
    const path = `${employeeId}/visit_start_2026-05-31T04-00-00-000Z.jpg`;
    const candidates = buildClientVisitPhotoObjectCandidates(path, employeeId);
    expect(candidates[0]).toBe(path);
  });
});
