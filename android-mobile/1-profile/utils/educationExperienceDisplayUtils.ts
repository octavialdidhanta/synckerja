import type { AppLanguage } from '@/shared/i18n/translations';
import { formatBirthDate } from '@/mobile/1-profile/utils/myInfoDisplayUtils';

type TranslateFn = (key: string, fallback?: string) => string;

export function formatDisplayDate(value: string | undefined, language: AppLanguage): string | undefined {
  return formatBirthDate(value, language);
}

export function formatDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  isCurrent: boolean | undefined,
  t: TranslateFn,
  language: AppLanguage,
): string | undefined {
  const start = formatDisplayDate(startDate, language);
  const end = isCurrent
    ? t('profile.educationExperience.currentBadge', 'Current')
    : formatDisplayDate(endDate, language);

  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return undefined;
}

export function formatSingleDate(value: string | undefined, language: AppLanguage): string | undefined {
  return formatDisplayDate(value, language);
}
