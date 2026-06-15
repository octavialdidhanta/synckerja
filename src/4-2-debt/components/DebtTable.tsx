import { useState, useMemo } from 'react';
import { Debt } from '../types';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Eye, Edit, Trash2, CreditCard, Building, Calendar, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { debtDisplayBalance, resolveDebtDisplay } from '../utils/resolveDebtDisplay';
import {
  BrickLinkDropdownMenuItems,
  BrickLinkStatusBadge,
} from '@/shared/components/finance/BrickLinkTableCell';

interface DebtTableProps {
  debts: Debt[];
  isLoading?: boolean;
  onAdd?: () => void;
  /** Parent may ignore the debt argument (e.g. opens modal for user to pick). */
  onPayDebt?: (debt?: Debt) => void;
  onEdit?: (debt: Debt) => void;
  onDelete?: (debtId: string) => void;
  onViewDetails?: (debt: Debt) => void;
  onPaidClick?: (debt: Debt) => void;
  onLinkBrick?: (debt: Debt) => void;
  onUnlinkBrick?: (debt: Debt) => void;
  onSyncBrick?: (debt: Debt) => void;
  brickBusyId?: string | null;
}

export const DebtTable = ({ 
  debts, 
  isLoading = false,
  onAdd,
  onPayDebt,
  onEdit,
  onDelete,
  onViewDetails,
  onPaidClick,
  onLinkBrick,
  onUnlinkBrick,
  onSyncBrick,
  brickBusyId,
}: DebtTableProps) => {
  const { t } = useAppTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredDebts = useMemo(() => {
    return debts.filter(debt => {
      const matchesSearch = 
        debt.debt_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        debt.bank_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        debt.debt_type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = filterType === 'all' || debt.debt_type === filterType;
      const matchesStatus = filterStatus === 'all' || debt.status === filterStatus;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [debts, searchQuery, filterType, filterStatus]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-brand-red/10 text-brand-red text-xs font-medium px-2 py-0.5 rounded-full">
            {t('debt.status.active', 'Active')}
          </Badge>
        );
      case 'paid_off':
        return (
          <Badge className="bg-brand-blue/10 text-brand-blue text-xs font-medium px-2 py-0.5 rounded-full">
            {t('debt.status.paidOff', 'Paid Off')}
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 rounded-full">
            {t('debt.status.closed', 'Closed')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 rounded-full">
            {status}
          </Badge>
        );
    }
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-brand-red';
    if (percentage >= 60) return 'bg-brand-red/70';
    return 'bg-brand-blue';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Table Header with Search and Filters */}
      <div className="flex-shrink-0 border-b border-border bg-muted/40 px-2 py-2 sm:px-3 min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 min-w-0">
          <div className="flex items-center flex-wrap gap-2 min-w-0 flex-1">
            <div className="relative min-w-0 flex-1 sm:flex-initial">
              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder={t('debt.searchPlaceholder', 'Search debt...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-10 w-full sm:w-48 md:w-64 min-w-0"
              />
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40 md:w-48 min-w-0">
                <SelectValue placeholder={t('debt.allTypes', 'All Types')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('debt.allTypes', 'All Types')}</SelectItem>
                <SelectItem value="Kartu Kredit">{t('debt.type.creditCard', 'Credit Card')}</SelectItem>
                <SelectItem value="Pinjaman Bank">{t('debt.type.bankLoan', 'Bank Loan')}</SelectItem>
                <SelectItem value="Hutang Supplier">{t('debt.type.supplierDebt', 'Supplier Debt')}</SelectItem>
                <SelectItem value="Pinjaman Online">{t('debt.type.onlineLoan', 'Online Loan')}</SelectItem>
                <SelectItem value="Hutang Pribadi">{t('debt.type.personalDebt', 'Personal Debt')}</SelectItem>
                <SelectItem value="Lainnya">{t('debt.type.other', 'Other')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-32 md:w-40 min-w-0">
                <SelectValue placeholder={t('debt.allStatus', 'All Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('debt.allStatus', 'All Status')}</SelectItem>
                <SelectItem value="active">{t('debt.status.active', 'Active')}</SelectItem>
                <SelectItem value="paid_off">{t('debt.status.paidOff', 'Paid Off')}</SelectItem>
                <SelectItem value="closed">{t('debt.status.closed', 'Closed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {onPayDebt && (
              <Button 
                onClick={() => {
                  // Show payment modal for first active debt that has remaining balance
                  const activeDebt = debts.find(d => {
                    if (d.status !== 'active') return false;
                    return debtDisplayBalance(d) > 0;
                  });
                  if (activeDebt) {
                    onPayDebt(activeDebt);
                  }
                }}
                className="bg-brand-blue hover:bg-brand-blue/90 text-white w-full sm:w-auto"
                disabled={!debts.some(d => {
                  if (d.status !== 'active') return false;
                  return debtDisplayBalance(d) > 0;
                })}
              >
                <span className="hidden sm:inline">{t('debt.payment.button', 'Pay Debt')}</span>
                <span className="sm:hidden">{t('debt.payment.buttonShort', 'Pay')}</span>
              </Button>
            )}
            {onAdd && (
              <Button 
                onClick={onAdd}
                className="bg-brand-blue hover:bg-brand-blue/90 text-white w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{t('debt.addDebt', 'Add Debt')}</span>
                <span className="sm:hidden">{t('debt.add', 'Add')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal scroll only; vertikal mengikuti scroll halaman (sama pola expense dashboard) */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[1760px]">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/40 shadow-sm">
            <tr>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.debtName', 'Debt Name')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.type', 'Type')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.bankInstitution', 'Bank/Institution')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.totalLimit', 'Total Limit')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.availableLimit', 'Available Limit')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.debt', 'Debt')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.paid', 'Paid')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.interest', 'Interest (Rp)')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.utilization', 'Utilization')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.dueDate', 'Due Date')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.lastPaymentDate', 'Last Payment')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.status', 'Status')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.brick.column', 'Brick')}</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">{t('debt.table.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredDebts.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-8 text-center text-gray-500">
                  <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-1">{t('debt.table.noData', 'No debt data')}</p>
                  <p className="text-xs text-gray-400">{t('debt.table.addFirst', 'Add your first debt to get started')}</p>
                </td>
              </tr>
            ) : (
              filteredDebts.map((debt) => {
                const {
                  displayLimitAmount,
                  displayAvailableLimit,
                  displayDebtAmount,
                  displayPaidAmount,
                  displayInterest,
                  utilization,
                } = resolveDebtDisplay(debt);

                return (
                  <tr key={debt.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[200px] min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 rounded-md bg-brand-blue/10 flex-shrink-0">
                          <CreditCard className="h-3.5 w-3.5 text-brand-blue" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate text-xs sm:text-sm">
                            {debt.debt_name}
                          </div>
                          {debt.description && (
                            <div className="text-xs text-gray-500 truncate mt-0.5">
                              {debt.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap text-xs sm:text-sm">
                      <Badge variant="outline" className="text-xs">
                        {debt.debt_type}
                      </Badge>
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[150px] min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-gray-100">
                          <Building className="h-3 w-3 text-gray-600" />
                        </div>
                        <span className="text-xs sm:text-sm text-gray-700 truncate">
                          {debt.bank_name || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium whitespace-nowrap text-xs sm:text-sm">
                      {formatToRupiah(displayLimitAmount)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium whitespace-nowrap text-xs sm:text-sm text-brand-blue">
                      {formatToRupiah(displayAvailableLimit)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 font-bold whitespace-nowrap text-xs sm:text-sm text-brand-red">
                      {formatToRupiah(displayDebtAmount)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium whitespace-nowrap text-xs sm:text-sm text-brand-blue">
                      {displayPaidAmount != null && displayPaidAmount > 0 && onPaidClick ? (
                        <button
                          type="button"
                          onClick={() => onPaidClick(debt)}
                          className="cursor-pointer underline decoration-brand-blue/60 underline-offset-2 hover:decoration-brand-blue/90 focus:outline-none focus:ring-0"
                        >
                          {formatToRupiah(displayPaidAmount)}
                        </button>
                      ) : (
                        formatToRupiah(displayPaidAmount ?? 0)
                      )}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium whitespace-nowrap text-xs sm:text-sm">
                      {displayInterest !== null && displayInterest > 0 
                        ? formatToRupiah(displayInterest) 
                        : '-'}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${getUtilizationColor(utilization)}`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                          {utilization}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap text-xs sm:text-sm">
                      {debt.due_date ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          {format(new Date(debt.due_date), 'dd MMM yyyy')}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap text-xs sm:text-sm">
                      {debt.last_payment_date ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          {format(new Date(debt.last_payment_date), 'dd MMM yyyy')}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                      {getStatusBadge(debt.status)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4">
                      {debt.debt_type === 'Kartu Kredit' ? (
                        <BrickLinkStatusBadge
                          status={debt.brick_link_status}
                          lastSyncAt={debt.brick_last_sync_at}
                          lastSyncError={debt.brick_last_sync_error}
                          busy={brickBusyId === debt.id}
                          i18nPrefix="debt.brick"
                          t={t}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                            disabled={brickBusyId === debt.id}
                          >
                            {brickBusyId === debt.id ? (
                              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {onViewDetails && (
                            <DropdownMenuItem onClick={() => onViewDetails(debt)}>
                              <Eye className="h-4 w-4 mr-2 text-gray-600" />
                              {t('debt.detail.title', 'Debt Details')}
                            </DropdownMenuItem>
                          )}
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(debt)}>
                              <Edit className="h-4 w-4 mr-2 text-gray-600" />
                              {t('debt.form.editTitle', 'Edit Debt')}
                            </DropdownMenuItem>
                          )}
                          {debt.debt_type === 'Kartu Kredit' ? (
                            <BrickLinkDropdownMenuItems
                              status={debt.brick_link_status}
                              i18nPrefix="debt.brick"
                              t={t}
                              disabled={brickBusyId === debt.id}
                              onLink={onLinkBrick ? () => onLinkBrick(debt) : undefined}
                              onSync={onSyncBrick ? () => onSyncBrick(debt) : undefined}
                              onUnlink={onUnlinkBrick ? () => onUnlinkBrick(debt) : undefined}
                            />
                          ) : null}
                          {onDelete && (
                            <DropdownMenuItem
                              className="text-brand-red"
                              onClick={() => onDelete(debt.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('debt.form.delete', 'Delete')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-2 sm:px-3 py-2 border-t bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {t('debt.table.showing', 'Showing')} {filteredDebts.length} {t('debt.table.of', 'of')} {debts.length} {t('debt.debts', 'debts')}
          </span>
          <div className="flex items-center gap-4">
            <span>
              {t('debt.totalDebt', 'Total Debt')}: <span className="font-bold text-brand-red">
                {formatToRupiah(
                  filteredDebts.reduce((sum, d) => sum + debtDisplayBalance(d), 0)
                )}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
