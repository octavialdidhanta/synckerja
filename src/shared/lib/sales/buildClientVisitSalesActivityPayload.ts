import { normalizePaymentMethodForSalesActivity } from '@/shared/lib/leadConversionFinancial';

const DB_STATUSES = new Set([
  'Active',
  'Negotiating',
  'Won',
  'Lost',
  'Follow Up',
  'Converted',
]);

/** Maps mobile/UI status labels to `sales_activities.status` CHECK values. */
export function normalizeSalesActivityStatusForDb(ui: string | null | undefined): string {
  const trimmed = (ui ?? '').trim();
  if (DB_STATUSES.has(trimmed)) return trimmed;

  switch (trimmed.toLowerCase()) {
    case 'completed':
      return 'Won';
    case 'in_progress':
      return 'Active';
    case 'scheduled':
      return 'Follow Up';
    case 'cancelled':
      return 'Lost';
    default:
      return 'Active';
  }
}

/** Returns null when unpaid or empty — never persist `""` (violates payment_method CHECK). */
export function resolveSalesActivityPaymentMethod(
  isPaid: boolean | undefined,
  paymentMethod: string | null | undefined,
): string | null {
  if (!isPaid) return null;
  const raw = (paymentMethod ?? '').trim();
  if (!raw) return null;
  return normalizePaymentMethodForSalesActivity(raw);
}

export interface ClientVisitSalesActivityFormInput {
  client_name: string;
  client_phone?: string;
  activity_type: string;
  status: string;
  amount?: number;
  total_amount?: number;
  down_payment_amount?: number;
  is_down_payment?: boolean;
  description?: string;
  is_paid?: boolean;
  payment_method?: string;
  follow_up_date?: string;
  notes?: string;
  receipt_url?: string;
}

export function buildClientVisitSalesActivityInsertPayload(
  data: ClientVisitSalesActivityFormInput,
  organizationId: string,
  userId: string,
) {
  const totalAmount = data.total_amount ?? data.amount;
  const downPayment = data.is_down_payment ? data.down_payment_amount : undefined;
  const remaining =
    totalAmount != null && downPayment != null ? Math.max(0, totalAmount - downPayment) : undefined;

  return {
    organization_id: organizationId,
    client_name: data.client_name.trim(),
    client_phone: data.client_phone?.trim() || null,
    activity_type: data.activity_type || 'visit',
    status: normalizeSalesActivityStatusForDb(data.status),
    amount: data.amount ?? null,
    total_amount: totalAmount ?? null,
    down_payment_amount: downPayment ?? null,
    remaining_amount: remaining ?? null,
    is_down_payment: Boolean(data.is_down_payment),
    date: new Date().toISOString().split('T')[0],
    description: data.description?.trim() || null,
    is_paid: Boolean(data.is_paid),
    payment_method: resolveSalesActivityPaymentMethod(data.is_paid, data.payment_method),
    receipt_url: data.receipt_url?.trim() || null,
    follow_up_date: data.follow_up_date?.trim() || null,
    notes: data.notes?.trim() || null,
    created_by: userId,
  };
}
