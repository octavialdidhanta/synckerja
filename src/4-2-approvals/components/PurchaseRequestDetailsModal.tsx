
import { useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { format } from 'date-fns';
import { PurchaseRequest, useUpdatePurchaseRequestStatus } from '@/9-request-form/hooks/usePurchaseRequests';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useToast } from '@/shared/components/ui/use-toast';
import {
  Calendar,
  User,
  Building,
  DollarSign,
  FileText,
  Target,
  Zap,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  X,
} from 'lucide-react';
import { PurchaseRequestPDFViewer } from './PurchaseRequestPDFViewer';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

const SCROLL_HIDE =
  'scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

interface PurchaseRequestDetailsModalProps {
  request: PurchaseRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PurchaseRequestDetailsModal = ({ request, isOpen, onClose }: PurchaseRequestDetailsModalProps) => {
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionTextarea, setShowRejectionTextarea] = useState(false);

  const { data: userRole } = useCurrentUserRole();
  const { t } = useAppTranslation();
  const updateStatus = useUpdatePurchaseRequestStatus();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  if (!request) return null;

  const normalizedUserRole = typeof userRole === 'string' ? userRole : null;
  const canApprove = !!normalizedUserRole && ['owner', 'admin', 'hr'].includes(normalizedUserRole);
  const canTakeAction = canApprove && (request.status === 'submitted' || request.status === 'pending_approval');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending_approval':
      case 'submitted':
        return <Badge className="bg-brand-blue/10 text-brand-blue">Pending Approval</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const handleApprove = async () => {
    try {
      await updateStatus.mutateAsync({
        id: request.id,
        status: 'approved',
        approvalNotes: approvalNotes || undefined,
      });
      toast({
        title: "Request Approved",
        description: "Purchase request has been approved successfully.",
      });
      onClose();
      setApprovalNotes('');
    } catch (error) {
      console.error('Approval error:', error);
      toast({
        title: "Error",
        description: "Failed to approve request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateStatus.mutateAsync({
        id: request.id,
        status: 'rejected',
        rejectionReason: rejectionReason
      });
      toast({
        title: "Request Rejected",
        description: "Purchase request has been rejected.",
      });
      onClose();
      setRejectionReason('');
      setShowRejectionTextarea(false);
    } catch (error) {
      console.error('Rejection error:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={
          isMobile
            ? 'modal-above-safe-area fixed left-0 right-0 top-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0'
            : 'max-w-4xl max-h-[85vh] flex flex-col'
        }
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        {isMobile ? (
          <DialogHeader className="safe-area-top flex flex-shrink-0 flex-row flex-nowrap items-stretch gap-0 space-y-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-0 py-0 text-left dark:from-blue-950/20 dark:to-indigo-950/20">
            <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
              <DialogDescription className="sr-only">
                {t('approvals.requestDetailsDescription', 'Request details and approval actions')}
              </DialogDescription>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-1">
                <DialogTitle className="m-0 flex min-h-0 min-w-0 items-center truncate text-left text-base font-semibold leading-tight">
                  {t('approvals.requestDetails', 'Request Details')}
                </DialogTitle>
                <span className="shrink-0">{getStatusBadge(request.status)}</span>
              </div>
              <DialogClose
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-blue/50 bg-background/80 p-0 text-muted-foreground ring-offset-background transition hover:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="block h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only">{t('common.close', 'Close')}</span>
              </DialogClose>
            </div>
          </DialogHeader>
        ) : (
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{t('approvals.requestDetails', 'Request Details')}</span>
              {getStatusBadge(request.status)}
            </DialogTitle>
          </DialogHeader>
        )}

        <Tabs
          defaultValue="details"
          className={cn('flex min-h-0 flex-1 flex-col', isMobile && 'min-h-0 px-4 py-3')}
        >
          <TabsList className="grid w-full shrink-0 grid-cols-2">
            <TabsTrigger value="details">{t('approvals.tabDetail', 'Detail')}</TabsTrigger>
            <TabsTrigger value="pdf">{t('approvals.tabPdf', 'PDF')}</TabsTrigger>
          </TabsList>

          <TabsContent
            value="details"
            className={cn(
              'mt-4 min-h-0 flex-1 overflow-y-auto seamless-scroll data-[state=inactive]:hidden',
              SCROLL_HIDE,
            )}
          >
            <div className="space-y-4">
          {/* Basic Information */}
          <Card className="border-slate-200">
            <CardHeader className="px-4 py-3 pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5">
                  <FileText className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Title</p>
                    <p className="font-medium text-slate-900 break-words">{request.request_title}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Amount</p>
                    <p className="font-medium text-slate-900">{formatToRupiah(request.amount_idr)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Requester</p>
                    <p className="font-medium text-slate-900 break-words">{request.requester_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Department</p>
                    <p className="font-medium text-slate-900">{request.department_name || 'Not specified'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Created</p>
                    <p className="font-medium text-slate-900">{format(new Date(request.created_at), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                {request.is_recurring && (
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 mb-1">Frequency</p>
                      <p className="font-medium text-purple-600">{request.recurring_frequency}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card className="border-slate-200">
            <CardHeader className="px-4 py-3 pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Description
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-3">
              <p className="text-slate-700 whitespace-pre-wrap">
                {request.description || 'No description provided'}
              </p>
            </CardContent>
          </Card>

          {/* Business Impact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Company Benefit
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <p className="text-slate-700 whitespace-pre-wrap">
                  {request.company_benefit || 'Not specified'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Expected Outcome
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <p className="text-slate-700 whitespace-pre-wrap">
                  {request.expected_outcome || 'Not specified'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Purchase Details */}
          {request.request_type === 'purchase' && (
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Purchase Details
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <div className="space-y-3">
                  {request.vendor_name && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Vendor</p>
                      <p className="font-medium text-slate-900">{request.vendor_name}</p>
                    </div>
                  )}
                  {request.purchase_link && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Purchase Link</p>
                      <a 
                        href={request.purchase_link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-brand-blue hover:text-brand-blue/90 hover:underline text-sm break-all"
                      >
                        {request.purchase_link}
                      </a>
                    </div>
                  )}
                  {request.purchase_type && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Type</p>
                      <p className="font-medium text-slate-900">{request.purchase_type}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reimbursement Details */}
          {request.request_type === 'reimbursement' && (
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Reimbursement Details
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <div className="space-y-3">
                {request.reimbursement_type && (
                  <div>
                    <p className="text-xs text-slate-600">Type</p>
                    <p className="font-medium">{request.reimbursement_type}</p>
                  </div>
                )}
                {request.merchant_name && (
                  <div>
                    <p className="text-xs text-slate-600">Merchant</p>
                    <p className="font-medium">{request.merchant_name}</p>
                  </div>
                )}
                {request.receipt_number && (
                  <div>
                    <p className="text-xs text-slate-600">Receipt Number</p>
                    <p className="font-medium">{request.receipt_number}</p>
                  </div>
                )}
                {request.expense_date && (
                  <div>
                    <p className="text-xs text-slate-600">Expense Date</p>
                    <p className="font-medium">{format(new Date(request.expense_date), 'MMM dd, yyyy')}</p>
                  </div>
                )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval Information */}
          {(request.status === 'approved' || request.status === 'rejected') && (
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Approval Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <div className="space-y-2.5">
                {request.approved_by_name && (
                  <div>
                    <p className="text-xs text-slate-600">Approved By</p>
                    <p className="font-medium">{request.approved_by_name}</p>
                  </div>
                )}
                {request.rejected_by_name && (
                  <div>
                    <p className="text-xs text-slate-600">Rejected By</p>
                    <p className="font-medium">{request.rejected_by_name}</p>
                  </div>
                )}
                {request.approved_at && (
                  <div>
                    <p className="text-xs text-slate-600">Date</p>
                    <p className="font-medium">{format(new Date(request.approved_at), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                )}
                {request.rejected_at && (
                  <div>
                    <p className="text-xs text-slate-600">Date</p>
                    <p className="font-medium">{format(new Date(request.rejected_at), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                )}
                {request.rejection_reason && (
                  <div>
                    <p className="text-xs text-slate-600">Rejection Reason</p>
                    <p className="font-medium text-brand-red">{request.rejection_reason}</p>
                  </div>
                )}
                {request.approval_notes && (
                  <div>
                    <p className="text-xs text-slate-600">Notes</p>
                    <p className="font-medium">{request.approval_notes}</p>
                  </div>
                )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Section */}
          {canTakeAction && (
            <>
              <Separator className="my-6" />

              {/* Approval Notes */}
              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Approval Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 py-3 space-y-3">
                  {!showRejectionTextarea ? (
                    <div className="space-y-2">
                      <Label htmlFor="approval-notes" className="text-sm font-medium">
                        Approval Notes <span className="text-slate-500 text-xs font-normal">(Optional)</span>
                      </Label>
                      <Textarea
                        id="approval-notes"
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Add any notes or comments for this approval..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="rejection-reason" className="text-sm font-medium">
                        Rejection Reason <span className="text-brand-red">*</span>
                      </Label>
                      <Textarea
                        id="rejection-reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Please provide a clear reason for rejecting this request..."
                        rows={3}
                        className="resize-none"
                        required
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-2.5 justify-end pt-2">
                {!showRejectionTextarea ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRejectionTextarea(true)}
                      className="text-brand-red border-brand-red/30 hover:bg-brand-red/10 hover:border-brand-red/50"
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      type="button"
                      onClick={handleApprove}
                      disabled={updateStatus.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      {updateStatus.isPending ? 'Approving...' : 'Approve'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowRejectionTextarea(false);
                        setRejectionReason('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleReject}
                      disabled={updateStatus.isPending || !rejectionReason.trim()}
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      {updateStatus.isPending ? 'Rejecting...' : 'Confirm Reject'}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
            </div>
          </TabsContent>

          <TabsContent
            value="pdf"
            className={cn(
              'mt-4 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden',
              isMobile && 'min-h-[50vh]',
            )}
          >
            <div className={cn('h-full', isMobile ? 'min-h-[50vh]' : 'min-h-[600px]')}>
              <PurchaseRequestPDFViewer request={request} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
