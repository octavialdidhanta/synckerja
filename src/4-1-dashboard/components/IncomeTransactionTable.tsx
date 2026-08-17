
import { useState } from 'react';
import { Plus, Search, Filter, Download, MoreHorizontal, Edit, Trash2, Eye, FileDown } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import { MODAL_BRAND_HEADER_BAR } from '@/shared/constants/modalBrandHeaderClasses';
import { Badge } from '@/shared/components/ui/badge';
import { useIncomeTransactions } from '../hooks';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { format } from 'date-fns';
import { AddIncomeForm } from './AddIncomeForm';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getIncomeTransactionIdDisplay } from '@/4-1-dashboard/utils/incomeTransactionDisplayId';
import { formatIncomePaymentMethodLabel } from '@/4-1-transaction/utils/formatIncomePaymentMethod';

export function IncomeTransactionTable() {
  const { t } = useAppTranslation();
  const { incomeTransactions, isLoading } = useIncomeTransactions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const filteredTransactions = incomeTransactions.filter((transaction) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      transaction.customer_name?.toLowerCase().includes(q) ||
      transaction.description?.toLowerCase().includes(q) ||
      transaction.id.toLowerCase().includes(q) ||
      (transaction.transaction_reference || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    const matchesType = typeFilter === 'all' || transaction.income_types?.name === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
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
    <div className="p-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-800">Income Transactions</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add Income
            </Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader
              className={cn('flex-shrink-0 space-y-1 px-4 py-3 text-left', MODAL_BRAND_HEADER_BAR)}
            >
              <DialogTitle className="text-lg font-semibold text-primary-foreground">
                {t('incomes.addTransactionTitle', 'Add New Income Transaction')}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/90">
                {t('incomes.addTransactionSubtitle', 'Create a new income transaction record')}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <AddIncomeForm onSuccess={() => setIsAddDialogOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Compact Filter Section */}
      <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-slate-50/50 rounded-md border">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 h-7 text-xs border-slate-200"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[100px] h-7 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[100px] h-7 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="subscription">Subscription</SelectItem>
          </SelectContent>
        </Select>

        {/* Action Buttons */}
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
            <Filter className="h-3 w-3 mr-1" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Enhanced Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="h-8 px-3 text-xs font-medium">Transaction</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Customer</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Service</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Type & Category</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Amount</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Payment Method</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Recurring</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Receipt</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Status</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium max-w-[10rem]">
                {t('incomes.tableTransactionId', 'Transaction ID')}
              </TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Date</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-16 text-center text-xs text-gray-500">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id} className="hover:bg-slate-50/50">
                  <TableCell className="px-3 py-2 text-xs max-w-xs">
                    <div className="font-medium text-wrap break-words">
                      {transaction.description || 'Transaction'}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs font-medium">
                    {transaction.customer_name || '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div>
                      {transaction.services?.name || '-'}
                    </div>
                    {transaction.sub_services?.name && (
                      <div className="text-gray-500 text-xs">
                        {transaction.sub_services.name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div>
                      {transaction.income_types?.name || 'Unknown'}
                    </div>
                    {transaction.income_categories?.name && (
                      <div className="text-gray-500 text-xs">
                        {transaction.income_categories.name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div className="font-semibold text-green-600">
                      {formatToRupiah(transaction.amount)}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {formatIncomePaymentMethodLabel(transaction.payment_method, {
                      cash: t('incomes.paymentMethod.cash', 'Cash'),
                      bankTransfer: t('incomes.paymentMethod.bankTransfer', 'Bank Transfer'),
                      eWallet: t('incomes.paymentMethod.eWallet', 'E-wallet'),
                      creditCard: t('incomes.paymentMethod.creditCard', 'Credit Card'),
                      debitCard: t('incomes.paymentMethod.debitCard', 'Debit Card'),
                    })}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <Badge
                      variant="outline"
                      className={transaction.is_recurring ? "text-xs bg-purple-50 text-purple-700 border-purple-200" : "text-xs"}
                    >
                      {transaction.is_recurring ? (transaction.recurring_frequency ? `Recurring • ${transaction.recurring_frequency}` : "Recurring") : "One-time"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {transaction.receipt_file_path ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs hover:bg-blue-50"
                        onClick={async () => {
                          try {
                            const path = transaction.receipt_file_path as string;
                            if (path.startsWith('http')) {
                              // Open external/public URL in new tab
                              window.open(path, '_blank');
                              return;
                            }
                            const { supabase } = await import('@/shared/lib/supabaseClient');
                            const { data, error } = await supabase.storage
                              .from('income-receipts')
                              .download(path);
                            if (error) {
                              console.error('Error downloading receipt:', error);
                              return;
                            }
                            const url = URL.createObjectURL(data);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = transaction.receipt_file_name || `receipt-${transaction.id.substring(0, 8)}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            console.error('Failed to download receipt:', err);
                          }
                        }}
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs hover:bg-blue-50"
                        onClick={async () => {
                          try {
                            const { supabase } = await import('@/shared/lib/supabaseClient');
                            // Try to find a matching sales activity receipt as a fallback
                            const { data: sa, error } = await supabase
                              .from('sales_activities')
                              .select('receipt_url, client_name, date, total_amount, organization_id')
                              .eq('client_name', transaction.customer_name)
                              .not('receipt_url', 'is', null)
                              .order('created_at', { ascending: false })
                              .limit(1);
                            
                            if (error) {
                              console.error('Error fetching related sales activity:', error);
                              return;
                            }
                            
                            const url = sa?.[0]?.receipt_url as string | undefined;
                            console.log('Found receipt URL from sales activity:', url);
                            
                            if (url && url.includes('storage/v1/object/public/')) {
                              // It's a Supabase storage URL, open directly
                              window.open(url, '_blank');
                            } else if (url) {
                              // For other URLs, still try to open
                              window.open(url, '_blank');
                            } else {
                              console.info('No related receipt found for customer:', transaction.customer_name);
                            }
                          } catch (err) {
                            console.error('Failed to open related receipt:', err);
                          }
                        }}
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <Badge variant={getStatusBadgeVariant(transaction.status)} className="text-xs">
                      {transaction.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs max-w-[10rem] min-w-0">
                    {(() => {
                      const { display, title } = getIncomeTransactionIdDisplay(transaction);
                      return (
                        <div className="truncate font-mono text-xs" title={title}>
                          {display}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-6 w-6 p-0">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem className="text-xs">
                          <Eye className="mr-2 h-3 w-3" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs">
                          <Edit className="mr-2 h-3 w-3" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs text-red-600">
                          <Trash2 className="mr-2 h-3 w-3" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Compact Pagination */}
      {filteredTransactions.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
          <span>
            Showing {filteredTransactions.length} of {incomeTransactions.length} transactions
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" disabled>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
