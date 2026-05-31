import type { AppLanguage } from '@/shared/i18n/translations';
import type { ProfileReprimandRecord } from '@/mobile/1-profile/hooks/useProfileReprimands';
import { hasDisplayValue } from '@/mobile/1-profile/utils/myInfoDisplayUtils';

type TranslateFn = (key: string, fallback?: string) => string;

export function formatReprimandType(type: string | undefined, t: TranslateFn): string | undefined {
  if (!type?.trim()) return undefined;

  const keyMap: Record<string, string> = {
    verbal_warning: 'profile.reprimand.type.verbalWarning',
    written_warning: 'profile.reprimand.type.writtenWarning',
    final_warning: 'profile.reprimand.type.finalWarning',
    suspension: 'profile.reprimand.type.suspension',
    termination: 'profile.reprimand.type.termination',
  };

  const fallbacks: Record<string, string> = {
    verbal_warning: 'Verbal Warning',
    written_warning: 'Written Warning',
    final_warning: 'Final Warning',
    suspension: 'Suspension',
    termination: 'Termination',
  };

  const normalized = type.trim().toLowerCase();
  const key = keyMap[normalized];
  return key ? t(key, fallbacks[normalized]) : type.trim();
}

export function formatSeverity(severity: string | undefined, t: TranslateFn): string | undefined {
  if (!severity?.trim()) return undefined;

  const keyMap: Record<string, string> = {
    low: 'profile.reprimand.severity.low',
    medium: 'profile.reprimand.severity.medium',
    high: 'profile.reprimand.severity.high',
    critical: 'profile.reprimand.severity.critical',
  };

  const fallbacks: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };

  const normalized = severity.trim().toLowerCase();
  const key = keyMap[normalized];
  return key ? t(key, fallbacks[normalized]) : severity.trim();
}

export function formatCategory(category: string | undefined, t: TranslateFn): string | undefined {
  if (!category?.trim()) return undefined;

  const keyMap: Record<string, string> = {
    attendance: 'profile.reprimand.category.attendance',
    performance: 'profile.reprimand.category.performance',
    conduct: 'profile.reprimand.category.conduct',
    safety: 'profile.reprimand.category.safety',
    policy_violation: 'profile.reprimand.category.policyViolation',
    insubordination: 'profile.reprimand.category.insubordination',
    other: 'profile.reprimand.category.other',
  };

  const fallbacks: Record<string, string> = {
    attendance: 'Attendance',
    performance: 'Performance',
    conduct: 'Conduct',
    safety: 'Safety',
    policy_violation: 'Policy Violation',
    insubordination: 'Insubordination',
    other: 'Other',
  };

  const normalized = category.trim().toLowerCase();
  const key = keyMap[normalized];
  return key ? t(key, fallbacks[normalized]) : category.trim();
}

export function formatReprimandStatus(status: string | undefined, t: TranslateFn): string | undefined {
  if (!status?.trim()) return undefined;

  const keyMap: Record<string, string> = {
    active: 'profile.reprimand.status.active',
    resolved: 'profile.reprimand.status.resolved',
    appealed: 'profile.reprimand.status.appealed',
    cancelled: 'profile.reprimand.status.cancelled',
  };

  const fallbacks: Record<string, string> = {
    active: 'Active',
    resolved: 'Resolved',
    appealed: 'Appealed',
    cancelled: 'Cancelled',
  };

  const normalized = status.trim().toLowerCase();
  const key = keyMap[normalized];
  return key ? t(key, fallbacks[normalized]) : status.trim();
}

export function formatIncidentDate(
  date: string | undefined,
  language: AppLanguage,
): string | undefined {
  if (!date?.trim()) return undefined;

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return parsed.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatIncidentTime(time: string | undefined): string | undefined {
  if (!time?.trim()) return undefined;

  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return trimmed;

  const hours = match[1].padStart(2, '0');
  const minutes = match[2];
  return `${hours}:${minutes}`;
}

export function getSeverityBadgeClass(severity: string | undefined): string {
  switch (severity?.trim().toLowerCase()) {
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'high':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'medium':
      return 'border-yellow-200 bg-yellow-50 text-yellow-700';
    case 'low':
      return 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

export function getStatusBadgeClass(status: string | undefined): string {
  switch (status?.trim().toLowerCase()) {
    case 'active':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'resolved':
      return 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue';
    case 'appealed':
      return 'border-yellow-200 bg-yellow-50 text-yellow-700';
    case 'cancelled':
      return 'border-border bg-muted text-muted-foreground';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

export function buildReprimandCoreFields(
  record: ProfileReprimandRecord,
  t: TranslateFn,
  language: AppLanguage,
) {
  return [
    {
      label: t('profile.reprimand.typeLabel', 'Reprimand Type'),
      value: formatReprimandType(record.reprimand_type, t),
    },
    {
      label: t('profile.reprimand.severityLabel', 'Severity'),
      value: formatSeverity(record.severity_level, t),
    },
    {
      label: t('profile.reprimand.categoryLabel', 'Violation Category'),
      value: formatCategory(record.violation_category, t),
    },
    {
      label: t('profile.reprimand.incidentDateLabel', 'Incident Date'),
      value: formatIncidentDate(record.incident_date, language),
    },
    {
      label: t('profile.reprimand.incidentTimeLabel', 'Incident Time'),
      value: formatIncidentTime(record.incident_time),
    },
    {
      label: t('profile.reprimand.incidentLocationLabel', 'Incident Location'),
      value: record.incident_location,
    },
    {
      label: t('profile.reprimand.statusLabel', 'Status'),
      value: formatReprimandStatus(record.status, t),
    },
    {
      label: t('profile.reprimand.violationDescriptionLabel', 'Violation Description'),
      value: record.violation_description,
    },
  ];
}

export function filterReprimandFields(fields: { label: string; value: string | undefined }[]) {
  return fields.filter((field) => hasDisplayValue(field.value));
}

export function getReprimandListSummary(record: ProfileReprimandRecord, t: TranslateFn) {
  return {
    typeLabel: formatReprimandType(record.reprimand_type, t) ?? record.reprimand_type,
    severityLabel: formatSeverity(record.severity_level, t) ?? record.severity_level,
    statusLabel: formatReprimandStatus(record.status, t) ?? record.status,
  };
}
