import { useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getLocalDateYmd } from '@/shared/lib/date/getLocalDateYmd';
import {
  SALES_OPS_CARD_FOOTER,
  SALES_OPS_MAIN_COLUMN,
  SALES_OPS_MAIN_GRID,
  SALES_OPS_SIDEBAR_COLUMN,
} from '@/5-2-activities/layout/salesOperationsLayout';
import { CustomerVisitCatalogPane } from '../checkout/components/CustomerVisitCatalogPane';
import { CustomerVisitCheckoutPanel } from '../checkout/components/CustomerVisitCheckoutPanel';
import { useCustomerVisitCart } from '../checkout/hooks/useCustomerVisitCart';
import { useSubmitCustomerVisitCheckout } from '../checkout/hooks/useSubmitCustomerVisitCheckout';
import type { CustomerVisitCartLine, CustomerVisitCheckoutPaymentMethod } from '../checkout/lib/customerVisitCheckout.types';
import { parseStoreCheckoutIncomeErrorCode } from '../checkout/lib/recordStoreCheckoutIncome';
import { CustomerVisitCheckInCard } from './CustomerVisitCheckInCard';
import { CustomerVisitMatchPanel } from './CustomerVisitMatchPanel';
import { CustomerVisitReceiptPanel } from './CustomerVisitReceiptPanel';
import { CustomerVisitsFilters, DEFAULT_CUSTOMER_VISITS_FILTERS, type CustomerVisitsFiltersState } from './CustomerVisitsFilters';
import { CustomerVisitsMetricsCards } from './CustomerVisitsMetricsCards';
import { CustomerVisitsTable } from './CustomerVisitsTable';
import { useCustomerVisitLookup } from '../hooks/useCustomerVisitLookup';
import { useCustomerVisits } from '../hooks/useCustomerVisits';
import { useRecordCustomerVisit } from '../hooks/useRecordCustomerVisit';
import { customerVisitLead, type CustomerVisitLookupKind, type CustomerVisitRow } from '../lib/customerVisit.types';
import { findTodaysMatchedVisit } from '../lib/findTodaysMatchedVisit';
import { isVisitPaid, matchesVisitSaleFilter, canStartStoreCheckout, customerVisitSale } from '../lib/customerVisitSale';
import type { CustomerVisitLeadCandidate } from '../lib/matchCustomerVisitParty';

type CheckoutSession = {
  visitId: string;
  lead: CustomerVisitLeadCandidate;
  tableNumber?: string | null;
  alreadyPaid?: boolean;
};

