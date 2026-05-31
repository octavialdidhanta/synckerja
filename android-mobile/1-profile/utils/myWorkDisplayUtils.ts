import type { AppLanguage } from '@/shared/i18n/translations';
import type { ProfileMyWorkData } from '@/mobile/1-profile/hooks/useProfileMyWork';
import { hasDisplayValue } from '@/mobile/1-profile/utils/myInfoDisplayUtils';

type TranslateFn = (key: string, fallback?: string) => string;

export function formatJoinDate(date: string | undefined, language: AppLanguage): string | undefined {
  if (!date?.trim()) return undefined;

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return parsed.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function diffCalendarYmd(start: Date, end: Date): { years: number; months: number; days: number } | null {
  if (start > end) return null;

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

export function formatTenure(
  joinDate: string | undefined,
  language: AppLanguage,
  t: TranslateFn,
  referenceDate: Date = new Date(),
): string | undefined {
  if (!joinDate?.trim()) return undefined;

  const start = new Date(joinDate);
  if (Number.isNaN(start.getTime())) return undefined;

  const diff = diffCalendarYmd(start, referenceDate);
  if (!diff) return undefined;

  const parts: string[] = [];

  if (diff.years > 0) {
    const unitKey =
      diff.years === 1 ? 'profile.myWork.tenureYear' : 'profile.myWork.tenureYears';
    const fallback = diff.years === 1 ? 'year' : 'years';
    parts.push(`${diff.years} ${t(unitKey, fallback)}`);
  }

  if (diff.months > 0) {
    const unitKey =
      diff.months === 1 ? 'profile.myWork.tenureMonth' : 'profile.myWork.tenureMonths';
    const fallback = diff.months === 1 ? 'month' : 'months';
    parts.push(`${diff.months} ${t(unitKey, fallback)}`);
  }

  if (diff.days > 0 || parts.length === 0) {
    const dayCount = diff.days > 0 ? diff.days : 0;
    const unitKey = dayCount === 1 ? 'profile.myWork.tenureDay' : 'profile.myWork.tenureDays';
    const fallback = dayCount === 1 ? 'day' : 'days';
    parts.push(`${dayCount} ${t(unitKey, fallback)}`);
  }

  return parts.join(' ');
}

export function formatOrgRole(role: string | undefined, t: TranslateFn): string | undefined {
  if (!role?.trim()) return undefined;

  const normalized = role.trim().toLowerCase();
  const roleKeyMap: Record<string, string> = {
    owner: 'profile.role.owner',
    admin: 'profile.role.admin',
    hr: 'profile.role.hr',
    manager: 'profile.role.manager',
    employee: 'profile.role.employee',
    member: 'profile.role.member',
  };

  const key = roleKeyMap[normalized];
  if (key) {
    const fallbacks: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      hr: 'HR',
      manager: 'Manager',
      employee: 'Employee',
      member: 'Member',
    };
    return t(key, fallbacks[normalized]);
  }

  return role.trim();
}

export function buildIdentityOrgFields(myWork: ProfileMyWorkData, t: TranslateFn) {
  return [
    {
      label: t('profile.myWork.employeeIdLabel', 'Employee ID'),
      value: myWork.employee_id,
    },
    {
      label: t('profile.myWork.organizationNameLabel', 'Organization Name'),
      value: myWork.organization_name,
    },
    {
      label: t('profile.myWork.branchLabel', 'Branch'),
      value: myWork.branch_name,
    },
  ];
}

export function buildPositionStructureFields(myWork: ProfileMyWorkData, t: TranslateFn) {
  return [
    {
      label: t('profile.myWork.departmentLabel', 'Department'),
      value: myWork.department_name,
    },
    {
      label: t('profile.myWork.jobPositionLabel', 'Job Position'),
      value: myWork.job_position_name,
    },
    {
      label: t('profile.myWork.jobLevelLabel', 'Job Level'),
      value: myWork.job_level_name,
    },
    {
      label: t('profile.myWork.roleLabel', 'Role'),
      value: formatOrgRole(myWork.organization_role, t),
    },
  ];
}

export function buildStatusTenureFields(
  myWork: ProfileMyWorkData,
  t: TranslateFn,
  language: AppLanguage,
) {
  return [
    {
      label: t('profile.myWork.employmentStatusLabel', 'Employment Status'),
      value: myWork.employment_status,
    },
    {
      label: t('profile.myWork.joinDateLabel', 'Join Date'),
      value: formatJoinDate(myWork.join_date, language),
    },
    {
      label: t('profile.myWork.tenureLabel', 'Tenure'),
      value: formatTenure(myWork.join_date, language, t),
    },
    {
      label: t('profile.myWork.directManagerLabel', 'Direct Manager'),
      value: myWork.direct_manager_name,
    },
  ];
}

export function filterMyWorkFields(fields: { label: string; value: string | undefined }[]) {
  return fields.filter((field) => hasDisplayValue(field.value));
}

export function hasAnyMyWorkDisplayData(myWork: ProfileMyWorkData | null): boolean {
  if (!myWork) return false;

  const allFields = [
    ...buildIdentityOrgFields(myWork, () => ''),
    ...buildPositionStructureFields(myWork, () => ''),
    ...buildStatusTenureFields(myWork, () => '', 'id'),
  ];

  return allFields.some((field) => hasDisplayValue(field.value));
}
