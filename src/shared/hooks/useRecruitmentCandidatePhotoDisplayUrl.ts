import { useEffect, useState } from 'react';
import { resolveRecruitmentCandidatePhotoDisplayUrl } from '@/shared/lib/recruitmentCandidatePhoto';

export function useRecruitmentCandidatePhotoDisplayUrl(
  stored: string | null | undefined,
  options?: { width?: number },
): string {
  const [displayUrl, setDisplayUrl] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const resolved = await resolveRecruitmentCandidatePhotoDisplayUrl(stored, {
        width: options?.width,
      });
      if (!cancelled) setDisplayUrl(resolved ?? '');
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [stored, options?.width]);

  return displayUrl;
}
