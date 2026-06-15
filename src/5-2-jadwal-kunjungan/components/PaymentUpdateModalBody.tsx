import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Progress } from '@/shared/components/ui/progress';
import { Card, CardContent } from '@/shared/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Plus, Upload, TrendingUp, CheckCircle2, FileText, X, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { PaymentUpdateModalModel } from '@/5-2-jadwal-kunjungan/hooks/usePaymentUpdateModal';
import { PiutangXenditVaPanel } from '@/4-1-transaction/piutang/components/PiutangXenditVaPanel';
import { shouldOfferPiutangVaCollection } from '@/4-1-transaction/piutang/utils/piutangVaCollection';

export type PaymentUpdateModalBodyLayout = 'desktop' | 'mobile';

export type PaymentUpdateModalBodyProps = {
  layout: PaymentUpdateModalBodyLayout;
  model: PaymentUpdateModalModel;
};

export function PaymentUpdateModalBody({ layout, model }: PaymentUpdateModalBodyProps) {
  const isDesktop = layout === 'desktop';
  const {
    isLivechatVariant,
    viewOnly,
    paymentHistory,
    paymentSummary,
    progressivePayments,
    loading,
    showAddPaymentForm,
    setShowAddPaymentForm,
    invoiceFile,
    setInvoiceFile,
    newPayment,
    setNewPayment,
    editingPayment,
    editForm,
    setEditForm,
    editReceiptFile,
    setEditReceiptFile,
    formatPaymentAmountThousands,
    formatPaymentCurrency,
    formatPaymentDate,
    getPaymentTypeBadge,
    getCurrentTotalAmount,
    getRemainingAmount,
    getPaymentTypeLabel,
    handleAddPayment,
    handleDownloadInvoice,
    handleEditPayment,
    handleCancelEdit,
    handleSaveEdit,
    handleDeletePayment,
    getPaymentStatusColor,
    organizationId,
    loadData,
  } = model;

  const vaCollectionPayments = progressivePayments.filter((p) =>
    shouldOfferPiutangVaCollection({
      transferVerificationStatus: p.transfer_verification_status,
      paymentMethod: p.payment_method,
      receiptUrl: p.receipt_url,
    }),
  );

  return (
    <div className={cn('space-y-4', isDesktop ? 'pr-4' : 'px-4 py-3')}>
{/* Payment Summary Card */}
          {paymentSummary && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand-blue" />
                    <h4 className="text-sm font-semibold text-slate-800">Payment Progress</h4>
                  </div>
                  {paymentSummary.isFullyPaid && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-semibold">FULLY PAID</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Progress</span>
                    <span className="font-medium">{paymentSummary.progressPercentage.toFixed(1)}%</span>
                  </div>
                  
                  <Progress value={paymentSummary.progressPercentage} className="h-2" />
                  
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-slate-500">Total Amount</div>
                      <div className="font-semibold">{formatToRupiah(paymentSummary.totalAmount)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Paid</div>
                      <div className="font-semibold text-green-600">{formatToRupiah(paymentSummary.totalPaid)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Remaining</div>
                      <div className={`font-semibold ${paymentSummary.isFullyPaid ? 'text-green-600' : 'text-orange-600'}`}>
                        {formatToRupiah(paymentSummary.remainingAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Header Actions */}
          <div
            className={cn(
              'mb-4 flex flex-shrink-0 items-center justify-between',
              !isDesktop && 'flex-col items-stretch gap-2',
            )}
          >
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                Total Payments: {paymentHistory.length}
              </div>
            </div>
            <Button 
              size="sm" 
              className={cn('text-xs h-8', !isDesktop && 'w-full')}
              onClick={() => setShowAddPaymentForm(true)}
              disabled={viewOnly || paymentSummary?.isFullyPaid}
            >
              <Plus className="h-3 w-3 mr-1" />
              {viewOnly ? 'View Only' : (paymentSummary?.isFullyPaid ? 'Fully Paid' : 'Add Payment')}
            </Button>
          </div>

          {/* Add Payment Form */}
          {showAddPaymentForm && (
            <div className="mb-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-slate-800">Add New Payment</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAddPaymentForm(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              <div className={cn('grid gap-3', isDesktop ? 'grid-cols-2' : 'grid-cols-1')}>
                <div>
                  <Label htmlFor="total-amount" className="text-xs">Total Amount</Label>
                  <Input
                    id="total-amount"
                    type="text"
                    value={formatPaymentCurrency(getCurrentTotalAmount())}
                    className="text-xs h-8 bg-gray-50"
                    readOnly
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="remaining-amount" className="text-xs">Remaining Amount</Label>
                  <Input
                    id="remaining-amount"
                    type="text"
                    value={formatPaymentCurrency(getRemainingAmount())}
                    className="text-xs h-8 bg-gray-50"
                    readOnly
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="amount" className="text-xs">Payment Amount *</Label>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={newPayment.payment_amount}
                    onChange={(e) =>
                      setNewPayment((prev) => ({
                        ...prev,
                        payment_amount: formatPaymentAmountThousands(e.target.value),
                      }))
                    }
                    className="text-xs h-8"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="date" className="text-xs">Payment Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newPayment.payment_date}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, payment_date: e.target.value }))}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="method" className="text-xs">Payment Method *</Label>
                  <Select
                    value={newPayment.payment_method}
                    onValueChange={(value) => setNewPayment(prev => ({ ...prev, payment_method: value }))}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="type" className="text-xs">Payment Type</Label>
                  <Input
                    id="type"
                    type="text"
                    value={getPaymentTypeLabel()}
                    className="text-xs h-8 bg-gray-50"
                    readOnly
                    disabled
                  />
                </div>
                <div className={cn(isDesktop && 'col-span-2')}>
                  <Label htmlFor="invoice" className="text-xs">Upload Invoice</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="invoice"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                      className="text-xs h-8"
                    />
                    {invoiceFile && (
                      <div className="flex items-center text-xs text-green-600">
                        <Upload className="h-3 w-3 mr-1" />
                        {invoiceFile.name}
                      </div>
                    )}
                  </div>
                </div>
                <div className={cn(isDesktop && 'col-span-2')}>
                  <Label htmlFor="notes" className="text-xs">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newPayment.notes}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, notes: e.target.value }))}
                    className="text-xs resize-none"
                    rows={2}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAddPaymentForm(false)}
                  className="text-xs h-7"
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleAddPayment}
                  disabled={loading}
                  className="text-xs h-7"
                >
                  {loading ? 'Adding...' : 'Add Payment'}
                </Button>
              </div>
            </div>
          )}

          {editingPayment && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-800">Edit payment</h4>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCancelEdit}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className={cn('grid gap-3', isDesktop ? 'grid-cols-2' : 'grid-cols-1')}>
                <div>
                  <Label htmlFor="edit-amount" className="text-xs">
                    Amount *
                  </Label>
                  <Input
                    id="edit-amount"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={editForm.payment_amount}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        payment_amount: formatPaymentAmountThousands(e.target.value),
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-date" className="text-xs">
                    Date *
                  </Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editForm.payment_date}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, payment_date: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className={cn(isDesktop && 'col-span-2')}>
                  <Label htmlFor="edit-method" className="text-xs">
                    Method *
                  </Label>
                  <Select
                    value={editForm.payment_method}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, payment_method: value }))}
                  >
                    <SelectTrigger id="edit-method" className="h-8 text-xs">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(isDesktop && 'col-span-2')}>
                  <Label htmlFor="edit-receipt" className="text-xs">
                    Replace receipt (optional)
                  </Label>
                  <Input
                    id="edit-receipt"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setEditReceiptFile(e.target.files?.[0] || null)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className={cn(isDesktop && 'col-span-2')}>
                  <Label htmlFor="edit-notes" className="text-xs">
                    Notes
                  </Label>
                  <Textarea
                    id="edit-notes"
                    value={editForm.notes}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="text-xs resize-none"
                    rows={2}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={() => void handleSaveEdit()}>
                  {loading ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          )}

          {/* Payment History Table */}
          <div className="min-h-[200px] border border-slate-200 rounded-lg">
            {loading ? (
              <div className="p-6 text-center text-slate-500">Loading payment history...</div>
            ) : paymentHistory.length === 0 ? (
              <div className="p-6 text-center text-slate-500">No payments found</div>
            ) : (
              <div className={cn(isDesktop ? 'overflow-auto max-h-[300px]' : 'min-h-0 overflow-x-auto overflow-y-auto', '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden')} role="region" aria-label="Payment history table">
                <table className={cn('w-full', !isDesktop && 'min-w-[720px]')}>
                  <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Date</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Type</th>
                      <th className="text-right p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Amount</th>
                      <th className="text-right p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Remaining</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Method</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Notes</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {progressivePayments.map((payment, index) => (
                      <tr key={payment.id || `payment-${index}-${payment.payment_date}`} className="hover:bg-slate-50/50">
                        <td className="p-3 text-xs text-slate-700">
                          {formatPaymentDate(payment.payment_date)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {getPaymentTypeBadge(payment.payment_type || 'partial_payment')}
                            <span className="text-xs text-slate-500">#{payment.payment_sequence || index + 1}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-700 text-right font-medium">
                          {formatPaymentCurrency(payment.payment_amount || payment.paymentAmount || 0)}
                        </td>
                        <td className="p-3 text-xs text-right">
                          <div className={`font-medium ${getPaymentStatusColor(payment)}`}>
                            {formatPaymentCurrency(payment.remainingAfterPayment || 0)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {payment.progressPercentage?.toFixed(1)}% paid
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-600">
                          {payment.payment_method?.replace('_', ' ') || '-'}
                        </td>
                        <td className="p-3 text-xs text-slate-600 max-w-32">
                          {payment.notes ? (
                            <span className="line-clamp-2 break-words" title={payment.notes}>
                              {payment.notes}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-3">
                          {isLivechatVariant ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs whitespace-nowrap"
                              onClick={() => handleDownloadInvoice(payment)}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                              Generate Invoice
                            </Button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleDownloadInvoice(payment)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Generate Invoice
                                </DropdownMenuItem>
                                {!viewOnly && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleEditPayment(payment)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => void handleDeletePayment(payment)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!viewOnly && vaCollectionPayments.length > 0 ? (
            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-medium text-slate-800">Koleksi via Virtual Account</h4>
              {vaCollectionPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                >
                  <p className="mb-2 text-xs text-slate-600">
                    Cicilan #{payment.payment_sequence ?? '—'} ·{' '}
                    {formatToRupiah(Number(payment.payment_amount ?? 0))}
                  </p>
                  <PiutangXenditVaPanel
                    organizationId={organizationId}
                    paymentId={payment.id}
                    paymentAmount={Number(payment.payment_amount ?? 0)}
                    clientName={model.clientName}
                    verificationStatus={payment.transfer_verification_status}
                    paymentMethod={payment.payment_method}
                    receiptUrl={payment.receipt_url}
                    onCreated={() => void loadData()}
                  />
                </div>
              ))}
            </div>
          ) : null}
    </div>
  );
}
