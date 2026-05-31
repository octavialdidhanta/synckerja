import { format } from 'date-fns';

export type ClientVisitTimelinessInput = {
  visit_date?: string | null;
  planned_start_time?: string | null;
  actual_start_time?: string | null;
  status?: string | null;
};

export type ClientVisitTimeliness =
  | { kind: 'pending' }
  | { kind: 'unknown' }
  | { kind: 'on_time' }
  | { kind: 'late'; lateMinutes: number };

/** Format plan time (`HH:mm:ss`) or actual ISO timestamp to `HH:mm`. */
export function formatClientVisitTimeValue(value?: string | null): string {
  if (!value?.trim()) return '—';
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  try {
    return format(new Date(trimmed), 'HH:mm');
  } catch {
    return trimmed;
  }
}

export function formatClientVisitTimeRange(
  start?: string | null,
  end?: string | null,
): string {
  const startLabel = formatClientVisitTimeValue(start);
  const endLabel = formatClientVisitTimeValue(end);
  if (startLabel === '—' && endLabel === '—') return '—';
  return `${startLabel} - ${endLabel}`;
}

export function parseClientVisitPlannedDateTime(
  visitDate: string,
  plannedTime: string,
): Date | null {
  const timePart = plannedTime.trim();
  if (!/^\d{2}:\d{2}/.test(timePart)) return null;
  const normalizedTime = timePart.length >= 8 ? timePart.slice(0, 8) : `${timePart.slice(0, 5)}:00`;
  const parsed = new Date(`${visitDate}T${normalizedTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseClientVisitActualDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}/.test(trimmed)) {
    return parseClientVisitPlannedDateTime('1970-01-01', trimmed);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getClientVisitTimeliness(visit: ClientVisitTimelinessInput): ClientVisitTimeliness {
  if (!visit.actual_start_time?.trim()) {
    if (visit.status === 'scheduled') return { kind: 'pending' };
    return { kind: 'unknown' };
  }
  if (!visit.planned_start_time?.trim() || !visit.visit_date?.trim()) {
    return { kind: 'unknown' };
  }

  const planned = parseClientVisitPlannedDateTime(visit.visit_date, visit.planned_start_time);
  const actual = parseClientVisitActualDateTime(visit.actual_start_time);
  if (!planned || !actual) return { kind: 'unknown' };

  const lateMinutes = Math.floor((actual.getTime() - planned.getTime()) / (1000 * 60));
  if (lateMinutes <= 0) return { kind: 'on_time' };
  return { kind: 'late', lateMinutes };
}

export function formatLateDurationParts(minutes: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(minutes));
  return {
    hours: Math.floor(safe / 60),
    minutes: safe % 60,
  };
}
