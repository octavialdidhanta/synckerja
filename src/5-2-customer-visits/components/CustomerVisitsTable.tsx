import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getLocalDateYmd } from '@/shared/lib/date/getLocalDateYmd';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { customerVisitLead, type CustomerVisitRow } from '../lib/customerVisit.types';
import { customerVisitLeadContent } from '../lib/customerVisitLeadContent';
import {
  canStartStoreCheckout,
  canViewVisitReceipt,
  customerVisitSale,
  isVisitPaid,
  visitSaleAmount,
} from '../lib/customerVisitSale';
import { CustomerVisitsTableFooter } from './CustomerVisitsTableFooter';

type Props = {
  visits: CustomerVisitRow[];
  totalVisits: number;
  onCheckout?: (visit: CustomerVisitRow) => void;
  onViewReceipt?: (visit: CustomerVisitRow) => void;
};

function formatDate(dateString: string | null) {
  if (!dateString) return '—';
  try {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatTime(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

const COL = {
  date: 'min-w-[132px] whitespace-nowrap',
  table: 'min-w-[88px] whitespace-nowrap',
  lookup: 'min-w-[168px]',
  lead: 'min-w-[176px]',
  source: 'min-w-[160px]',
  content: 'min-w-[320px]',
  match: 'min-w-[112px] whitespace-nowrap',
  status: 'min-w-[120px] whitespace-nowrap',
  sale: 'min-w-[104px] whitespace-nowrap',
  amount: 'min-w-[128px] whitespace-nowrap',
  pay: 'min-w-[140px] whitespace-nowrap',
  actions: 'min-w-[176px] whitespace-nowrap text-right',
} as const;

export function CustomerVisitsTable({ visits, totalVisits, onCheckout, onViewReceipt }: Props) {
  const { t } = useAppTranslation();
  const todayYmd = getLocalDateYmd();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-max min-w-[1880px] caption-bottom text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.date}`}>
                {t('customerVisits.table.date', 'Date')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.table}`}>
                {t('customerVisits.table.table', 'Table')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.lookup}`}>
                {t('customerVisits.table.lookup', 'Lookup')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.lead}`}>
                {t('customerVisits.table.lead', 'Lead')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.source}`}>
                {t('customerVisits.table.source', 'Source')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.content}`}>
                {t('customerVisits.table.content', 'Content')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.match}`}>
                {t('customerVisits.table.match', 'Match')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.status}`}>
                {t('customerVisits.table.status', 'Status')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.sale}`}>
                {t('customerVisits.table.sale', 'Sale')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.amount}`}>
                {t('customerVisits.table.amount', 'Amount')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.pay}`}>
                {t('customerVisits.table.pay', 'Pay')}
              </TableHead>
              <TableHead className={`sticky top-0 z-20 bg-gray-50 px-3 py-2.5 ${COL.actions}`}>
                {t('customerVisits.table.actions', 'Actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="px-3 py-8 text-center text-sm text-gray-500">
                  {t('customerVisits.empty.title', 'No customer visits yet')}
                </TableCell>
              </TableRow>
            ) : (
              visits.map((visit) => {
                const lead = customerVisitLead(visit);
                const sale = customerVisitSale(visit);
                const paid = isVisitPaid(visit);
                const amount = visitSaleAmount(visit);
                const showCheckout = canStartStoreCheckout(visit, todayYmd);
                const showView = canViewVisitReceipt(visit);
                const time = formatTime(visit.created_at);
                const payMethod = sale?.payment_method
                  ? t(`customerVisits.checkout.method.${sale.payment_method}`, sale.payment_method)
                  : null;
                const content = customerVisitLeadContent(lead);
                return (
                  <TableRow key={visit.id} className="h-12 border-b border-gray-100">
                    <TableCell className={`px-3 py-2 ${COL.date}`}>
                      <p>{formatDate(visit.visit_date)}</p>
                      {time ? <p className="text-xs text-gray-500">{time}</p> : null}
                    </TableCell>
                    <TableCell className={`px-3 py-2 ${COL.table}`}>
                      {visit.table_number?.trim() ? (
                        <span className="font-semibold">{visit.table_number.trim()}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className={`px-3 py-2 ${COL.lookup}`}>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {visit.lookup_kind === 'instagram' ? `@${visit.lookup_normalized}` : visit.lookup_raw}
                        </p>
                        <p className="text-xs text-gray-500">
                          {visit.lookup_kind === 'phone'
                            ? t('customerVisits.checkIn.kindPhone', 'Phone')
                            : t('customerVisits.checkIn.kindInstagram', 'Instagram')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={`px-3 py-2 ${COL.lead}`}>
                      {lead ? (
                        <div className="min-w-0">
                          <p className="truncate font-medium">{lead.client}</p>
                          <p className="text-xs text-gray-500">{lead.ticket_id}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className={`px-3 py-2 ${COL.source}`}>
                      {lead?.source?.trim() ? (
                        <span className="truncate">{lead.source.trim()}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className={`px-3 py-2 ${COL.content}`}>
                      {content ? (
                        content.href ? (
                          <a
                            href={content.href}
                            target="_blank"
                            rel="noreferrer"
                            className="block min-w-0 text-gray-900 hover:underline"
                          >
                            <p className="truncate font-medium" title={content.title}>
                              {content.title}
                            </p>
                            {content.subtitle ? (
                              <p className="truncate text-xs text-gray-500" title={content.subtitle}>
                                {content.subtitle}
                              </p>
                            ) : null}
                          </a>
                        ) : (
                          <div className="min-w-0">
                            <p className="truncate font-medium" title={content.title}>
                              {content.title}
                            </p>
                            {content.subtitle ? (
                              <p className="truncate text-xs text-gray-500" title={content.subtitle}>
                                {content.subtitle}
                              </p>
                            ) : null}
                          </div>
                        )
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className={`px-3 py-2 ${COL.match}`}>
                      <Badge
                        variant="outline"
                        className={
                          visit.match_status === 'matched'
                            ? 'border-green-200 bg-green-100 text-green-800'
                            : 'border-gray-200 bg-gray-100 text-gray-700'
                        }
                      >
                        {visit.match_status === 'matched'
                          ? t('customerVisits.matchStatus.matched', 'Matched')
                          : t('customerVisits.matchStatus.unmatched', 'Unmatched')}
                      </Badge>
                    </TableCell>
                    <TableCell className={`px-3 py-2 ${COL.status}`}>
                      <Badge
                        variant="outline"
                        className={
                          visit.status === 'completed'
                            ? 'border-green-200 bg-green-100 text-green-800'
                            : 'border-red-200 bg-red-100 text-red-800'
                        }
                      >
                        {visit.status}
                      </Badge>
                    </TableCell>
                    <TableCell className={`px-3 py-2 ${COL.sale}`}>
                      <Badge
                        variant="outline"
                        className={
                          paid
                            ? 'border-teal-200 bg-teal-100 text-teal-800'
                            : 'border-amber-200 bg-amber-100 text-amber-800'
                        }
                      >
                        {paid
                          ? t('customerVisits.sale.paid', 'Paid')
                          : t('customerVisits.sale.unpaid', 'Unpaid')}
                      </Badge>
                    </TableCell>
                    <TableCell className={`px-3 py-2 tabular-nums ${COL.amount}`}>
                      {amount != null ? formatToRupiah(amount) : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className={`px-3 py-2 ${COL.pay}`}>
                      {payMethod ? payMethod : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className={`px-3 py-2 ${COL.actions}`}>
                      <div className="flex justify-end gap-1.5">
                        {showCheckout && onCheckout ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => onCheckout(visit)}
                          >
                            {paid
                              ? t('customerVisits.table.orderAgain', 'Order again')
                              : t('customerVisits.table.checkout', 'Checkout')}
                          </Button>
                        ) : null}
                        {showView && onViewReceipt ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => onViewReceipt(visit)}
                          >
                            {t('customerVisits.table.view', 'View')}
                          </Button>
                        ) : null}
                        {!showCheckout && !showView ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </table>
      </div>
      <CustomerVisitsTableFooter totalVisits={totalVisits} filteredVisits={visits.length} />
    </div>
  );
}
