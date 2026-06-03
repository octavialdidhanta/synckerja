import { describe, expect, it } from 'vitest';
import { normalizeRecruitmentPhotoPath } from './recruitmentCandidatePhoto';

describe('normalizeRecruitmentPhotoPath', () => {
  it('returns storage path as-is', () => {
    expect(normalizeRecruitmentPhotoPath('abc-123/avatar.jpg')).toBe('abc-123/avatar.jpg');
  });

  it('strips bucket prefix', () => {
    expect(normalizeRecruitmentPhotoPath('recruitment-files/abc-123/avatar.jpg')).toBe(
      'abc-123/avatar.jpg',
    );
  });

  it('extracts path from public storage URL', () => {
    const url =
      'https://example.supabase.co/storage/v1/object/public/recruitment-files/uuid/avatar.png';
    expect(normalizeRecruitmentPhotoPath(url)).toBe('uuid/avatar.png');
  });
});
