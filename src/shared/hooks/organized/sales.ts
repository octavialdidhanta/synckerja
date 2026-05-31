// Sales hooks - Placeholder implementations
// TODO: Implement actual hooks based on Supabase queries

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { isResolvedStatus } from '@/5-3-whatsapp/constants/leadStatus';
import {
  assertSalesActivityClientContactFromSubmission,
  getLeadSubmissionEmailForLead,
  RESOLVE_EMAIL_REQUIRED_CODE,
  SALES_ACTIVITY_CONTACT_REQUIRED_CODE,
} from '@/shared/lib/leadSubmissionProfile';
import { invalidateGoogleAdsConversionUploads } from '@/5-3-dashboard/hooks/useGoogleAdsConversionUploadsMap';
import { kickGoogleAdsConversionAfterConverted } from '@/shared/lib/kickGoogleAdsConversionAfterConverted';
import { resolveLeadConversionSalesActivity } from '@/shared/lib/sales/resolveLeadConversionSalesActivity';
import {
  buildScheduleFromWizardPayload,
  type WizardLocationPayload,
} from '@/shared/lib/sales/scheduleVisitFromWizard';

const invalidateClientVisitQueries = (
  queryClient: QueryClient,
  organizationId: string | null | undefined,
) => {
  if (!organizationId) return;
  queryClient.invalidateQueries({ queryKey: ['visit-scheduling', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['client-visits', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['client-visits-metrics', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['office-locations', organizationId] });
};

const mapClientVisitRow = (row: any) => ({
  ...row,
  clientInfo: row.clients ?? null,
  locationInfo: row.office_locations ?? null,
  employees: row.employees ?? null,
});

const CLIENT_VISITS_SELECT = `
  *,
  clients ( id, company_name, contact_person, contact_phone, address ),
  employees ( id, full_name, email ),
  office_locations ( id, name, address )
`;

async function assertWaLeadSubmissionEmailBeforeResolve(
  organizationId: string,
  leadUuid: string | null | undefined,
): Promise<void> {
  if (!leadUuid) {
    throw new Error(RESOLVE_EMAIL_REQUIRED_CODE);
  }
  const email = await getLeadSubmissionEmailForLead(leadUuid, organizationId);
  if (!email) {
    throw new Error(RESOLVE_EMAIL_REQUIRED_CODE);
  }
}
import { emptyAttributionFlat, parseAttributionFields } from '@/shared/lib/leadAttribution';
import {
  resolveConversionLeadPayment,
  type ConversionLeadPaymentPayload,
} from '@/shared/lib/leadConversionFinancial';
import { insertIncomeTransactionFromSalesFlow } from '@/shared/lib/finance/insertIncomeTransactionFromSalesFlow';
import { resolveInstagramConversationIdByTicket } from '@/shared/lib/resolveInstagramConversationId';

// Types
export interface SalesActivity {
  id: string;
  client_name: string;
  activity_type: string;
  status: string;
  payment_method: string;
  total_amount: number;
  [key: string]: any;
}

export interface SalesActivityItem {
  id: string;
  service_name: string;
  sub_service_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

/** Resolve service_id and sub_service_id from lead's services (name) and category (name) for org. */
async function resolveServiceAndSubFromLead(
  supabaseClient: ReturnType<typeof supabase>,
  orgId: string,
  serviceName: string | null | undefined,
  categoryName: string | null | undefined
): Promise<{ serviceId: string | null; subServiceId: string | null; serviceName: string; subServiceName: string }> {
  const sn = (serviceName ?? '').trim();
  const cn = (categoryName ?? '').trim();
  if (!sn) {
    return { serviceId: null, subServiceId: null, serviceName: 'Lead Conversion', subServiceName: cn || '' };
  }
  const { data: serviceRow } = await supabaseClient
    .from('services')
    .select('id, name')
    .eq('organization_id', orgId)
    .ilike('name', sn)
    .maybeSingle();
  const resolvedServiceId = serviceRow?.id ?? null;
  const resolvedServiceName = serviceRow?.name ?? sn;
  let subServiceId: string | null = null;
  let resolvedSubName = cn;
  if (resolvedServiceId && cn) {
    const { data: subRow } = await supabaseClient
      .from('sub_services')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('service_id', resolvedServiceId)
      .ilike('name', cn)
      .maybeSingle();
    subServiceId = subRow?.id ?? null;
    resolvedSubName = subRow?.name ?? cn;
  }
  return {
    serviceId: resolvedServiceId,
    subServiceId,
    serviceName: resolvedServiceName,
    subServiceName: resolvedSubName,
  };
}

/** Get default unit_price from default_prices for (org, service_id, sub_service_id). Returns 0 if either id is null or no row. */
async function getDefaultPrice(
  supabaseClient: ReturnType<typeof supabase>,
  orgId: string,
  serviceId: string | null,
  subServiceId: string | null
): Promise<number> {
  if (!serviceId || !subServiceId) return 0;
  const { data, error } = await supabaseClient
    .from('default_prices')
    .select('unit_price')
    .eq('organization_id', orgId)
    .eq('service_id', serviceId)
    .eq('sub_service_id', subServiceId)
    .maybeSingle();
  if (error || !data) return 0;
  const n = Number(data.unit_price);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

export type ConvertedSalesActivityItemInput = {
  quantity: number;
  unit_price: number;
  notes?: string | null;
  /** Per-line service (name); falls back to lead-level `services` when omitted. */
  services?: string | null;
  /** Per-line category (sub-service name); falls back to lead-level `category` when omitted. */
  category?: string | null;
};

export type { ConversionLeadPaymentPayload } from '@/shared/lib/leadConversionFinancial';

/** Auto-create sales_activities when lead status becomes Converted (phone/email from lead_submissions). */
async function deleteSalesActivityCascade(activityId: string): Promise<void> {
  const { error: actDelErr } = await supabase.from('sales_activities').delete().eq('id', activityId);
  if (actDelErr) console.error('deleteSalesActivityCascade: activity', actDelErr);
}

async function rollbackConvertedSalesFinancial(
  activityId: string,
  insertedPaymentId: string | null,
): Promise<void> {
  if (insertedPaymentId) {
    const { data: inc } = await supabase
      .from('income_transactions')
      .select('id')
      .eq('sales_activity_payment_id', insertedPaymentId)
      .maybeSingle();
    if (inc?.id) {
      const { error: incDelErr } = await supabase.from('income_transactions').delete().eq('id', inc.id);
      if (incDelErr) console.error('rollbackConvertedSalesFinancial: income', incDelErr);
    }
  }
  await deleteSalesActivityCascade(activityId);
}

async function createConvertedSalesActivity(
  queryClient: QueryClient,
  args: {
    orgId: string;
    leadId: string;
    clientName: string;
    createdBy: string;
    services?: string | null;
    category?: string | null;
    description?: string | null;
    logLabel: string;
    /** When set (e.g. livechat quick action), insert these lines instead of default_prices × qty 1. */
    conversionItems?: ConvertedSalesActivityItemInput[] | null;
    /** When set (livechat Converted modal), records payment + income after items insert. */
    conversionPayment?: ConversionLeadPaymentPayload | null;
    /** Required when conversionPayment is set; org's exclusive omnichannel income bank. */
    omnichannelBankAccountId?: string | null;
  },
): Promise<string> {
  const contact = await assertSalesActivityClientContactFromSubmission(args.leadId, args.orgId);
  const useCustomItems =
    Array.isArray(args.conversionItems) && args.conversionItems.length > 0;

  let totalAmount: number;
  let itemRows: Array<{
    sales_activity_id: string;
    organization_id: string;
    service_id: string | null;
    sub_service_id: string | null;
    service_name: string;
    sub_service_name: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes: string | null;
  }>;

  let activityServiceId: string | null = null;
  let activitySubServiceId: string | null = null;

  if (useCustomItems) {
    totalAmount = 0;
    itemRows = [];
    for (const row of args.conversionItems!) {
      const q = Number(row.quantity);
      const p = Number(row.unit_price);
      if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p <= 0) {
        throw new Error('invalid_conversion_items');
      }
      const lineTotal = q * p;
      totalAmount += lineTotal;
    }
    itemRows = [];
    for (const row of args.conversionItems!) {
      const q = Number(row.quantity);
      const p = Number(row.unit_price);
      const lineTotal = q * p;
      const lineServices = (row.services ?? args.services ?? '').trim() || null;
      const lineCategory = (row.category ?? args.category ?? '').trim() || null;
      const { serviceId, subServiceId, serviceName: itemServiceName, subServiceName: itemSubServiceName } =
        await resolveServiceAndSubFromLead(supabase, args.orgId, lineServices, lineCategory);
      itemRows.push({
        sales_activity_id: '',
        organization_id: args.orgId,
        service_id: serviceId ?? null,
        sub_service_id: subServiceId ?? null,
        service_name: itemServiceName,
        sub_service_name: itemSubServiceName || null,
        quantity: q,
        unit_price: p,
        total_price: lineTotal,
        notes: row.notes != null && String(row.notes).trim() !== '' ? String(row.notes).trim() : null,
      });
    }
    if (itemRows.length > 0) {
      activityServiceId = itemRows[0].service_id;
      activitySubServiceId = itemRows[0].sub_service_id;
    }
  } else {
    const { serviceId, subServiceId, serviceName: itemServiceName, subServiceName: itemSubServiceName } =
      await resolveServiceAndSubFromLead(supabase, args.orgId, args.services, args.category);
    activityServiceId = serviceId;
    activitySubServiceId = subServiceId;
    const unitPrice = await getDefaultPrice(supabase, args.orgId, serviceId, subServiceId);
    const itemTotal = unitPrice * 1;
    totalAmount = itemTotal;
    itemRows = [];
    // defer single row until activity id exists
    itemRows.push({
      sales_activity_id: '',
      organization_id: args.orgId,
      service_id: serviceId ?? null,
      sub_service_id: subServiceId ?? null,
      service_name: itemServiceName,
      sub_service_name: itemSubServiceName || null,
      quantity: 1,
      unit_price: unitPrice,
      total_price: itemTotal,
      notes: null,
    });
  }

  const { data: newActivity, error: insertErr } = await supabase
    .from('sales_activities')
    .insert({
      organization_id: args.orgId,
      lead_id: args.leadId,
      client_name: args.clientName,
      client_phone: contact.client_phone,
      client_email: contact.client_email,
      activity_type: 'Lead Conversion',
      status: 'Converted',
      date: new Date().toISOString().slice(0, 10),
      created_by: args.createdBy,
      service_id: activityServiceId ?? undefined,
      sub_service_id: activitySubServiceId ?? undefined,
      total_amount: totalAmount,
      description: args.description ?? null,
    })
    .select('id')
    .single();
  if (insertErr) {
    console.error(`${args.logLabel}: sales_activities insert failed`, insertErr);
    throw insertErr;
  }
  const activityId = newActivity?.id as string | undefined;
  if (!activityId) {
    console.error(`${args.logLabel}: sales_activities insert returned no id`);
    throw new Error('sales_activity_insert_no_id');
  }

  const rowsToInsert = itemRows.map((r) => ({ ...r, sales_activity_id: activityId }));
  const { error: itemErr } = await supabase.from('sales_activity_items').insert(rowsToInsert);
  if (itemErr) {
    console.error(`${args.logLabel}: sales_activity_items insert failed`, itemErr);
    const { error: delErr } = await supabase.from('sales_activities').delete().eq('id', activityId);
    if (delErr) console.error(`${args.logLabel}: rollback sales_activities failed`, delErr);
    throw itemErr;
  }

  if (!args.conversionPayment) {
    queryClient.invalidateQueries({ queryKey: ['sales-activities', args.orgId] });
    queryClient.invalidateQueries({
      queryKey: ['lead-conversion-sales-activity', args.orgId, args.leadId],
    });
    kickGoogleAdsConversionAfterConverted({
      leadId: args.leadId,
      organizationId: args.orgId,
      salesActivityId: activityId,
    });
    return activityId;
  }

  const omnichannelBankId = args.omnichannelBankAccountId?.trim() ?? '';
  if (!omnichannelBankId) {
    await deleteSalesActivityCascade(activityId);
    throw new Error('converted_sales_omnichannel_bank_required');
  }

  let resolved: ReturnType<typeof resolveConversionLeadPayment>;
  try {
    resolved = resolveConversionLeadPayment(totalAmount, args.conversionPayment);
  } catch {
    await deleteSalesActivityCascade(activityId);
    throw new Error('converted_sales_payment_failed');
  }

  let insertedPaymentId: string | null = null;
  try {
    const receiptPath = args.conversionPayment.receiptStoragePath.trim();
    const payDate = args.conversionPayment.paymentDate.trim();

    const { data: payRow, error: payErr } = await supabase
      .from('sales_activity_payments')
      .insert({
        sales_activity_id: activityId,
        organization_id: args.orgId,
        payment_amount: resolved.paymentAmount,
        payment_date: payDate,
        payment_method: resolved.methodCanonical,
        payment_type: resolved.paymentType,
        payment_sequence: 1,
        created_by: args.createdBy,
        receipt_url: receiptPath,
        notes: args.description?.trim() ? String(args.description).trim() : null,
      })
      .select('id')
      .single();

    if (payErr) throw payErr;
    insertedPaymentId = (payRow?.id as string | undefined) ?? null;
    if (!insertedPaymentId) throw new Error('payment_insert_no_id');

    const { error: updActErr } = await supabase.from('sales_activities').update(resolved.activityPatch).eq('id', activityId);
    if (updActErr) throw updActErr;

    const paymentLabel = resolved.paymentType === 'final_payment' ? 'final payment' : 'down payment';
    await insertIncomeTransactionFromSalesFlow(supabase, {
      organizationId: args.orgId,
      userId: args.createdBy,
      transactionData: {
        transaction_date: payDate,
        amount: resolved.paymentAmount,
        customer_name: args.clientName,
        payment_method: resolved.methodCanonical,
        income_type_id: null,
        category_id: null,
        bank_account_id: omnichannelBankId,
        service_id: activityServiceId,
        sub_service_id: activitySubServiceId,
        description: `${paymentLabel} - Lead Conversion: ${args.clientName}`,
        receipt_url: receiptPath,
        sales_activity_payment_id: insertedPaymentId,
        status: 'pending',
      },
    });
  } catch (e) {
    console.error(`${args.logLabel}: payment/income step failed`, e);
    await rollbackConvertedSalesFinancial(activityId, insertedPaymentId);
    throw new Error('converted_sales_payment_failed');
  }

  queryClient.invalidateQueries({ queryKey: ['sales-activities', args.orgId] });
  queryClient.invalidateQueries({ queryKey: ['sales-activity-payments'] });
  queryClient.invalidateQueries({ queryKey: ['piutang-payment-verifications'] });
  queryClient.invalidateQueries({ queryKey: ['income-transactions', args.orgId] });
  queryClient.invalidateQueries({ queryKey: ['income-transactions'] });
  queryClient.invalidateQueries({ queryKey: ['income-metrics', args.orgId] });
  queryClient.invalidateQueries({ queryKey: ['monthly-income-data', args.orgId] });
  queryClient.invalidateQueries({
    queryKey: ['lead-conversion-sales-activity', args.orgId, args.leadId],
  });
  kickGoogleAdsConversionAfterConverted({
    leadId: args.leadId,
    organizationId: args.orgId,
    salesActivityId: activityId,
  });
  return activityId;
}

export interface CreateSalesActivityItemData {
  service_id: string;
  sub_service_id?: string;
  service_name: string;
  sub_service_name?: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

// Hook: useSalesActivities
export const useSalesActivities = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading: loading, refetch, error, isError } = useQuery({
    queryKey: ['sales-activities', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('sales_activities')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        devLog.error('❌ Error fetching sales activities:', error);
        throw error;
      }

      const rows = data || [];
      const uniqueServiceIds = [...new Set(rows.map((a: { service_id?: string | null }) => a.service_id).filter(Boolean))] as string[];
      const uniqueSubServiceIds = [...new Set(rows.map((a: { sub_service_id?: string | null }) => a.sub_service_id).filter(Boolean))] as string[];

      const [servicesResult, subServicesResult] = await Promise.all([
        uniqueServiceIds.length > 0
          ? supabase.from('services').select('id, name').in('id', uniqueServiceIds)
          : Promise.resolve({ data: [] }),
        uniqueSubServiceIds.length > 0
          ? supabase.from('sub_services').select('id, name').in('id', uniqueSubServiceIds)
          : Promise.resolve({ data: [] }),
      ]);

      const servicesMap = new Map<string, { id: string; name: string }>();
      (servicesResult.data || []).forEach((s: { id: string; name: string }) => servicesMap.set(s.id, { id: s.id, name: s.name }));
      const subServicesMap = new Map<string, { id: string; name: string }>();
      (subServicesResult.data || []).forEach((s: { id: string; name: string }) => subServicesMap.set(s.id, { id: s.id, name: s.name }));

      const enrichedActivities = rows.map((activity: Record<string, unknown>) => ({
        ...activity,
        services: activity.service_id ? servicesMap.get(activity.service_id as string) ?? null : null,
        sub_services: activity.sub_service_id ? subServicesMap.get(activity.sub_service_id as string) ?? null : null,
      }));
      
      devLog.debug('📊 Fetched sales activities:', enrichedActivities?.length || 0, 'activities for org:', organizationId);
      devLog.debug('📊 Sample activity data:', enrichedActivities?.[0] ? {
        id: enrichedActivities[0].id,
        client_name: enrichedActivities[0].client_name,
        service_id: enrichedActivities[0].service_id,
        services: enrichedActivities[0].services,
        sub_service_id: enrichedActivities[0].sub_service_id,
        sub_services: enrichedActivities[0].sub_services
      } : null);
      return enrichedActivities;
    },
    enabled: !!organizationId,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  /**
   * Deletion is best-effort: we delete items, payments, sales_payments, then the activity.
   * If a step fails we log and continue; the activity may be deleted while related rows remain.
   * Consider manual cleanup or future transactional delete.
   */
  const deleteSalesActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      devLog.debug('🗑️ Starting deletion process for sales activity:', activityId);

      // Step 1: Delete Sales Activity Items (sales_activity_items)
      const { error: itemsError } = await supabase
        .from('sales_activity_items')
        .delete()
        .eq('sales_activity_id', activityId);

      if (itemsError) {
        devLog.error('⚠️ Error deleting sales activity items:', itemsError);
        // Continue deletion even if items delete fails
      } else {
        devLog.debug('✅ Sales activity items deleted');
      }

      // Step 2: Delete Payment History (sales_activity_payments)
      const { error: paymentsError } = await supabase
        .from('sales_activity_payments')
        .delete()
        .eq('sales_activity_id', activityId);

      if (paymentsError) {
        devLog.error('⚠️ Error deleting payment history:', paymentsError);
        // Continue deletion even if payment history delete fails
      } else {
        devLog.debug('✅ Payment history (sales_activity_payments) deleted');
      }

      // Step 2b: Delete Sales Payments (sales_payments) if exists
      const { error: salesPaymentsError } = await supabase
        .from('sales_payments')
        .delete()
        .eq('sales_activity_id', activityId);

      if (salesPaymentsError) {
        devLog.error('⚠️ Error deleting sales payments:', salesPaymentsError);
        // Continue deletion even if sales payments delete fails
      } else {
        devLog.debug('✅ Sales payments deleted');
      }

      // Step 3: Delete the sales activity itself
      const { error: activityError } = await supabase
        .from('sales_activities')
        .delete()
        .eq('id', activityId);

      if (activityError) {
        devLog.error('❌ Error deleting sales activity:', activityError);
        throw activityError;
      }

      devLog.debug('✅ Sales activity and all related data deleted successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-activities', organizationId] });
    },
  });

  return {
    activities: activities as SalesActivity[],
    loading,
    refetch,
    error,
    isError,
    deleteSalesActivity: deleteSalesActivityMutation.mutateAsync,
  };
};