export function CustomerVisitsPageContent() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { visits, isError, error, refetch } = useCustomerVisits();
  const recordVisit = useRecordCustomerVisit();
  const submitCheckout = useSubmitCustomerVisitCheckout();
  const cart = useCustomerVisitCart();

  const [kind, setKind] = useState<CustomerVisitLookupKind>('phone');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [submittedKind, setSubmittedKind] = useState<CustomerVisitLookupKind>('phone');
  const [searched, setSearched] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null);
  const [receiptVisit, setReceiptVisit] = useState<CustomerVisitRow | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<CustomerVisitCheckoutPaymentMethod>('cash');
  const [filters, setFilters] = useState<CustomerVisitsFiltersState>({
    ...DEFAULT_CUSTOMER_VISITS_FILTERS,
  });

  const lookup = useCustomerVisitLookup(submittedKind, submittedQuery, searched);
  const isCheckout = Boolean(checkoutSession);
  const liveReceiptVisit = receiptVisit
    ? (() => {
        const live = visits.find((visit) => visit.id === receiptVisit.id);
        const liveSale = customerVisitSale(live ?? receiptVisit);
        const localSale = customerVisitSale(receiptVisit);
        const shownSale = justPaid && localSale ? localSale : liveSale || localSale;
        return {
          ...(live ?? receiptVisit),
          sales_activity_id: justPaid
            ? receiptVisit.sales_activity_id
            : live?.sales_activity_id ?? receiptVisit.sales_activity_id,
          sales_activities: shownSale
            ? {
                id: shownSale.id,
                total_amount: shownSale.total_amount ?? null,
                payment_method: shownSale.payment_method ?? null,
                payment_reference: shownSale.payment_reference ?? null,
                cash_tendered: shownSale.cash_tendered ?? null,
                table_number: shownSale.table_number ?? null,
                date: shownSale.date ?? null,
                created_at: shownSale.created_at ?? null,
              }
            : receiptVisit.sales_activities,
          table_number:
            (justPaid ? receiptVisit.table_number : live?.table_number) ??
            receiptVisit.table_number ??
            shownSale?.table_number ??
            null,
          store_tickets:
            (receiptVisit.store_tickets?.length ?? 0) >= (live?.store_tickets?.length ?? 0)
              ? receiptVisit.store_tickets
              : live?.store_tickets ?? receiptVisit.store_tickets,
        };
      })()
    : null;

  const handleSearch = () => {
    if (checkoutSession) return;
    setSubmittedKind(kind);
    setSubmittedQuery(query);
    setSearched(true);
    setSelectedLeadId(null);
  };

  const resetLookup = () => {
    setQuery('');
    setSubmittedQuery('');
    setSearched(false);
    setSelectedLeadId(null);
    setCheckoutSession(null);
    setReceiptVisit(null);
    setJustPaid(false);
    setPaymentMethod('cash');
    cart.reset();
  };

  const todayYmd = getLocalDateYmd();
  const alreadyCheckedInLeadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const visit of visits) {
      if (
        visit.status === 'completed' &&
        visit.match_status === 'matched' &&
        visit.lead_id &&
        visit.visit_date === todayYmd
      ) {
        ids.add(visit.lead_id);
      }
    }
    return ids;
  }, [todayYmd, visits]);

  const openReceiptForVisit = (visit: CustomerVisitRow) => {
    setCheckoutSession(null);
    cart.reset();
    setJustPaid(false);
    setReceiptVisit(visit);
  };

  const startCheckoutForVisit = (visit: CustomerVisitRow, lead: CustomerVisitLeadCandidate) => {
    cart.reset();
    setPaymentMethod('cash');
    setJustPaid(false);
    setReceiptVisit(null);
    setCheckoutSession({
      visitId: visit.id,
      lead,
      tableNumber: visit.table_number ?? customerVisitSale(visit)?.table_number ?? null,
      alreadyPaid: isVisitPaid(visit),
    });
  };

  const openCheckoutForVisit = (visit: CustomerVisitRow) => {
    if (!canStartStoreCheckout(visit, todayYmd)) return;
    const lead = customerVisitLead(visit);
    if (!visit.lead_id || !lead) return;
    startCheckoutForVisit(visit, {
      id: lead.id,
      client: lead.client,
      phone_number: lead.phone_number,
      ticket_id: lead.ticket_id,
      source: lead.source,
    });
  };

  const openExistingTodayVisit = (visitId: string, lead: CustomerVisitLeadCandidate) => {
    const existing = visits.find((visit) => visit.id === visitId);
    if (existing && isVisitPaid(existing)) {
      toast({
        title: t('customerVisits.toast.reusedPaidTitle', 'Already checked in today'),
        description: t(
          'customerVisits.toast.reusedPaidDescription',
          'Opening today’s receipt. No extra check-in was added.',
        ),
      });
      openReceiptForVisit(existing);
      return;
    }
    toast({
      title: t('customerVisits.toast.reusedTitle', 'Already checked in today'),
      description: t(
        'customerVisits.toast.reusedDescription',
        'Opening checkout for today’s visit. No extra check-in was added.',
      ),
    });
    if (existing) {
      startCheckoutForVisit(existing, lead);
      return;
    }
    cart.reset();
    setPaymentMethod('cash');
    setReceiptVisit(null);
    setCheckoutSession({ visitId, lead, alreadyPaid: false });
  };

  const handleConfirmMatched = async (lead: CustomerVisitLeadCandidate, notes: string) => {
    if (!lookup.normalized) return;
    const existing = findTodaysMatchedVisit(visits, lead.id, todayYmd);
    if (existing) {
      openExistingTodayVisit(existing.id, lead);
      return;
    }
    try {
      const row = await recordVisit.mutateAsync({
        lookupKind: submittedKind,
        lookupRaw: submittedQuery,
        lookupNormalized: lookup.normalized,
        matchStatus: 'matched',
        leadId: lead.id,
        notes,
      });
      if (row.reused) {
        openExistingTodayVisit(row.id, lead);
        return;
      }
      toast({
        title: t('customerVisits.toast.matchedTitle', 'Visit saved'),
        description: t('customerVisits.toast.matchedDescription', 'Matched lead check-in recorded.'),
      });
      cart.reset();
      setPaymentMethod('cash');
      setReceiptVisit(null);
      setCheckoutSession({ visitId: row.id, lead });
    } catch (err) {
      toast({
        title: t('customerVisits.toast.errorTitle', 'Could not save visit'),
        description: err instanceof Error ? err.message : t('mobileHome.error', 'Error'),
        variant: 'destructive',
      });
    }
  };

  const handleSaveUnmatched = async (notes: string) => {
    if (!lookup.normalized) return;
    try {
      await recordVisit.mutateAsync({
        lookupKind: submittedKind,
        lookupRaw: submittedQuery,
        lookupNormalized: lookup.normalized,
        matchStatus: 'unmatched',
        leadId: null,
        notes,
      });
      toast({
        title: t('customerVisits.toast.unmatchedTitle', 'Visit saved without lead'),
        description: t(
          'customerVisits.toast.unmatchedDescription',
          'Logged for the store. This does not increase Lead Magnet offline visits.',
        ),
      });
      resetLookup();
    } catch (err) {
      toast({
        title: t('customerVisits.toast.errorTitle', 'Could not save visit'),
        description: err instanceof Error ? err.message : t('mobileHome.error', 'Error'),
        variant: 'destructive',
      });
    }
  };

  const filteredVisits = useMemo(() => {
    const today = getLocalDateYmd();
    return visits.filter((visit) => {
      if (filters.match !== 'all' && visit.match_status !== filters.match) return false;
      if (!matchesVisitSaleFilter(visit, filters.sale)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const lead = customerVisitLead(visit);
        const hay = `${visit.lookup_raw} ${visit.lookup_normalized} ${lead?.client ?? ''} ${lead?.ticket_id ?? ''} ${visit.table_number ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.date === 'today' && visit.visit_date !== today) return false;
      if (filters.date === 'this_week') {
        const visitDate = new Date(`${visit.visit_date}T00:00:00`);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - start.getDay());
        if (visitDate < start) return false;
      }
      if (filters.date === 'this_month') {
        const now = new Date();
        if (!visit.visit_date.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)) {
          return false;
        }
      }
      return true;
    });
  }, [filters, visits]);

  const handleSkipCheckout = () => {
    toast({
      title: t('customerVisits.toast.skipCheckoutTitle', 'Visit saved'),
      description: t(
        'customerVisits.toast.skipCheckoutDescription',
        'No purchase recorded. Offline visit still counts.',
      ),
    });
    resetLookup();
  };

  const handlePay = async (args: {
    paymentMethod: CustomerVisitCheckoutPaymentMethod;
    lines: CustomerVisitCartLine[];
    paymentReference?: string | null;
    cashTendered?: number | null;
    tableNumber?: string | null;
  }) => {
    if (!checkoutSession) return;
    try {
      const activityId = await submitCheckout.mutateAsync({
        visitId: checkoutSession.visitId,
        leadId: checkoutSession.lead.id,
        clientName: checkoutSession.lead.client,
        clientPhone: checkoutSession.lead.phone_number,
        paymentMethod: args.paymentMethod,
        paymentReference: args.paymentReference ?? null,
        cashTendered: args.cashTendered ?? null,
        tableNumber: args.tableNumber ?? null,
        lines: args.lines,
      });
      const paidAt = new Date().toISOString();
      const tableNumber = args.tableNumber?.trim() || null;
      const ticketTotal = args.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
      const paidVisit =
        visits.find((visit) => visit.id === checkoutSession.visitId) ??
        ({
          id: checkoutSession.visitId,
          organization_id: '',
          visit_date: getLocalDateYmd(),
          status: 'completed',
          lead_id: checkoutSession.lead.id,
          lookup_kind: submittedKind,
          lookup_raw: submittedQuery,
          lookup_normalized: '',
          match_status: 'matched',
          notes: null,
          table_number: tableNumber,
          sales_activity_id: activityId,
          created_at: paidAt,
          leads: checkoutSession.lead,
        } as CustomerVisitRow);
      const newTicket = {
        id: activityId,
        total_amount: ticketTotal,
        payment_method: args.paymentMethod,
        payment_reference: args.paymentReference ?? null,
        cash_tendered: args.paymentMethod === 'cash' ? args.cashTendered ?? null : null,
        table_number: tableNumber,
        date: getLocalDateYmd(),
        created_at: paidAt,
      };
      cart.reset();
      setPaymentMethod('cash');
      setCheckoutSession(null);
      setJustPaid(true);
      setReceiptVisit({
        ...paidVisit,
        table_number: tableNumber,
        sales_activity_id: activityId,
        sales_activities: newTicket,
        store_tickets: [...(paidVisit.store_tickets ?? []).filter((ticket) => ticket.id !== activityId), newTicket],
      });
    } catch (err) {
      const code = parseStoreCheckoutIncomeErrorCode(err instanceof Error ? err.message : null);
      const message = err instanceof Error ? err.message : '';
      toast({
        title:
          message === 'store_checkout_insufficient_stock'
            ? t('customerVisits.toast.insufficientStockTitle', 'Not enough stock')
            : message === 'store_checkout_already_paid'
              ? t('customerVisits.toast.alreadyPaidTitle', 'Already paid')
              : t('customerVisits.toast.checkoutErrorTitle', 'Could not record payment'),
        description:
          message === 'store_checkout_insufficient_stock'
            ? t('customerVisits.checkout.insufficientStock', '{{name}} only has {{qty}} left.', {
                name: t('customerVisits.checkout.products', 'Products'),
                qty: 0,
              })
            : message === 'store_checkout_already_paid'
              ? t(
                  'customerVisits.toast.alreadyPaidDescription',
                  'This visit already has a receipt. Checkout was not started again.',
                )
            : code === 'store_checkout_omnichannel_bank_missing'
              ? t(
                  'customerVisits.toast.checkoutBankMissing',
                  'Set an omnichannel income bank account before taking store payments.',
                )
              : t(
                  'customerVisits.toast.checkoutIncomeFailed',
                  'Payment was not saved. The receipt was rolled back.',
                ),
        variant: 'destructive',
      });
    }
  };

  const todayCount = alreadyCheckedInLeadIds.size;
  const qtyByCatalogId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of cart.lines) map[line.catalogId] = line.quantity;
    return map;
  }, [cart.lines]);

  return (
    <div className={`${SALES_OPS_MAIN_GRID} min-h-[calc(100vh-120px)] flex-1`}>
      <div className={`${SALES_OPS_MAIN_COLUMN} flex h-full min-h-0 flex-col gap-2`}>
        {isCheckout ? (
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <CustomerVisitCatalogPane
              submitting={submitCheckout.isPending}
              qtyByCatalogId={qtyByCatalogId}
              onAddItem={cart.addItem}
            />
          </div>
        ) : (
          <>
            <CustomerVisitCheckInCard
              kind={kind}
              query={query}
              onKindChange={(next) => {
                setKind(next);
                setSearched(false);
                setSelectedLeadId(null);
              }}
              onQueryChange={setQuery}
              onSearch={handleSearch}
              searching={lookup.isLoading}
            />
            <div className="rounded-md border bg-white p-2">
              <CustomerVisitsFilters filters={filters} onFiltersChange={setFilters} />
            </div>
            <CustomerVisitsMetricsCards visits={filteredVisits} cashVisits={visits} />
            {isError ? (
              <Alert variant="destructive">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>{error instanceof Error ? error.message : t('customerVisits.loadError', 'Failed to load visits.')}</span>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    {t('customerVisits.retry', 'Retry')}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <CustomerVisitsTable
                  visits={filteredVisits}
                  totalVisits={visits.length}
                  onCheckout={openCheckoutForVisit}
                  onViewReceipt={openReceiptForVisit}
                />
              </div>
            </div>
          </>
        )}
      </div>
      <div className={SALES_OPS_SIDEBAR_COLUMN}>
        <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {checkoutSession ? (
            <CustomerVisitCheckoutPanel
              key={`${checkoutSession.visitId}:${checkoutSession.alreadyPaid ? 'reorder' : 'first'}`}
              lead={checkoutSession.lead}
              lines={cart.lines}
              totals={cart.totals}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              onUpdateQty={cart.updateQty}
              onUpdatePrice={cart.updatePrice}
              submitting={submitCheckout.isPending}
              alreadyPaid={checkoutSession.alreadyPaid}
              initialTableNumber={checkoutSession.tableNumber}
              onSkip={handleSkipCheckout}
              onPay={handlePay}
            />
          ) : liveReceiptVisit ? (
            <CustomerVisitReceiptPanel
              visit={liveReceiptVisit}
              justPaid={justPaid}
              onClose={() => {
                setJustPaid(false);
                setReceiptVisit(null);
              }}
              onNextCheckIn={resetLookup}
              onOrderAgain={
                canStartStoreCheckout(liveReceiptVisit, todayYmd)
                  ? () => openCheckoutForVisit(liveReceiptVisit)
                  : undefined
              }
            />
          ) : (
            <CustomerVisitMatchPanel
              key={searched ? `${submittedKind}:${submittedQuery}` : 'idle'}
              searched={searched}
              invalidQuery={searched && !lookup.normalized && !lookup.isLoading}
              loading={lookup.isLoading}
              result={lookup.result}
              selectedLeadId={selectedLeadId}
              alreadyCheckedInLeadIds={alreadyCheckedInLeadIds}
              onSelectLead={setSelectedLeadId}
              onConfirmMatched={handleConfirmMatched}
              onSaveUnmatched={handleSaveUnmatched}
              recording={recordVisit.isPending}
            />
          )}
          {checkoutSession || liveReceiptVisit ? null : (
            <div className={SALES_OPS_CARD_FOOTER}>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{t('customerVisits.sidebar.today', 'Today')}</span>
                <span className="text-gray-400">
                  {t('customerVisits.sidebar.todayCount', '{{count}} check-ins', { count: todayCount })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
