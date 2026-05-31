import { getLocalDateYmd } from '@/shared/lib/date/getLocalDateYmd';

export interface WizardLocationPayload {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  google_place_id?: string | null;
  formatted_address?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  client_id?: string | null;
  sales_person_id?: string | null;
  planned_start_time?: string | null;
  planned_end_time?: string | null;
  visit_purpose?: string;
}

export interface ParsedVisitSchedule {
  visitDate: string;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  visitPurpose: string;
  notes: string | null;
  clientId: string;
  employeeId: string;
  officeLocation: Record<string, unknown>;
  scheduledVisit: Record<string, unknown>;
}

const padTime = (value: number) => String(value).padStart(2, '0');

export const parseTimeFromDateTimeLocal = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}:${padTime(date.getSeconds())}`;
};

export const parseDateFromDateTimeLocal = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}`;
};

export const buildScheduleFromWizardPayload = (
  payload: WizardLocationPayload,
  organizationId: string,
): ParsedVisitSchedule => {
  const visitDate =
    parseDateFromDateTimeLocal(payload.planned_start_time ?? null) ??
    getLocalDateYmd();
  const plannedStartTime = parseTimeFromDateTimeLocal(payload.planned_start_time ?? null);
  const plannedEndTime = parseTimeFromDateTimeLocal(payload.planned_end_time ?? null);
  const clientId = payload.client_id ?? '';
  const employeeId = payload.sales_person_id ?? '';

  if (!clientId) throw new Error('Client is required');
  if (!employeeId) throw new Error('Sales person is required');

  const officeLocation: Record<string, unknown> = {
    organization_id: organizationId,
    name: payload.name || payload.formatted_address || payload.address || 'Client site',
    address: payload.address || payload.formatted_address || payload.name || '',
    formatted_address: payload.formatted_address ?? payload.address ?? null,
    google_place_id: payload.google_place_id ?? null,
    latitude: payload.latitude ?? 0,
    longitude: payload.longitude ?? 0,
    radius_meters: payload.radius_meters ?? 100,
    is_active: true,
    is_client_location: true,
    client_id: clientId,
    sales_person_id: employeeId,
    contact_person: payload.contact_person ?? null,
    contact_phone: payload.contact_phone ?? null,
    notes: payload.notes ?? null,
    planned_start_time: plannedStartTime ?? '09:00:00',
    planned_end_time: plannedEndTime ?? '17:00:00',
  };

  const scheduledVisit: Record<string, unknown> = {
    organization_id: organizationId,
    lead_client_id: clientId,
    employee_id: employeeId,
    visit_date: visitDate,
    visit_purpose: payload.visit_purpose ?? '',
    status: 'scheduled',
    planned_start_time: plannedStartTime,
    planned_end_time: plannedEndTime,
    notes: payload.notes ?? null,
  };

  return {
    visitDate,
    plannedStartTime,
    plannedEndTime,
    visitPurpose: payload.visit_purpose ?? '',
    notes: payload.notes ?? null,
    clientId,
    employeeId,
    officeLocation,
    scheduledVisit,
  };
};