// Hook: useSalesActivityMasterData
export const useSalesActivityMasterData = () => {
  const { organizationId } = useCurrentOrg();
  
  // Debug: Log organizationId
  useEffect(() => {
    devLog.debug('🔍 useSalesActivityMasterData - organizationId:', organizationId);
  }, [organizationId]);

  const { data: incomeTypes = [], isLoading: incomeTypesLoading, isError: incomeTypesError } = useQuery({
    queryKey: ['income-types', organizationId],
    queryFn: async () => {
      devLog.debug('💰 Fetching income types for org:', organizationId);
      
      // Try to fetch with organization_id first, then fallback to null (global)
      let query = supabase
        .from('income_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      } else {
        // If no org, try to get global income types (organization_id IS NULL)
        query = query.is('organization_id', null);
      }

      const { data, error } = await query;

      if (error) {
        devLog.error('❌ Error fetching income types:', error);
        throw error;
      }
      
      devLog.debug('💰 Fetched income types:', data?.length || 0, 'types for org:', organizationId || 'null (global)');
      devLog.debug('💰 Income types data:', data);
      
      return data || [];
    },
    enabled: true, // Always enabled, will fetch global if no org
  });

  const { data: services = [], isError: servicesError } = useQuery({
    queryKey: ['services', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        devLog.error('Error fetching services:', error);
        throw error;
      }
      devLog.debug('📦 Fetched services:', data?.length || 0, 'services for org:', organizationId);
      devLog.debug('📦 Services data:', data);
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Fetch sub-services separately
  const { data: subServices = [], isError: subServicesError } = useQuery({
    queryKey: ['sub-services', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('sub_services')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        devLog.error('Error fetching sub-services:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Fetch income categories
  const { data: incomeCategories = [], isError: incomeCategoriesError } = useQuery({
    queryKey: ['income-categories', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('income_categories')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        devLog.error('Error fetching income categories:', error);
        throw error;
      }
      devLog.debug('📂 Fetched income categories:', data?.length || 0, 'categories for org:', organizationId);
      return data || [];
    },
    enabled: !!organizationId,
  });

  const getCategoriesByIncomeType = (incomeTypeId: string) => {
    if (!incomeTypeId) return [];
    return incomeCategories.filter((cat: any) => cat.income_types_id === incomeTypeId);
  };

  const getSubServicesByService = (serviceId: string) => {
    return subServices.filter((s: any) => s.service_id === serviceId);
  };

  // All services are parent services (no parent_service_id field in services table)
  const parentServices = services;

  // Debug logging
  useEffect(() => {
    devLog.debug('🔍 useSalesActivityMasterData - Master data state:', {
      organizationId,
      incomeTypesCount: incomeTypes.length,
      incomeCategoriesCount: incomeCategories.length,
      servicesCount: services.length,
      parentServicesCount: parentServices.length,
      subServicesCount: subServices.length
    });
  }, [organizationId, incomeTypes, incomeCategories, services, parentServices, subServices]);

  const masterDataError = incomeTypesError || servicesError || subServicesError || incomeCategoriesError;

  return {
    incomeTypes,
    incomeTypesLoading,
    incomeCategories,
    getCategoriesByIncomeType,
    services,
    parentServices,
    subServices,
    getSubServicesByService,
    masterDataError,
  };
};

// Hook: useSalesActivityItems
export const useSalesActivityItems = (salesActivityId?: string) => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: ['sales-activity-items', salesActivityId],
    queryFn: async () => {
      if (!salesActivityId) return [];
      
      const { data, error } = await supabase
        .from('sales_activity_items')
        .select('*')
        .eq('sales_activity_id', salesActivityId)
        .order('created_at');

      if (error) throw error;
      return data || [];
    },
    enabled: !!salesActivityId,
  });

  const syncActivityTotalFromItems = async () => {
    if (!salesActivityId || !organizationId) return;
    const { data: rows } = await supabase
      .from('sales_activity_items')
      .select('total_price')
      .eq('sales_activity_id', salesActivityId);
    const total = (rows ?? []).reduce((sum: number, r: { total_price?: number }) => sum + (Number(r.total_price) || 0), 0);
    await supabase
      .from('sales_activities')
      .update({ total_amount: total, updated_at: new Date().toISOString() })
      .eq('id', salesActivityId);
    queryClient.invalidateQueries({ queryKey: ['sales-activities', organizationId] });
  };

  const createItem = useMutation({
    mutationFn: async (itemData: CreateSalesActivityItemData) => {
      if (!salesActivityId) throw new Error('Sales activity ID is required');
      if (!organizationId) throw new Error('Organization is required to add item');
      
      const { data, error } = await supabase
        .from('sales_activity_items')
        .insert({
          service_id: itemData.service_id || null,
          sub_service_id: itemData.sub_service_id || null,
          service_name: itemData.service_name || 'Unnamed Service',
          sub_service_name: itemData.sub_service_name ?? null,
          quantity: itemData.quantity,
          unit_price: itemData.unit_price,
          notes: itemData.notes ?? null,
          sales_activity_id: salesActivityId,
          organization_id: organizationId,
          total_price: itemData.quantity * itemData.unit_price,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-activity-items', salesActivityId] });
      void syncActivityTotalFromItems().catch((e) => devLog.error('syncActivityTotalFromItems failed', e));
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...itemData }: Partial<CreateSalesActivityItemData> & { id: string }) => {
      // Allow empty string for service_id/sub_service_id (e.g. Lead Conversion item) -> store as null
      const payload: Record<string, unknown> = {
        ...itemData,
        total_price: itemData.quantity != null && itemData.unit_price != null
          ? itemData.quantity * itemData.unit_price
          : undefined,
      };
      if (payload.service_id === '') payload.service_id = null;
      if (payload.sub_service_id === '') payload.sub_service_id = null;
      if (payload.sub_service_name === '') payload.sub_service_name = null;
      const { data, error } = await supabase
        .from('sales_activity_items')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-activity-items', salesActivityId] });
      void syncActivityTotalFromItems().catch((e) => devLog.error('syncActivityTotalFromItems failed', e));
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('sales_activity_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-activity-items', salesActivityId] });
      void syncActivityTotalFromItems().catch((e) => devLog.error('syncActivityTotalFromItems failed', e));
    },
  });

  const getTotalAmount = () => {
    return items.reduce((sum: number, item: SalesActivityItem) => sum + item.total_price, 0);
  };

  return {
    items: items as SalesActivityItem[],
    loading,
    createItem: createItem.mutateAsync,
    updateItem: updateItem.mutateAsync,
    deleteItem: deleteItem.mutateAsync,
    getTotalAmount,
  };
};

// Hook: useSalesActivityPayments
export const useSalesActivityPayments = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  const getPaymentHistory = async (salesActivityId: string, organizationId?: string) => {
    console.log('🔍 Fetching payment history for salesActivityId:', salesActivityId, 'orgId:', organizationId);
    
    // Don't filter by organization_id - payments belong to sales_activity, not directly to org
    // The sales_activity itself has organization_id, so we don't need to filter payments by it
    const { data, error } = await supabase
      .from('sales_activity_payments')
      .select('*')
      .eq('sales_activity_id', salesActivityId)
      .order('payment_date', { ascending: false })
      .order('payment_sequence', { ascending: true }); // Also sort by sequence for consistency

    if (error) {
      console.error('❌ Error fetching payment history:', error);
      throw error;
    }
    
    console.log('💰 Payment history fetched:', data?.length || 0, 'payments');
    console.log('💰 Payment history data:', data);
    
    return data || [];
  };

  const createPaymentHistory = async (paymentData: any) => {
    const { data, error } = await supabase
      .from('sales_activity_payments')
      .insert(paymentData)
      .select()
      .single();

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['sales-activity-payments'] });
    queryClient.invalidateQueries({ queryKey: ['piutang-payment-verifications'] });
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: ['sales-activities', organizationId] });
    }
    return data;
  };

  const deletePaymentHistory = async (paymentId: string) => {
    const { error } = await supabase.from('sales_activity_payments').delete().eq('id', paymentId);

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['sales-activity-payments'] });
    queryClient.invalidateQueries({ queryKey: ['piutang-payment-verifications'] });
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: ['sales-activities', organizationId] });
    }
  };

  const updatePaymentHistory = async (
    paymentId: string,
    patch: Record<string, unknown>,
    scopeOrganizationId?: string | null,
  ) => {
    const org = scopeOrganizationId ?? organizationId;
    let q = supabase.from('sales_activity_payments').update(patch).eq('id', paymentId);
    if (org) {
      q = q.eq('organization_id', org);
    }
    const { error } = await q;
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['sales-activity-payments'] });
    queryClient.invalidateQueries({ queryKey: ['piutang-payment-verifications'] });
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: ['sales-activities', organizationId] });
    }
  };

  const updatePaymentVerification = async (params: {
    paymentId: string;
    status: 'unchecked' | 'approved' | 'rejected';
    verifiedByUserId: string | null | undefined;
  }) => {
    const { paymentId, status, verifiedByUserId } = params;
    const now = status === 'unchecked' ? null : new Date().toISOString();
    const by = status === 'unchecked' ? null : verifiedByUserId ?? null;
    const { error } = await supabase
      .from('sales_activity_payments')
      .update({
        transfer_verification_status: status,
        transfer_verified_at: now,
        transfer_verified_by: by,
      })
      .eq('id', paymentId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['sales-activity-payments'] });
    queryClient.invalidateQueries({ queryKey: ['piutang-payment-verifications'] });
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: ['sales-activities', organizationId] });
    }
  };

  const handleDownPayment = async (salesActivityId: string, paymentData: any) => {
    return createPaymentHistory({
      ...paymentData,
      sales_activity_id: salesActivityId,
      payment_type: 'down_payment',
    });
  };

  const handleFinalPayment = async (salesActivityId: string, paymentData: any) => {
    return createPaymentHistory({
      ...paymentData,
      sales_activity_id: salesActivityId,
      payment_type: 'final_payment',
    });
  };

  return {
    getPaymentHistory,
    createPaymentHistory,
    deletePaymentHistory,
    updatePaymentHistory,
    updatePaymentVerification,
    handleDownPayment,
    handleFinalPayment,
  };
};

