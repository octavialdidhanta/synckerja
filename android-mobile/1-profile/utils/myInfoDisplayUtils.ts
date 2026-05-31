import type { AppLanguage } from '@/shared/i18n/translations';

type TranslateFn = (key: string, fallback?: string) => string;

export function formatBirthDate(value: string | undefined, language: AppLanguage): string | undefined {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.trim();
  return date.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatGender(value: string | undefined, t: TranslateFn): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'male') return t('profile.myInfo.gender.male', 'Male');
  if (normalized === 'female') return t('profile.myInfo.gender.female', 'Female');
  return value.trim();
}

export function formatMaritalStatus(value: string | undefined, t: TranslateFn): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase();
  const keyMap: Record<string, string> = {
    single: 'profile.myInfo.marital.single',
    married: 'profile.myInfo.marital.married',
    divorced: 'profile.myInfo.marital.divorced',
    widowed: 'profile.myInfo.marital.widowed',
  };
  const key = keyMap[normalized];
  if (key) {
    const fallbacks: Record<string, string> = {
      single: 'Single',
      married: 'Married',
      divorced: 'Divorced',
      widowed: 'Widowed',
    };
    return t(key, fallbacks[normalized]);
  }
  return value.trim();
}

export function formatReligion(value: string | undefined, t: TranslateFn): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase();
  const keyMap: Record<string, string> = {
    islam: 'profile.myInfo.religion.islam',
    christian: 'profile.myInfo.religion.christian',
    catholic: 'profile.myInfo.religion.catholic',
    hindu: 'profile.myInfo.religion.hindu',
    buddha: 'profile.myInfo.religion.buddha',
    other: 'profile.myInfo.religion.other',
  };
  const key = keyMap[normalized];
  if (key) {
    const fallbacks: Record<string, string> = {
      islam: 'Islam',
      christian: 'Christian',
      catholic: 'Catholic',
      hindu: 'Hindu',
      buddha: 'Buddha',
      other: 'Other',
    };
    return t(key, fallbacks[normalized]);
  }
  return value.trim();
}

export function hasDisplayValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}