// Hook: useOfficeLocations (for visit scheduling)
export const useOfficeLocations = () => {
  const { organizationId } = useCurrentOrg();

  const { data: locations = [] } = useQuery({
    queryKey: ['office-locations', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('office_locations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const addLocation = async (locationData: any) => {
    const { data, error } = await supabase
      .from('office_locations')
      .insert({
        ...locationData,
        organization_id: organizationId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  return {
    locations,
    addLocation,
  };
};

// Hook: useClients
export const useClients = () => {
  const { organizationId } = useCurrentOrg();

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', organizationId)
        .order('company_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  return {
    clients,
  };
};

// Hook: useLocationTypes
export const useLocationTypes = () => {
  const { organizationId } = useCurrentOrg();

  const { data: locationTypes = [] } = useQuery({
    queryKey: ['location-types', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('location_types')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  return {
    locationTypes,
  };
};

// Hook: useVisitScheduling (uses client_visits with joined client, employee, location)
export const useVisitScheduling = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: rawVisits = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['visit-scheduling', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('client_visits')
        .select(CLIENT_VISITS_SELECT)
        .eq('organization_id', organizationId)
        .order('visit_date', { ascending: false })
        .order('planned_start_time', { ascending: false });

      if (error) throw error;

      return (data || []).map(mapClientVisitRow);
    },
    enabled: !!organizationId,
  });

  const createScheduledVisit = async (visitData: any) => {
    if (!organizationId) throw new Error('Organization ID is required');

    const { data, error } = await supabase
      .from('client_visits')
      .insert({
        organization_id: organizationId,
        lead_client_id: visitData.client_id ?? visitData.lead_client_id,
        employee_id: visitData.employee_id ?? visitData.sales_person_id,
        validated_location_id: visitData.location_id ?? visitData.validated_location_id ?? null,
        visit_date: visitData.visit_date ?? visitData.scheduled_date,
        visit_purpose: visitData.visit_purpose ?? visitData.purpose ?? '',
        status: visitData.status ?? 'scheduled',
        planned_start_time: visitData.planned_start_time ?? visitData.plannedStartTime ?? null,
        planned_end_time: visitData.planned_end_time ?? visitData.plannedEndTime ?? null,
        notes: visitData.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    invalidateClientVisitQueries(queryClient, organizationId);
    return data;
  };

  const scheduleVisitFromWizard = async (payload: WizardLocationPayload) => {
    if (!organizationId) throw new Error('Organization ID is required');

    const parsed = buildScheduleFromWizardPayload(payload, organizationId);

    const { data: existingLocation, error: existingLocationError } = await supabase
      .from('office_locations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('client_id', parsed.clientId)
      .eq('sales_person_id', parsed.employeeId)
      .eq('is_client_location', true)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLocationError) throw existingLocationError;

    let locationId = existingLocation?.id ?? null;

    if (!locationId) {
      const { data: insertedLocation, error: locationError } = await supabase
        .from('office_locations')
        .insert(parsed.officeLocation)
        .select('id')
        .single();

      if (locationError) throw locationError;
      locationId = insertedLocation.id;
    } else if (parsed.plannedStartTime || parsed.plannedEndTime) {
      const { error: syncLocationError } = await supabase
        .from('office_locations')
        .update({
          ...(parsed.plannedStartTime ? { planned_start_time: parsed.plannedStartTime } : {}),
          ...(parsed.plannedEndTime ? { planned_end_time: parsed.plannedEndTime } : {}),
        })
        .eq('id', locationId)
        .eq('organization_id', organizationId);

      if (syncLocationError) throw syncLocationError;
    }

    const { data, error } = await supabase
      .from('client_visits')
      .insert({
        ...parsed.scheduledVisit,
        validated_location_id: locationId,
      })
      .select()
      .single();

    if (error) throw error;
    invalidateClientVisitQueries(queryClient, organizationId);
    return data;
  };

  const updateClientVisit = async (
    visitId: string,
    payload: {
      visit_date?: string;
      planned_start_time?: string | null;
      planned_end_time?: string | null;
      visit_purpose?: string;
      notes?: string | null;
    },
  ) => {
    if (!organizationId) throw new Error('Organization ID is required');

    const { error: updateError } = await supabase
      .from('client_visits')
      .update(payload)
      .eq('id', visitId)
      .eq('organization_id', organizationId);

    if (updateError) throw updateError;
    invalidateClientVisitQueries(queryClient, organizationId);
  };

  const cancelClientVisit = async (visitId: string) => {
    if (!organizationId) throw new Error('Organization ID is required');

    const { data, error: updateError } = await supabase
      .from('client_visits')
      .update({ status: 'cancelled' })
      .eq('id', visitId)
      .eq('organization_id', organizationId)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!data) {
      throw new Error('Only scheduled visits can be cancelled');
    }
    invalidateClientVisitQueries(queryClient, organizationId);
  };

  return {
    visits: rawVisits,
    loading,
    refetch,
    createScheduledVisit,
    scheduleVisitFromWizard,
    updateClientVisit,
    cancelClientVisit,
  };
};

// Hook: useClientVisits
export const useClientVisits = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: visits = [], isLoading: loading, refetch, error, isError } = useQuery({
    queryKey: ['client-visits', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('client_visits')
        .select(CLIENT_VISITS_SELECT)
        .eq('organization_id', organizationId)
        .order('visit_date', { ascending: false })
        .order('planned_start_time', { ascending: false });

      if (error) {
        console.error('❌ Error fetching client visits:', error);
        throw error;
      }

      return (data || []).map(mapClientVisitRow);
    },
    enabled: !!organizationId,
  });

  const updateClientVisit = async (
    visitId: string,
    payload: {
      visit_date?: string;
      planned_start_time?: string | null;
      planned_end_time?: string | null;
      visit_purpose?: string;
      notes?: string | null;
    },
  ) => {
    if (!organizationId) throw new Error('Organization ID is required');

    const { error: updateError } = await supabase
      .from('client_visits')
      .update(payload)
      .eq('id', visitId)
      .eq('organization_id', organizationId);

    if (updateError) throw updateError;
    invalidateClientVisitQueries(queryClient, organizationId);
  };

  const cancelClientVisit = async (visitId: string) => {
    if (!organizationId) throw new Error('Organization ID is required');

    const { data, error: updateError } = await supabase
      .from('client_visits')
      .update({ status: 'cancelled' })
      .eq('id', visitId)
      .eq('organization_id', organizationId)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!data) {
      throw new Error('Only scheduled visits can be cancelled');
    }
    invalidateClientVisitQueries(queryClient, organizationId);
  };

  return {
    visits,
    loading,
    refetch,
    error,
    isError,
    updateClientVisit,
    cancelClientVisit,
  };
};

// Hook: useClientVisitsMetrics
export const useClientVisitsMetrics = () => {
  const { organizationId } = useCurrentOrg();

  const { data: visits = [], isLoading: loading } = useQuery({
    queryKey: ['client-visits-metrics', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('client_visits')
        .select('status')
        .eq('organization_id', organizationId);

      if (error) {
        console.error('❌ Error fetching client visits metrics:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!organizationId,
  });

  const metrics = {
    total: visits.length,
    scheduled: visits.filter((v: any) => v.status === 'scheduled').length,
    completed: visits.filter((v: any) => v.status === 'completed').length,
    cancelled: visits.filter((v: any) => v.status === 'cancelled').length,
  };

  return {
    metrics,
    loading,
  };
};

// Hook: useIncomeTransactions
/** Minimal income insert for sales flows (e.g. PaymentUpdateModal). Must match `income_transactions` columns. */
export const useIncomeTransactions = () => {
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const createIncomeTransaction = useMutation({
    mutationFn: async (transactionData: Record<string, unknown>) => {
      if (!organizationId) throw new Error('Organization ID is required');
      if (!user?.id) throw new Error('User authentication required');

      const data = await insertIncomeTransactionFromSalesFlow(supabase, {
        organizationId,
        userId: user.id,
        transactionData,
      });

      queryClient.invalidateQueries({ queryKey: ['income-transactions', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['income-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['income-metrics', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['monthly-income-data', organizationId] });
      return data;
    },
  });

  return {
    createIncomeTransaction: createIncomeTransaction.mutateAsync,
  };
};

// Types for Lead Status History
export interface LeadStatusHistoryEntry {
  id: string;
  lead_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string | null;
  changed_by_name: string | null;
  notes: string | null;
  organization_id: string;
  created_at: string;
}

// Hook: useLeadStatusHistory
export const useLeadStatusHistory = () => {
  const { organizationId } = useCurrentOrg();

  const getStatusHistory = async (leadId: string): Promise<LeadStatusHistoryEntry[]> => {
    if (!organizationId) {
      console.error('Organization ID is required');
      return [];
    }

    if (!leadId) {
      console.error('Lead ID is required');
      return [];
    }

    try {
      // WhatsApp conversation: fetch from whatsapp_conversation_status_history
      if (String(leadId).startsWith('wa-')) {
        const conversationId = String(leadId).replace(/^wa-/, '');
        const { data, error } = await supabase
          .from('whatsapp_conversation_status_history')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('organization_id', organizationId)
          .order('changed_at', { ascending: false });

        if (error) {
          console.error('Error fetching WhatsApp conversation status history:', error);
          throw error;
        }

        const rows = (data || []) as Array<{
          id: string;
          conversation_id: string;
          old_status: string | null;
          new_status: string;
          changed_at: string;
          changed_by: string | null;
          changed_by_name: string | null;
          notes: string | null;
          organization_id: string;
          created_at: string;
        }>;
        return rows.map((row) => ({
          id: row.id,
          lead_id: leadId,
          old_status: row.old_status,
          new_status: row.new_status,
          changed_at: row.changed_at,
          changed_by: row.changed_by,
          changed_by_name: row.changed_by_name,
          notes: row.notes,
          organization_id: row.organization_id,
          created_at: row.created_at,
        }));
      }

      const { data, error } = await supabase
        .from('lead_status_history')
        .select('*')
        .eq('lead_id', leadId)
        .eq('organization_id', organizationId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Error fetching lead status history:', error);
        throw error;
      }

      return (data || []) as LeadStatusHistoryEntry[];
    } catch (error) {
      console.error('Error in getStatusHistory:', error);
      return [];
    }
  };

  return {
    getStatusHistory,
    loading: false, // Manual fetching doesn't need loading state from useQuery
  };
};

// Hook: useClientProfileStatus
export const useClientProfileStatus = (leadId: string) => {
  const { organizationId } = useCurrentOrg();
  const isWhatsApp = leadId.startsWith('wa-');
  const conversationId = isWhatsApp ? leadId.replace(/^wa-/, '') : null;

  const isEmail = leadId.startsWith('email-');

  const { data: profile, isLoading: loading } = useQuery({
    queryKey: ['client-profile-status', leadId, organizationId],
    queryFn: async () => {
      if (!leadId || !organizationId) return null;

      // Email leads: no client profile table yet; treat as empty (lead_id is synthetic, not UUID)
      if (isEmail) return null;

      if (isWhatsApp && conversationId) {
        const { data, error } = await supabase
          .from('whatsapp_conversation_client_profiles')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('organization_id', organizationId)
          .maybeSingle();
        if (error) {
          console.error('Error fetching WhatsApp client profile:', error);
          return null;
        }
        return data;
      }

      const { fetchLeadSubmissionForProfile } = await import('@/shared/lib/leadSubmissionProfile');
      return fetchLeadSubmissionForProfile(leadId, organizationId);
    },
    enabled: !!leadId && !!organizationId,
  });

  // Calculate status based on profile data (termasuk phone_number dan email)
  const status: 'full' | 'partial' | 'empty' = (() => {
    if (!profile) return 'empty';

    const fields = [
      profile.name,
      (profile as any).code,
      profile.gender,
      profile.age,
      profile.occupation,
      profile.location,
      (profile as any).phone_number,
      (profile as any).email
    ];
    
    const filledFields = fields.filter(
      field => field !== null && field !== undefined && field !== ''
    ).length;

    if (filledFields === 0) {
      return 'empty';
    } else if (filledFields === fields.length) {
      return 'full';
    } else {
      return 'partial';
    }
  })();

  return {
    status,
    loading,
    profile,
  };
};

// Scope: 'mine' = only leads/chats assigned to current agent; 'unassigned' = only not assigned; 'all' = no filter
export type LeadsScope = 'all' | 'mine' | 'unassigned';

function filterLeadsByScope(
  list: Array<{ assignee_id?: string | null; id?: string }>,
  scope: LeadsScope,
  currentEmployeeId: string | null
): typeof list {
  if (scope === 'all') return list;
  if (scope === 'mine') {
    if (!currentEmployeeId) return [];
    return list.filter((item) => (item.assignee_id ?? null) === currentEmployeeId);
  }
  // unassigned
  return list.filter((item) => (item.assignee_id ?? null) == null);
}

function trimAttributionLabel(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function trimGclid(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Flatten `attribution` json for UI; virtual WA/IG rows have no marketing attribution. */
function withLeadAttributionShape(lead: Record<string, unknown>): Record<string, unknown> {
  const idStr = String(lead.id ?? '');
  const fromWa = lead._fromWhatsApp === true || idStr.startsWith('wa-');
  if (fromWa) {
    const z = emptyAttributionFlat();
    return {
      ...lead,
      attribution: null,
      attribution_label: null,
      gclid: null,
      ...z,
    };
  }
  const flat = parseAttributionFields(lead.attribution);
  return {
    ...lead,
    ...flat,
    attribution_label: trimAttributionLabel(lead.attribution_label),
    gclid: trimGclid(lead.gclid),
  };
}

// Hook: useLeads
export const useLeads = (options?: { scope?: LeadsScope }) => {
  const scope = options?.scope ?? 'mine';
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const {
    data: currentEmployee,
    isFetched: employeeFetched,
    isLoading: employeeLoading,
  } = useCurrentUserEmployee();
  const currentEmployeeId = currentEmployee?.id ?? null;
  const { isOwner } = useCentralizedUserData();
  // Owner always sees all leads regardless of scope
  const effectiveScope: LeadsScope = isOwner ? 'all' : scope;

  const invalidateCycleDerivedCrmQueries = useCallback(() => {
    if (!organizationId) return;
    queryClient.invalidateQueries({ queryKey: ['whatsapp-cycle-metrics', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['crm-first-response-per-room', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['crm-sla-conversation', organizationId] });
  }, [organizationId, queryClient]);

  // Realtime: leads + WA/IG conversations; cycle rows drive Performance / First response / Resolution CRM sections.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!organizationId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    channelRef.current = supabase
      .channel('leads_management_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversation_cycles' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          invalidateCycleDerivedCrmQueries();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          invalidateCycleDerivedCrmQueries();
          // Livechat Quick Action reads `whatsapp-conversation-status` / IG equivalent — refetch assignee & status.
          queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation-status'] });
          queryClient.invalidateQueries({ queryKey: ['instagram-conversation-status'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          invalidateCycleDerivedCrmQueries();
          queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation-status'] });
          queryClient.invalidateQueries({ queryKey: ['instagram-conversation-status'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'whatsapp_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          invalidateCycleDerivedCrmQueries();
          queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation-status'] });
          queryClient.invalidateQueries({ queryKey: ['instagram-conversation-status'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          invalidateCycleDerivedCrmQueries();
          queryClient.invalidateQueries({ queryKey: ['email-conversation-status'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instagram_conversation_cycles' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          invalidateCycleDerivedCrmQueries();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_conversation_cycles' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          invalidateCycleDerivedCrmQueries();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organization_omnichannel_sla' },
        () => {
          invalidateCycleDerivedCrmQueries();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organization_sla_policies' },
        () => {
          invalidateCycleDerivedCrmQueries();
          queryClient.invalidateQueries({ queryKey: ['organization-sla-policies', organizationId] });
          queryClient.invalidateQueries({ queryKey: ['organization-omnichannel-sla', organizationId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organization_sla_policy_conditions' },
        () => {
          invalidateCycleDerivedCrmQueries();
          queryClient.invalidateQueries({ queryKey: ['organization-sla-policies', organizationId] });
          queryClient.invalidateQueries({ queryKey: ['organization-omnichannel-sla', organizationId] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_follow_up_updates' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }
      )
      .subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [organizationId, queryClient, invalidateCycleDerivedCrmQueries]);

  // Fetch leads with join to lead_statuses; filter by scope (assignee_id)
  const queryEnabled =
    !!organizationId &&
    (effectiveScope === 'all' || !!currentEmployeeId || effectiveScope === 'unassigned');
  /** Scope `mine` waits for employee row before leads query can enable — avoid one-frame empty UI. */
  const employeeWait =
    !!organizationId &&
    effectiveScope === 'mine' &&
    !isOwner &&
    (!employeeFetched || employeeLoading);

  const {
    data: rawLeadsList = [],
    isLoading: loading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['leads', organizationId, effectiveScope, currentEmployeeId, isOwner],
    queryFn: async () => {
      if (!organizationId) return [];

      // 1) Fetch all leads from "leads" table
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (leadsError) {
        console.error('Error fetching leads:', leadsError);
        throw leadsError;
      }

      const rawLeads = leadsData ?? [];

      // Fetch all lead statuses for this organization + global (org_id null) so Resolve/Unread etc. resolve correctly
      let statusMap = new Map<string, { id: string; name: string; color: string }>();
      const { data: statusesData, error: statusesError } = await supabase
        .from('lead_statuses')
        .select('id, name, color, is_active')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`);

      const normId = (id: string | null | undefined) => (id == null ? '' : String(id));
      const normTicket = (t: string | null | undefined) => (t == null ? '' : String(t).trim().toUpperCase());
      if (!statusesError && statusesData) {
        statusesData.forEach((status: any) => {
          const id = normId(status.id);
          statusMap.set(id, { id: status.id, name: status.name, color: status.color });
        });
      }
      const missingStatusIds = [...new Set(
        rawLeads
          .map((lead: any) => lead.status_id)
          .filter((statusId: string) => statusId && !statusMap.has(normId(statusId)))
      )];
      if (missingStatusIds.length > 0) {
        const { data: missingStatuses, error: missingError } = await supabase
          .from('lead_statuses')
          .select('id, name, color, is_active')
          .in('id', missingStatusIds);
        if (!missingError && missingStatuses) {
          missingStatuses.forEach((status: any) => {
            const id = normId(status.id);
            statusMap.set(id, { id: status.id, name: status.name, color: status.color });
          });
        }
      }

      // Merge leads with their status information
      let leadsWithStatus = rawLeads.map((lead: any) => {
        const status = statusMap.get(normId(lead.status_id));
        return {
          ...lead,
          lead_status: status || null,
        };
      });

      // 2) Fetch leads from whatsapp_conversations (same org; includes channel: whatsapp | instagram) and map to lead-like rows
      const { data: whatsappConvs, error: whatsappError } = await supabase
        .from('whatsapp_conversations')
        .select('id, organization_id, customer_wa_id, customer_name, channel, last_message_at, last_message_body, last_opened_at, lead_status_id, last_inbound_at, followup, fu_priority, assignee_id, created_at, updated_at, ticket_id, meta_session_expires_at, template_followup_awaiting_reply, follow_up_cycle_reset_at')
        .eq('organization_id', organizationId)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      // Resolve assignee_id → assignee name for ALL leads (regular + WhatsApp) so Consultant Performance section has data
      const assigneeIdsFromLeads = [...new Set(rawLeads.map((l: any) => l.assignee_id).filter(Boolean))] as string[];
      const assigneeIdsFromWa = (whatsappConvs ?? []).map((c: any) => c.assignee_id).filter(Boolean) as string[];
      const allAssigneeIds = [...new Set([...assigneeIdsFromLeads, ...assigneeIdsFromWa])];
      const assigneeNameMap = new Map<string, string>();
      if (allAssigneeIds.length > 0) {
        const { data: assigneeRows } = await supabase
          .from('employees')
          .select('id, full_name, email')
          .in('id', allAssigneeIds);
        (assigneeRows ?? []).forEach((e: any) => {
          assigneeNameMap.set(normId(e.id), e.full_name || e.email || '');
        });
      }
      leadsWithStatus = leadsWithStatus.map((lead: any) => ({
        ...lead,
        assignee: (lead.assignee && String(lead.assignee).trim()) ? lead.assignee : (lead.assignee_id ? assigneeNameMap.get(normId(lead.assignee_id)) ?? null : null),
      }));

      // Ensure statusMap has all statuses used by WhatsApp/Instagram so overwrite below can resolve Resolve/Closed etc.
      if (whatsappConvs && whatsappConvs.length > 0) {
        const waStatusIds = [...new Set(whatsappConvs.map((c: any) => c.lead_status_id).filter(Boolean))].filter((id: string) => !statusMap.has(normId(id)));
        if (waStatusIds.length > 0) {
          const { data: waStatuses, error: waErr } = await supabase
            .from('lead_statuses')
            .select('id, name, color, is_active')
            .in('id', waStatusIds);
          if (!waErr && waStatuses) {
            waStatuses.forEach((status: any) => {
              const id = normId(status.id);
              statusMap.set(id, { id: status.id, name: status.name, color: status.color });
            });
          }
        }
      }

      // Sync status and assignee from WhatsApp/Instagram conversation when lead has matching ticket_id (DB truth; Meta expiry via lead_status Expired + meta_session_expires_at).
      if (whatsappConvs && whatsappConvs.length > 0) {
        const convByTicketId = new Map<
          string,
          {
            lead_status_id: string | null;
            assignee_id: string | null;
            meta_session_expires_at: string | null;
            followup: number | null;
            fu_priority: string | null;
            template_followup_awaiting_reply: boolean;
            follow_up_cycle_reset_at: string | null;
          }
        >();
        whatsappConvs.forEach((c: any) => {
          const isInstagram = (c.channel ?? '').toLowerCase() === 'instagram';
          const waTicketId = c.ticket_id ?? ((isInstagram ? 'IG-' : 'WA-') + String(c.id).replace(/-/g, '').slice(0, 8).toUpperCase());
          convByTicketId.set(normTicket(waTicketId), {
            lead_status_id: c.lead_status_id ?? null,
            assignee_id: c.assignee_id ?? null,
            meta_session_expires_at: c.meta_session_expires_at ?? null,
            followup: c.followup ?? null,
            fu_priority: c.fu_priority ?? null,
            template_followup_awaiting_reply: Boolean(c.template_followup_awaiting_reply),
            follow_up_cycle_reset_at: c.follow_up_cycle_reset_at ?? null,
          });
        });
        leadsWithStatus = leadsWithStatus.map((lead: any) => {
          const key = normTicket(lead.ticket_id);
          if (!key) return lead;
          const conv = convByTicketId.get(key);
          if (!conv) return lead;
          const statusId = conv.lead_status_id ?? lead.status_id;
          const status = conv.lead_status_id ? statusMap.get(normId(conv.lead_status_id)) ?? null : null;
          const convAssigneeId = conv.assignee_id ?? null;
          return {
            ...lead,
            status_id: statusId,
            // Never keep stale leads-row status when conversation has lead_status_id (Resolved shows as In Progress in table UI).
            lead_status: conv.lead_status_id ? status : lead.lead_status,
            // Livechat + send gate use whatsapp_conversations.assignee_id — do not show stale leads-row assignee when conv is cleared (e.g. after resolve).
            assignee_id: convAssigneeId,
            assignee:
              convAssigneeId != null
                ? (assigneeNameMap.get(normId(convAssigneeId)) ?? lead.assignee ?? '')
                : '',
            meta_session_expires_at: conv.meta_session_expires_at ?? (lead as { meta_session_expires_at?: string | null }).meta_session_expires_at ?? null,
            followup: conv.followup ?? lead.followup,
            fu_priority: conv.fu_priority ?? lead.fu_priority,
            template_followup_awaiting_reply: conv.template_followup_awaiting_reply,
            follow_up_cycle_reset_at: conv.follow_up_cycle_reset_at ?? lead.follow_up_cycle_reset_at ?? null,
          };
        });
      }

      const defaultStatusId = statusesData?.[0]?.id ?? '';

      // 3) Fetch email conversations early so we can build ticket_id list for lead lookup
      const { data: emailConvs, error: emailError } = await supabase.rpc('get_email_conversations_with_preview', {
        p_organization_id: organizationId,
      });

      // Collect ticket_ids from WA/Email conversations and fetch leads by ticket_id for services/category
      const waTicketIds = (whatsappConvs ?? []).map((c: any) => {
        const isInstagram = (c.channel ?? '').toLowerCase() === 'instagram';
        return c.ticket_id ?? ((isInstagram ? 'IG-' : 'WA-') + String(c.id).replace(/-/g, '').slice(0, 8).toUpperCase());
      });
      const emailTicketIds = (emailConvs ?? []).map((c: any) => 'EMAIL-' + String(c.id).replace(/-/g, '').slice(0, 8).toUpperCase());
      const allConvTicketIds = [...new Set([...waTicketIds, ...emailTicketIds])];
      const leadByTicketMap = new Map<string, { services: string | null; category: string | null }>();
      if (allConvTicketIds.length > 0) {
        const { data: convLeads } = await supabase
          .from('leads')
          .select('ticket_id, services, category')
          .eq('organization_id', organizationId)
          .in('ticket_id', allConvTicketIds);
        (convLeads ?? []).forEach((row: any) => {
          leadByTicketMap.set(String(row.ticket_id), {
            services: row.services ?? null,
            category: row.category ?? null,
          });
        });
      }

      // Ticket IDs that already have a row in table "leads" — jangan tampilkan duplikat dari virtual conv (normalize case)
      const ticketIdsInLeadsTable = new Set((rawLeads as any[]).map((l: any) => normTicket(l.ticket_id)).filter(Boolean));

      if (!whatsappError && whatsappConvs && whatsappConvs.length > 0) {
        const waConvsWithoutLead = whatsappConvs.filter((c: any) => {
          const isInstagram = (c.channel ?? '').toLowerCase() === 'instagram';
          const waTicketId = c.ticket_id ?? ((isInstagram ? 'IG-' : 'WA-') + String(c.id).replace(/-/g, '').slice(0, 8).toUpperCase());
          return !ticketIdsInLeadsTable.has(normTicket(waTicketId));
        });
        const whatsappAsLeads = waConvsWithoutLead.map((c: any) => {
          const statusId = c.lead_status_id ?? '';
          const leadStatus = statusId ? statusMap.get(normId(statusId)) ?? null : null;
          const isInstagram = (c.channel ?? '').toLowerCase() === 'instagram';
          const sourceLabel = isInstagram ? 'Instagram' : 'WhatsApp';
          const channelKey = isInstagram ? 'instagram' : 'whatsapp';
          const waTicketId = c.ticket_id ?? ((isInstagram ? 'IG-' : 'WA-') + String(c.id).replace(/-/g, '').slice(0, 8).toUpperCase());
          const leadRow = leadByTicketMap.get(waTicketId);
          const assigneeId = c.assignee_id ?? null;
          const assigneeName = assigneeId ? assigneeNameMap.get(normId(assigneeId)) ?? null : null;
          return {
            id: 'wa-' + c.id,
            client: c.customer_name || c.customer_wa_id || sourceLabel,
            title: (c.last_message_body || sourceLabel).slice(0, 100),
            services: leadRow?.services ?? null,
            category: leadRow?.category ?? '-',
            assignee: assigneeName as string | null,
            assignee_id: assigneeId,
            fu_priority: c.fu_priority ?? null,
            status_id: statusId,
            source: sourceLabel,
            channel: channelKey,
            followup: c.followup ?? 0,
            template_followup_awaiting_reply: Boolean(c.template_followup_awaiting_reply),
            follow_up_cycle_reset_at: c.follow_up_cycle_reset_at ?? null,
            converted_at: null,
            created_at: c.created_at,
            updated_at: c.updated_at,
            created_by: '',
            created_by_name: '',
            organization_id: c.organization_id,
            ticket_id: waTicketId,
            lead_status: leadStatus,
            meta_session_expires_at: c.meta_session_expires_at ?? null,
            _fromWhatsApp: true as const,
            _chatOpenedAt: c.last_opened_at ?? null,
            _customerWaId: (c.customer_wa_id ?? '') as string,
          };
        });
        leadsWithStatus = [...leadsWithStatus, ...whatsappAsLeads];
      }

      // Email: only show in leads list if they have a row in leads table (user clicked "Mark as lead" in livechat).
      // Do not merge email conversations without a lead as virtual leads.

      leadsWithStatus = leadsWithStatus.map((row) => withLeadAttributionShape(row as Record<string, unknown>) as (typeof leadsWithStatus)[number]);

      return filterLeadsByScope(leadsWithStatus, effectiveScope, currentEmployeeId);
    },
    enabled: queryEnabled,
    refetchInterval: 10000, // Fallback refresh setiap 10s (sama seperti tab live chat)
  });

  const leads = rawLeadsList;

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async (leadData: any) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown';

      const { data, error } = await supabase
        .from('leads')
        .insert({
          client: leadData.client,
          title: leadData.title,
          services: leadData.services || null,
          category: leadData.category || null,
          assignee: leadData.assignee,
          assignee_id: (leadData as { assignee_id?: string | null }).assignee_id ?? null,
          fu_priority: leadData.fu_priority || null,
          status_id: leadData.status_id,
          source: leadData.source || null,
          organization_id: organizationId,
          created_by: userId || '',
          created_by_name: userName,
          followup: 0,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating lead:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
    },
  });

  // Update lead mutation
  const updateLeadMutation = useMutation({
    onMutate: async (lead: { id?: string; assignee_id?: string | null; assignee?: string | null }) => {
      if (!lead?.id) return undefined;
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const snapshots = queryClient.getQueriesData<unknown[]>({ queryKey: ['leads'] });
      const nextAssigneeId = lead.assignee_id ?? null;
      const nextAssigneeName = (lead.assignee && String(lead.assignee).trim()) || '';
      queryClient.setQueriesData<unknown[]>({ queryKey: ['leads'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((row) => {
          const r = row as { id?: string };
          if (r.id !== lead.id) return row;
          return {
            ...row,
            assignee_id: nextAssigneeId,
            assignee: nextAssigneeId ? nextAssigneeName : '',
          };
        });
      });
      return { snapshots };
    },
    onError: (_err, _lead, context) => {
      context?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    mutationFn: async (lead: any) => {
      // Email conversation: update email_conversations.lead_status_id, sync to leads, create sales_activities on Converted
      if (lead?.id && String(lead.id).startsWith('email-')) {
        const convId = String(lead.id).replace(/^email-/, '');
        const orgId = lead.organization_id ?? organizationId;
        // FK: only set lead_status_id if it exists in lead_statuses. Uses same client/RLS as dropdown;
        // ensure lead_statuses RLS allows global (organization_id IS NULL) statuses so Resolve/Unread are found.
        let safeStatusId: string | null = null;
        if (lead.status_id) {
          const { data: statusExists } = await supabase
            .from('lead_statuses')
            .select('id')
            .eq('id', lead.status_id)
            .maybeSingle();
          if (statusExists?.id) safeStatusId = lead.status_id;
        }
        let newStatusName = '';
        if (safeStatusId) {
          const { data: statusRow } = await supabase
            .from('lead_statuses')
            .select('name')
            .eq('id', safeStatusId)
            .maybeSingle();
          newStatusName = (statusRow?.name as string) ?? '';
        }
        const oldEmailStatusName = lead.lead_status?.name ?? null;
        const clearEmailAssigneeOnResolve =
          isResolvedStatus(newStatusName) && !isResolvedStatus(oldEmailStatusName);
        let emailPriorAssigneeId: string | null = null;
        if (clearEmailAssigneeOnResolve) {
          const { data: emailConvBefore } = await supabase
            .from('email_conversations')
            .select('assignee_id')
            .eq('id', convId)
            .maybeSingle();
          emailPriorAssigneeId = (emailConvBefore?.assignee_id as string | null) ?? null;
        }
        const emailConvPatch: Record<string, unknown> = {
          lead_status_id: safeStatusId,
          updated_at: new Date().toISOString(),
        };
        if (clearEmailAssigneeOnResolve) {
          emailConvPatch.assignee_id = null;
          const handlerId =
            emailPriorAssigneeId ?? (lead as { assignee_id?: string | null }).assignee_id ?? null;
          if (handlerId) emailConvPatch.last_handling_assignee_id = handlerId;
        } else {
          const emailAssignee = (lead as { assignee_id?: string | null }).assignee_id;
          if (emailAssignee !== undefined) {
            emailConvPatch.assignee_id = emailAssignee;
          }
        }
        const { error: updateError } = await supabase.from('email_conversations').update(emailConvPatch).eq('id', convId);
        if (updateError) {
          console.error('Error updating email conversation status:', updateError);
          throw updateError;
        }
        const ticketId = 'EMAIL-' + convId.replace(/-/g, '').slice(0, 8).toUpperCase();
        if (orgId && safeStatusId) {
          const emailLeadPatch: {
            status_id: string;
            updated_at: string;
            assignee_id?: null;
            assignee?: string;
          } = { status_id: safeStatusId, updated_at: new Date().toISOString() };
          if (clearEmailAssigneeOnResolve) {
            emailLeadPatch.assignee_id = null;
            emailLeadPatch.assignee = '';
          }
          await supabase
            .from('leads')
            .update(emailLeadPatch)
            .eq('organization_id', orgId)
            .eq('ticket_id', ticketId);
        }
        if (clearEmailAssigneeOnResolve) {
          const now = new Date().toISOString();
          const { error: emCycleErr } = await supabase
            .from('email_conversation_cycles')
            .update({ resolved_at: now, updated_at: now })
            .eq('conversation_id', convId)
            .is('resolved_at', null);
          if (!emCycleErr && orgId) {
            queryClient.invalidateQueries({ queryKey: ['crm-first-response-per-room', orgId] });
            queryClient.invalidateQueries({ queryKey: ['crm-sla-conversation', orgId] });
            queryClient.invalidateQueries({ queryKey: ['whatsapp-cycle-metrics', orgId] });
          }
        }
        if (newStatusName?.trim().toLowerCase() === 'converted' && orgId) {
          const { data: leadRow } = await supabase
            .from('leads')
            .select('id, client, services, category')
            .eq('organization_id', orgId)
            .eq('ticket_id', ticketId)
            .maybeSingle();
          if (!leadRow?.id) {
            console.error('Converted (email): lead not found for ticket_id=', ticketId, 'orgId=', orgId);
          } else {
            const { data: { user } } = await supabase.auth.getUser();
            const createdBy = user?.id ?? null;
            if (!createdBy) {
              console.error('Converted (email): no auth user for sales_activities insert (RLS requires created_by)');
            } else {
              try {
                const salesActivityId = await createConvertedSalesActivity(queryClient, {
                  orgId,
                  leadId: leadRow.id,
                  clientName: leadRow.client ?? 'Email lead',
                  createdBy,
                  services: (leadRow as { services?: string }).services,
                  category: (leadRow as { category?: string }).category,
                  description: lead.conversionDescription ?? null,
                  conversionItems: lead.conversionItems ?? null,
                  conversionPayment: (lead as { conversionPayment?: ConversionLeadPaymentPayload | null })
                    .conversionPayment ?? undefined,
                  omnichannelBankAccountId: (lead as { omnichannelBankAccountId?: string | null })
                    .omnichannelBankAccountId ?? undefined,
                  logLabel: 'Converted (email)',
                });
                return { ...lead, salesActivityId };
              } catch (err) {
                if (err instanceof Error && err.message === SALES_ACTIVITY_CONTACT_REQUIRED_CODE) {
                  console.error(
                    'Converted (email): missing lead_submissions contact for lead_id=',
                    leadRow.id,
                  );
                }
                throw err;
              }
            }
          }
        }
        if (clearEmailAssigneeOnResolve) {
          return { ...lead, assignee_id: null, assignee: '' };
        }
        return lead;
      }
      // WhatsApp / Instagram conversation virtual lead (id wa-{convId})
      if (lead?.id && String(lead.id).startsWith('wa-')) {
        const convId = String(lead.id).replace(/^wa-/, '');
        const onlyAssigneeUpdate = (lead as { _onlyAssigneeUpdate?: boolean })._onlyAssigneeUpdate === true;
        const isInstagramLead =
          String((lead as { channel?: string }).channel ?? '').toLowerCase() === 'instagram' ||
          String((lead as { source?: string }).source ?? '').toLowerCase() === 'instagram';

        if (isInstagramLead && onlyAssigneeUpdate) {
          const nowIso = new Date().toISOString();
          const igPatch: Record<string, unknown> = {
            assignee_id: lead.assignee_id ?? null,
            updated_at: nowIso,
          };
          const { data: auth } = await supabase.auth.getUser();
          const actorUserId = auth?.user?.id ?? null;
          if (actorUserId) {
            igPatch.last_assigned_by_user_id = actorUserId;
            igPatch.last_assigned_at = nowIso;
          }
          const { error: igUpdErr } = await supabase
            .from('instagram_conversations')
            .update(igPatch)
            .eq('id', convId);
          if (igUpdErr) {
            console.error('Error updating Instagram conversation assignee:', igUpdErr);
            throw igUpdErr;
          }
          const ticketId = (lead.ticket_id as string | undefined) ?? `IG-${convId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
          const orgId = lead.organization_id ?? organizationId;
          if (orgId && ticketId) {
            await supabase
              .from('leads')
              .update({
                assignee_id: lead.assignee_id ?? null,
                assignee: lead.assignee ?? '',
                updated_at: nowIso,
              })
              .eq('organization_id', orgId)
              .ilike('ticket_id', ticketId);
          }
          queryClient.invalidateQueries({ queryKey: ['instagram-conversation-status', convId] });
          queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
          return {
            ...lead,
            assignee_id: lead.assignee_id ?? null,
            assignee: lead.assignee ?? '',
          };
        }

        if (isInstagramLead) {
          const nowIso = new Date().toISOString();
          let safeStatusId: string | null = null;
          if (lead.status_id) {
            const { data: statusExists } = await supabase
              .from('lead_statuses')
              .select('id')
              .eq('id', lead.status_id)
              .maybeSingle();
            if (statusExists?.id) safeStatusId = lead.status_id;
          }
          const igPatch: Record<string, unknown> = { updated_at: nowIso };
          if (safeStatusId) igPatch.lead_status_id = safeStatusId;
          if (lead.assignee_id !== undefined) igPatch.assignee_id = lead.assignee_id ?? null;
          const { error: igUpdErr } = await supabase
            .from('instagram_conversations')
            .update(igPatch)
            .eq('id', convId);
          if (igUpdErr) {
            console.error('Error updating Instagram conversation:', igUpdErr);
            throw igUpdErr;
          }
          queryClient.invalidateQueries({ queryKey: ['instagram-conversation-status', convId] });
          queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
          return lead;
        }

        const statusIdNorm = (id: string | null | undefined) =>
          id == null || String(id).trim() === '' ? '' : String(id).trim().toLowerCase();

        const { data: convBefore } = await supabase
          .from('whatsapp_conversations')
          .select('lead_status_id, assignee_id, ticket_id, organization_id')
          .eq('id', convId)
          .maybeSingle();

        const priorStatusId = (convBefore?.lead_status_id as string | null | undefined) ?? null;

        // FK: only set lead_status_id if it exists in lead_statuses (avoids 23503 when id is stale/deleted).
        // Uses same client/RLS as dropdown; ensure lead_statuses RLS allows global (organization_id IS NULL) statuses.
        let safeStatusId: string | null = null;
        if (!onlyAssigneeUpdate && lead.status_id) {
          const { data: statusExists } = await supabase
            .from('lead_statuses')
            .select('id')
            .eq('id', lead.status_id)
            .maybeSingle();
          if (statusExists?.id) safeStatusId = lead.status_id;
        }

        const effectiveStatusId = onlyAssigneeUpdate ? priorStatusId : (safeStatusId ?? priorStatusId);
        const statusChanged =
          !onlyAssigneeUpdate &&
          effectiveStatusId != null &&
          statusIdNorm(effectiveStatusId) !== statusIdNorm(priorStatusId);

        let oldStatusNameFromDb = '';
        if (priorStatusId) {
          const { data: oldStatusRow } = await supabase
            .from('lead_statuses')
            .select('name')
            .eq('id', priorStatusId)
            .maybeSingle();
          oldStatusNameFromDb = (oldStatusRow?.name as string) ?? '';
        }

        let newStatusName = '';
        if (effectiveStatusId) {
          const { data: statusRow } = await supabase
            .from('lead_statuses')
            .select('name')
            .eq('id', effectiveStatusId)
            .maybeSingle();
          newStatusName = (statusRow?.name as string) ?? '';
        }

        const orgIdForResolveCheck = lead.organization_id ?? organizationId;
        const transitioningToResolve =
          statusChanged &&
          isResolvedStatus(newStatusName) &&
          !isResolvedStatus(oldStatusNameFromDb);
        if (transitioningToResolve && orgIdForResolveCheck) {
          const { data: convRowEarly } = await supabase
            .from('whatsapp_conversations')
            .select('ticket_id')
            .eq('id', convId)
            .maybeSingle();
          const ticketIdEarly =
            (convRowEarly?.ticket_id as string) ??
            `WA-${convId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
          const fallbackTicketIdEarly = `WA-${convId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
          let { data: leadForEmail } = await supabase
            .from('leads')
            .select('id')
            .eq('organization_id', orgIdForResolveCheck)
            .ilike('ticket_id', ticketIdEarly)
            .maybeSingle();
          if (!leadForEmail?.id && fallbackTicketIdEarly !== ticketIdEarly) {
            const res = await supabase
              .from('leads')
              .select('id')
              .eq('organization_id', orgIdForResolveCheck)
              .ilike('ticket_id', fallbackTicketIdEarly)
              .maybeSingle();
            leadForEmail = res.data;
          }
          await assertWaLeadSubmissionEmailBeforeResolve(orgIdForResolveCheck, leadForEmail?.id);
        }

        // Option A: clear live assignee only when status newly becomes Resolve/Closed (not on assignee-only edits while already resolved).
        const clearAssigneeOnResolve = transitioningToResolve;
        const priorWaAssigneeId =
          (convBefore?.assignee_id as string | null | undefined) ??
          (lead.assignee_id as string | null | undefined) ??
          null;

        const convUpdatePayload: Record<string, unknown> = {
          assignee_id: clearAssigneeOnResolve ? null : (lead.assignee_id ?? null),
          updated_at: new Date().toISOString(),
        };
        if (clearAssigneeOnResolve && priorWaAssigneeId) {
          convUpdatePayload.last_handling_assignee_id = priorWaAssigneeId;
        }
        if (statusChanged && effectiveStatusId) {
          convUpdatePayload.lead_status_id = effectiveStatusId;
        }

        const { error: updateError } = await supabase
          .from('whatsapp_conversations')
          .update(convUpdatePayload)
          .eq('id', convId);
        if (updateError) {
          console.error('Error updating WhatsApp conversation status:', updateError);
          throw updateError;
        }
        if (statusChanged && (oldStatusNameFromDb || newStatusName)) {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id ?? null;
          const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || null;
          await supabase.from('whatsapp_conversation_status_history').insert({
            conversation_id: convId,
            old_status: oldStatusNameFromDb,
            new_status: newStatusName || 'Open',
            changed_at: new Date().toISOString(),
            changed_by: userId,
            changed_by_name: userName,
            organization_id: lead.organization_id,
          });
        }
        if (isResolvedStatus(newStatusName)) {
          const now = new Date().toISOString();
          const { error: cycleUpdErr } = await supabase
            .from('whatsapp_conversation_cycles')
            .update({ resolved_at: now, updated_at: now })
            .eq('conversation_id', convId)
            .is('resolved_at', null);
          const orgForKeys = lead.organization_id ?? organizationId;
          if (!cycleUpdErr && orgForKeys) {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-cycle-metrics', orgForKeys] });
            queryClient.invalidateQueries({ queryKey: ['crm-first-response-per-room', orgForKeys] });
            queryClient.invalidateQueries({ queryKey: ['crm-sla-conversation', orgForKeys] });
          }
        }
        const orgId = lead.organization_id ?? organizationId;
        const { data: convRow } = await supabase
          .from('whatsapp_conversations')
          .select('ticket_id')
          .eq('id', convId)
          .maybeSingle();
        const ticketId = (convRow?.ticket_id as string) ?? `WA-${convId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
        const fallbackTicketId = `WA-${convId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
        if (orgId) {
          const leadUpdatePayload: {
            status_id?: string;
            assignee_id: string | null;
            assignee?: string;
            updated_at: string;
          } = {
            assignee_id: clearAssigneeOnResolve ? null : (lead.assignee_id ?? null),
            updated_at: new Date().toISOString(),
          };
          if (clearAssigneeOnResolve) leadUpdatePayload.assignee = '';
          if (statusChanged && effectiveStatusId != null) leadUpdatePayload.status_id = effectiveStatusId;
          // Find lead row by ticket_id (case-insensitive); try conversation ticket_id then fallback WA-{convId} so /leads-management stays in sync
          let { data: leadRowByTicket } = await supabase
            .from('leads')
            .select('id')
            .eq('organization_id', orgId)
            .ilike('ticket_id', ticketId)
            .maybeSingle();
          if (!leadRowByTicket?.id && fallbackTicketId !== ticketId) {
            const res = await supabase
              .from('leads')
              .select('id')
              .eq('organization_id', orgId)
              .ilike('ticket_id', fallbackTicketId)
              .maybeSingle();
            leadRowByTicket = res.data;
          }
          if (leadRowByTicket?.id) {
            const { error: updErr } = await supabase
              .from('leads')
              .update(leadUpdatePayload)
              .eq('id', leadRowByTicket.id);
            if (updErr) console.error('Error updating lead by id (wa sync):', updErr);
          } else {
            const { error: updErr } = await supabase
              .from('leads')
              .update(leadUpdatePayload)
              .eq('organization_id', orgId)
              .ilike('ticket_id', ticketId);
            if (updErr) console.error('Error updating lead by ticket_id (wa sync):', updErr);
          }
        }
        if (newStatusName?.trim().toLowerCase() === 'converted' && orgId) {
          const { data: leadRow } = await supabase
            .from('leads')
            .select('id, client, services, category')
            .eq('organization_id', orgId)
            .eq('ticket_id', ticketId)
            .maybeSingle();
          if (!leadRow?.id) {
            console.error('Converted (wa): lead not found for ticket_id=', ticketId, 'orgId=', orgId);
          } else {
            const { data: { user } } = await supabase.auth.getUser();
            const createdBy = user?.id ?? null;
            if (!createdBy) {
              console.error('Converted (wa): no auth user for sales_activities insert (RLS requires created_by)');
            } else {
              try {
                const salesActivityId = await createConvertedSalesActivity(queryClient, {
                  orgId,
                  leadId: leadRow.id,
                  clientName: leadRow.client ?? 'WhatsApp lead',
                  createdBy,
                  services: (leadRow as { services?: string }).services,
                  category: (leadRow as { category?: string }).category,
                  description: lead.conversionDescription ?? null,
                  conversionItems: lead.conversionItems ?? null,
                  conversionPayment: (lead as { conversionPayment?: ConversionLeadPaymentPayload | null })
                    .conversionPayment ?? undefined,
                  omnichannelBankAccountId: (lead as { omnichannelBankAccountId?: string | null })
                    .omnichannelBankAccountId ?? undefined,
                  logLabel: 'Converted (wa)',
                });
                queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
                queryClient.invalidateQueries({ queryKey: ['lead-by-ticket'] });
                return { ...lead, salesActivityId };
              } catch (err) {
                if (err instanceof Error && err.message === SALES_ACTIVITY_CONTACT_REQUIRED_CODE) {
                  console.error(
                    'Converted (wa): missing lead_submissions contact for lead_id=',
                    leadRow.id,
                  );
                }
                throw err;
              }
            }
          }
        }
        // Sync UI: invalidate leads list and lead-by-ticket so Quick Action and /omnichannel/leads stay in sync
        queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['lead-by-ticket'] });
        queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation-status', convId] });
        if (clearAssigneeOnResolve) {
          return { ...lead, assignee_id: null, assignee: '' };
        }
        const empName =
          lead.assignee && String(lead.assignee).trim()
            ? String(lead.assignee).trim()
            : '';
        return {
          ...lead,
          assignee_id: lead.assignee_id ?? null,
          assignee: clearAssigneeOnResolve ? '' : empName,
        };
      }
      const { id, lead_status, organization_id: leadOrgId, whatsapp_conversation_id: whatsappConvId, ...updateData } = lead;
      const onlyAssigneeUpdateRegular = (lead as { _onlyAssigneeUpdate?: boolean })._onlyAssigneeUpdate === true;
      const organizationIdForHistory = leadOrgId ?? organizationId;
      const hadAssigneeUpdate = updateData.assignee_id !== undefined;
      const hadStatusUpdate = !onlyAssigneeUpdateRegular && updateData.status_id !== undefined;

      // Ambil status lama dari DB untuk catat ke lead_status_history
      let oldStatusId: string | null = null;
      let clearAssigneeOnResolve = false;
      if (updateData.status_id !== undefined) {
        const { data: currentLead } = await supabase
          .from('leads')
          .select('status_id, ticket_id')
          .eq('id', id)
          .maybeSingle();
        oldStatusId = currentLead?.status_id ?? null;

        const { data: newStatusRow } = await supabase
          .from('lead_statuses')
          .select('name')
          .eq('id', updateData.status_id)
          .maybeSingle();
        clearAssigneeOnResolve = isResolvedStatus(newStatusRow?.name ?? null);

        if (organizationIdForHistory && currentLead?.ticket_id) {
          const tid = String(currentLead.ticket_id).trim().toUpperCase();
          if (tid.startsWith('WA-')) {
            if (clearAssigneeOnResolve) {
              await assertWaLeadSubmissionEmailBeforeResolve(organizationIdForHistory, id);
            }
          }
        }
      }

      // Only update valid database columns (exclude joined/computed fields like lead_status)
      const validFields: Record<string, unknown> = {
        client: updateData.client,
        title: updateData.title,
        services: updateData.services,
        category: updateData.category,
        assignee: updateData.assignee,
        assignee_id: updateData.assignee_id ?? null,
        fu_priority: updateData.fu_priority,
        status_id: updateData.status_id,
        source: updateData.source,
        followup: updateData.followup,
        converted_at: updateData.converted_at,
        ticket_id: updateData.ticket_id,
        google_ads_account_id: updateData.google_ads_account_id,
        updated_at: new Date().toISOString(),
      };

      // Remove undefined/null fields to avoid overwriting with null
      Object.keys(validFields).forEach(key => {
        if (validFields[key as keyof typeof validFields] === undefined) {
          delete validFields[key as keyof typeof validFields];
        }
      });

      if (onlyAssigneeUpdateRegular) {
        delete validFields.status_id;
      }

      if (clearAssigneeOnResolve) {
        validFields.assignee_id = null;
        validFields.assignee = '';
      }

      const { data, error } = await supabase
        .from('leads')
        .update(validFields)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating lead:', error);
        throw error;
      }

      const updatedLead = data as { ticket_id?: string; assignee_id?: string | null; organization_id?: string };
      const newStatusIdForConv = validFields.status_id as string | undefined;

      // Keep livechat / room assignee & status in sync with `leads` (Quick Action reads `whatsapp_conversations`).
      // Previously assignee-only updates skipped the `whatsappConvId && newStatusId` branch and used strict
      // `ticket_id` eq — case mismatch or missing `whatsappConvId` left the room on "Belum ditetapkan".
      if (
        organizationIdForHistory &&
        (hadAssigneeUpdate || (hadStatusUpdate && newStatusIdForConv != null))
      ) {
        let targetConvId: string | null =
          typeof whatsappConvId === 'string' && whatsappConvId.trim() !== '' ? whatsappConvId.trim() : null;
        const rawTid = updatedLead?.ticket_id;
        const tid = rawTid == null ? '' : String(rawTid).trim();
        const tidUpper = tid.toUpperCase();

        if (!targetConvId && tid && (tidUpper.startsWith('WA-') || tidUpper.startsWith('IG-'))) {
          const { data: convByIlike } = await supabase
            .from('whatsapp_conversations')
            .select('id')
            .eq('organization_id', organizationIdForHistory)
            .ilike('ticket_id', tid)
            .maybeSingle();
          targetConvId = (convByIlike?.id as string | undefined) ?? null;
          if (!targetConvId) {
            const { data: convByEq } = await supabase
              .from('whatsapp_conversations')
              .select('id')
              .eq('organization_id', organizationIdForHistory)
              .eq('ticket_id', tid)
              .maybeSingle();
            targetConvId = (convByEq?.id as string | undefined) ?? null;
          }
        }

        let igSyncId: string | null =
          tidUpper.startsWith('IG-') && typeof whatsappConvId === 'string' && whatsappConvId.trim() !== ''
            ? whatsappConvId.trim()
            : null;
        if (!igSyncId && tid && tidUpper.startsWith('IG-') && organizationIdForHistory) {
          igSyncId = await resolveInstagramConversationIdByTicket(organizationIdForHistory, tid);
        }

        let emailSyncId: string | null =
          tidUpper.startsWith('EMAIL-') && typeof whatsappConvId === 'string' && whatsappConvId.trim() !== ''
            ? whatsappConvId.trim()
            : null;

        const nowIsoForConv = new Date().toISOString();
        const convPatch: Record<string, unknown> = { updated_at: nowIsoForConv };
        let clearConvAssigneeOnResolve = false;
        if (hadStatusUpdate && newStatusIdForConv != null) {
          convPatch.lead_status_id = newStatusIdForConv;
          const { data: convStatusRowForPatch } = await supabase
            .from('lead_statuses')
            .select('name')
            .eq('id', newStatusIdForConv)
            .maybeSingle();
          if (isResolvedStatus((convStatusRowForPatch?.name as string) ?? null)) {
            clearConvAssigneeOnResolve = true;
            convPatch.assignee_id = null;
          }
        } else if (hadAssigneeUpdate) {
          convPatch.assignee_id = updatedLead.assignee_id ?? null;
          const { data: auth } = await supabase.auth.getUser();
          const actorUserId = auth?.user?.id ?? null;
          if (actorUserId) {
            convPatch.last_assigned_by_user_id = actorUserId;
            convPatch.last_assigned_at = nowIsoForConv;
          }
        }

        if (clearConvAssigneeOnResolve) {
          const priorFromLead = updatedLead.assignee_id ?? null;
          if (igSyncId) {
            const { data: igBefore } = await supabase
              .from('instagram_conversations')
              .select('assignee_id')
              .eq('id', igSyncId)
              .maybeSingle();
            const handlerId = (igBefore?.assignee_id as string | null) ?? priorFromLead;
            if (handlerId) convPatch.last_handling_assignee_id = handlerId;
          } else if (emailSyncId) {
            const { data: emBefore } = await supabase
              .from('email_conversations')
              .select('assignee_id')
              .eq('id', emailSyncId)
              .maybeSingle();
            const handlerId = (emBefore?.assignee_id as string | null) ?? priorFromLead;
            if (handlerId) convPatch.last_handling_assignee_id = handlerId;
          } else if (targetConvId) {
            const { data: waBefore } = await supabase
              .from('whatsapp_conversations')
              .select('assignee_id')
              .eq('id', targetConvId)
              .maybeSingle();
            const handlerId = (waBefore?.assignee_id as string | null) ?? priorFromLead;
            if (handlerId) convPatch.last_handling_assignee_id = handlerId;
          }
        }

        if (igSyncId) {
          const { error: igConvSyncErr } = await supabase
            .from('instagram_conversations')
            .update(convPatch)
            .eq('id', igSyncId);
          if (igConvSyncErr) console.error('Sync lead → instagram_conversations failed:', igConvSyncErr);
          else {
            queryClient.invalidateQueries({ queryKey: ['instagram-conversation-status', igSyncId] });
          }
        } else if (emailSyncId) {
          const { error: emConvSyncErr } = await supabase
            .from('email_conversations')
            .update(convPatch)
            .eq('id', emailSyncId);
          if (emConvSyncErr) console.error('Sync lead → email_conversations failed:', emConvSyncErr);
          else {
            queryClient.invalidateQueries({ queryKey: ['email-conversation-status', emailSyncId] });
          }
        } else if (targetConvId) {
          const { error: waConvSyncErr } = await supabase
            .from('whatsapp_conversations')
            .update(convPatch)
            .eq('id', targetConvId);
          if (waConvSyncErr) console.error('Sync lead → whatsapp_conversations failed:', waConvSyncErr);
          else {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation-status', targetConvId] });
          }
        }
      }
      // Close omnichannel conversation cycles when status → Resolve/Closed from leads row path.
      if (newStatusIdForConv && organizationIdForHistory) {
        const tidRaw = updatedLead?.ticket_id;
        const tidStr = tidRaw == null ? '' : String(tidRaw).trim();
        const tidUpperCycle = tidStr.toUpperCase();

        const { data: convStatusRow } = await supabase
          .from('lead_statuses')
          .select('name')
          .eq('id', newStatusIdForConv)
          .maybeSingle();
        const convStatusName = (convStatusRow?.name as string) ?? '';
        if (isResolvedStatus(convStatusName)) {
          const nowIso = new Date().toISOString();
          const orgForKeys = organizationIdForHistory ?? organizationId;

          const bumpCrm = async () => {
            if (!orgForKeys) return;
            queryClient.invalidateQueries({ queryKey: ['whatsapp-cycle-metrics', orgForKeys] });
            queryClient.invalidateQueries({ queryKey: ['crm-first-response-per-room', orgForKeys] });
            queryClient.invalidateQueries({ queryKey: ['crm-sla-conversation', orgForKeys] });
          };

          let waConvId: string | null =
            typeof whatsappConvId === 'string' && whatsappConvId.trim() !== '' ? whatsappConvId.trim() : null;
          if (!waConvId && tidStr && (tidUpperCycle.startsWith('WA-') || tidUpperCycle.startsWith('IG-'))) {
            const { data: convLookup } = await supabase
              .from('whatsapp_conversations')
              .select('id')
              .eq('organization_id', organizationIdForHistory)
              .ilike('ticket_id', tidStr)
              .maybeSingle();
            waConvId = (convLookup?.id as string | undefined) ?? null;
            if (!waConvId) {
              const { data: convLookupEq } = await supabase
                .from('whatsapp_conversations')
                .select('id')
                .eq('organization_id', organizationIdForHistory)
                .eq('ticket_id', tidStr)
                .maybeSingle();
              waConvId = (convLookupEq?.id as string | undefined) ?? null;
            }
          }

          if (waConvId && !tidUpperCycle.startsWith('IG-') && !tidUpperCycle.startsWith('EMAIL-')) {
            const { error: cycleUpdErr } = await supabase
              .from('whatsapp_conversation_cycles')
              .update({ resolved_at: nowIso, updated_at: nowIso })
              .eq('conversation_id', waConvId)
              .is('resolved_at', null);
            if (!cycleUpdErr) await bumpCrm();
          }

          if (tidUpperCycle.startsWith('IG-')) {
            let igConvId: string | null =
              typeof whatsappConvId === 'string' && whatsappConvId.trim() !== '' ? whatsappConvId.trim() : null;
            if (!igConvId && tidStr) {
              const { data: igLookup } = await supabase
                .from('instagram_conversations')
                .select('id')
                .eq('organization_id', organizationIdForHistory)
                .ilike('ticket_id', tidStr)
                .maybeSingle();
              igConvId = (igLookup?.id as string | undefined) ?? null;
              if (!igConvId) {
                const { data: igEq } = await supabase
                  .from('instagram_conversations')
                  .select('id')
                  .eq('organization_id', organizationIdForHistory)
                  .eq('ticket_id', tidStr)
                  .maybeSingle();
                igConvId = (igEq?.id as string | undefined) ?? null;
              }
            }
            if (igConvId) {
              const { error: igCycleErr } = await supabase
                .from('instagram_conversation_cycles')
                .update({ resolved_at: nowIso, updated_at: nowIso })
                .eq('conversation_id', igConvId)
                .is('resolved_at', null);
              if (!igCycleErr) await bumpCrm();
            }
          }

          if (tidUpperCycle.startsWith('EMAIL-')) {
            const emailConvId =
              typeof whatsappConvId === 'string' && whatsappConvId.trim() !== '' ? whatsappConvId.trim() : null;
            if (emailConvId) {
              const { error: emCycleErr } = await supabase
                .from('email_conversation_cycles')
                .update({ resolved_at: nowIso, updated_at: nowIso })
                .eq('conversation_id', emailConvId)
                .is('resolved_at', null);
              if (!emCycleErr) await bumpCrm();
            }
          }
        }
      }
      if (whatsappConvId) {
        queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['lead-by-ticket'] });
      }

      // Catat perubahan status ke lead_status_history (agar Status History modal berisi data)
      const newStatusId = validFields.status_id as string | undefined;
      let newStatusName = '';
      if (newStatusId !== undefined && String(newStatusId) !== String(oldStatusId)) {
        let oldStatusName: string | null = null;
        if (oldStatusId) {
          const { data: oldRow } = await supabase
            .from('lead_statuses')
            .select('name')
            .eq('id', oldStatusId)
            .maybeSingle();
          oldStatusName = (oldRow?.name as string) ?? null;
        }
        const { data: newRow } = await supabase
          .from('lead_statuses')
          .select('name')
          .eq('id', newStatusId)
          .maybeSingle();
        newStatusName = (newRow?.name as string) ?? '';

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id ?? null;
        const userName = (userData?.user?.user_metadata?.full_name as string) || (userData?.user?.email as string) || null;
        const orgId = organizationIdForHistory ?? organizationId;
        if (orgId) {
          await supabase.from('lead_status_history').insert({
            lead_id: id,
            old_status: oldStatusName,
            new_status: newStatusName || 'Open',
            changed_at: new Date().toISOString(),
            changed_by: userId,
            changed_by_name: userName,
            organization_id: orgId,
          });
        }
        // Create sales_activities entry when status changes to Converted (from leads-management page)
        let salesActivityId: string | undefined;
        if (newStatusName?.trim().toLowerCase() === 'converted' && orgId && userId) {
          const leadData = data as { client?: string; services?: string; category?: string };
          const clientName = leadData?.client ?? 'Lead';
          try {
            salesActivityId = await createConvertedSalesActivity(queryClient, {
              orgId,
              leadId: id,
              clientName,
              createdBy: userId,
              services: leadData?.services,
              category: leadData?.category,
              description: (lead as { conversionDescription?: string | null }).conversionDescription ?? null,
              conversionItems: (lead as { conversionItems?: ConvertedSalesActivityItemInput[] | null })
                .conversionItems ?? null,
              conversionPayment: (lead as { conversionPayment?: ConversionLeadPaymentPayload | null })
                .conversionPayment ?? undefined,
              omnichannelBankAccountId: (lead as { omnichannelBankAccountId?: string | null })
                .omnichannelBankAccountId ?? undefined,
              logLabel: 'Converted (leads)',
            });
          } catch (err) {
            if (err instanceof Error && err.message === SALES_ACTIVITY_CONTACT_REQUIRED_CODE) {
              console.error('Converted (leads): missing lead_submissions contact for lead_id=', id);
            }
            throw err;
          }
        }
        return salesActivityId ? { ...data, salesActivityId } : data;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
      if (organizationId) {
        invalidateGoogleAdsConversionUploads(organizationId);
      }
    },
  });

  // Delete lead mutation - includes deleting related data (Client Profile, Follow Up Updates, Status History)
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      if (leadId.startsWith('wa-')) return;
      console.log('🗑️ Starting deletion process for lead:', leadId);

      // Step 1: Delete Follow Up Updates (lead_follow_up_updates)
      const { error: followUpError } = await supabase
        .from('lead_follow_up_updates')
        .delete()
        .eq('lead_id', leadId);

      if (followUpError) {
        console.error('⚠️ Error deleting follow up updates:', followUpError);
        // Continue deletion even if follow up updates delete fails
      } else {
        console.log('✅ Follow up updates deleted');
      }

      // Step 3: Delete Status History (lead_status_history)
      const { error: statusHistoryError } = await supabase
        .from('lead_status_history')
        .delete()
        .eq('lead_id', leadId);

      if (statusHistoryError) {
        console.error('⚠️ Error deleting status history:', statusHistoryError);
        // Continue deletion even if status history delete fails
      } else {
        console.log('✅ Status history deleted');
      }

      // Step 4: Delete the lead itself
      const { error: leadError } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (leadError) {
        console.error('❌ Error deleting lead:', leadError);
        throw leadError;
      }

      console.log('✅ Lead and all related data deleted successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
    },
  });

  /** First successful response sets `dataUpdatedAt`; refetch/interval keeps it >0 so UI does not flash skeleton on background refresh. */
  const initialLoadPending =
    employeeWait ||
    (!!organizationId &&
      queryEnabled &&
      (loading || (isFetching && dataUpdatedAt === 0)));

  return {
    leads: leads as any[],
    loading,
    initialLoadPending,
    refetch,
    createLead: createLeadMutation.mutateAsync,
    updateLead: updateLeadMutation.mutateAsync,
    deleteLead: deleteLeadMutation.mutateAsync,
  };
};

/** Latest Lead Conversion `sales_activities` row for omnichannel livechat payment modal. */
export function useLeadConversionSalesActivity(
  leadId: string | null | undefined,
  enabled: boolean,
) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['lead-conversion-sales-activity', organizationId, leadId],
    queryFn: async () => {
      if (!organizationId || !leadId) return null;
      return resolveLeadConversionSalesActivity(organizationId, leadId);
    },
    enabled: Boolean(enabled && organizationId && leadId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function getSalesActivityIdFromUpdateLeadResult(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const id = (result as { salesActivityId?: unknown }).salesActivityId;
  return typeof id === 'string' && id.trim() !== '' ? id : undefined;
}

