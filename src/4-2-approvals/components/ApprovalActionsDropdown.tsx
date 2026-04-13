import { useState, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, ThumbsUp, ThumbsDown, Trash2, X } from 'lucide-react';
import {
  useUpdatePurchaseRequestStatus,
  useDeletePurchaseRequest,
  usePurchaseRequests,
  PurchaseRequest,
} from '@/9-request-form/hooks/usePurchaseRequests';
import { PurchaseRequestDetailsModal } from './PurchaseRequestDetailsModal';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useToast } from '@/shared/components/ui/use-toast';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

const SCROLL_HIDE =
  'scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

interface ApprovalActionsDropdownProps {
  requestId: string;
  status: string;
  /** e.g. mobile table: `h-10 w-10 touch-manipulation p-0` */
  triggerButtonClassName?: string;
}

export const ApprovalActionsDropdown = ({
  requestId,
  status,
  triggerButtonClassName,
}: ApprovalActionsDropdownProps) => {
  const isMobile = useIsMobile();
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: requests = [] } = usePurchaseRequests();
  const { data: userRole } = useCurrentUserRole();
  const updateStatus = useUpdatePurchaseRequestStatus();
  const deleteRequest = useDeletePurchaseRequest();
  const { toast } = useToast();

  const request: PurchaseRequest | undefined = requests.find((r) => r.id === requestId);
  const normalizedRole = typeof userRole === 'string' ? userRole : null;
  const canApprove = !!normalizedRole && ['owner', 'admin', 'hr'].includes(normalizedRole);
  const canTakeAction =
    canApprove && (status === 'submitted' || status === 'pending_approval');

  const handleApprove = async () => {
    try {
      await updateStatus.mutateAsync({
        id: requestId,
        status: 'approved',
        approvalNotes: approvalNotes,
      });
      toast({
        title: 'Request Approved',
        description: 'Purchase request has been approved successfully.',
      });
      setShowApprovalDialog(false);
      setApprovalNotes('');
    } catch (error) {
      console.error('Approval error:', error);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: 'Rejection Reason Required',
        description: 'Please provide a reason for rejection.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateStatus.mutateAsync({
        id: requestId,
        status: 'rejected',
        rejectionReason: rejectionReason,
      });
      toast({
        title: 'Request Rejected',
        description: 'Purchase request has been rejected.',
      });
      setShowRejectionDialog(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Rejection error:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRequest.mutateAsync(requestId);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const mobileDialogShell = (title: string, description: string, body: ReactNode | null, footer: ReactNode) => (
    <>
      <DialogHeader className="safe-area-top flex flex-shrink-0 flex-row flex-nowrap items-stretch gap-0 space-y-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-0 py-0 text-left dark:from-blue-950/20 dark:to-indigo-950/20">
        <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
          <div className="min-w-0 flex-1">
            <DialogTitle className="m-0 flex min-h-0 min-w-0 items-center text-left text-base font-semibold leading-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-left text-xs leading-snug text-muted-foreground">
              {description}
            </DialogDescription>
          </div>
          <DialogClose
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-blue/50 bg-background/80 p-0 text-muted-foreground ring-offset-background transition hover:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="block h-4 w-4 shrink-0" aria-hidden />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
      </DialogHeader>
      {body != null ? (
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-4 py-4 seamless-scroll',
            SCROLL_HIDE,
          )}
        >
          {body}
        </div>
      ) : (
        <div className="min-h-0 flex-1" />
      )}
      <div className="flex-shrink-0 border-t bg-muted/30 px-4 pb-3 pt-3">{footer}</div>
    </>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', triggerButtonClassName)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowDetailsModal(true)}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>

          {canTakeAction ? (
            <>
              <DropdownMenuItem onClick={() => setShowApprovalDialog(true)}>
                <ThumbsUp className="mr-2 h-4 w-4 text-green-600" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowRejectionDialog(true)}>
                <ThumbsDown className="mr-2 h-4 w-4 text-brand-red" />
                Reject
              </DropdownMenuItem>
            </>
          ) : null}

          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-brand-red focus:text-brand-red/90"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PurchaseRequestDetailsModal
        request={request || null}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent
          className={
            isMobile
              ? 'modal-above-safe-area fixed left-0 right-0 top-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0'
              : undefined
          }
          fullscreenAnimation={isMobile}
          hideCloseButton={isMobile}
        >
          {isMobile ? (
            mobileDialogShell(
              'Approve Request',
              'You are about to approve this purchase request. This action cannot be undone.',
              <div>
                <label className="mb-2 block text-sm font-medium">Approval Notes (Optional)</label>
                <Textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add any notes or comments for this approval..."
                  rows={3}
                />
              </div>,
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowApprovalDialog(false);
                    setApprovalNotes('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-w-[120px] bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={updateStatus.isPending}
                >
                  {updateStatus.isPending ? 'Approving...' : 'Approve Request'}
                </Button>
              </div>,
            )
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <ThumbsUp className="h-5 w-5" />
                  Approve Request
                </DialogTitle>
                <DialogDescription>
                  You are about to approve this purchase request. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Approval Notes (Optional)</label>
                  <Textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Add any notes or comments for this approval..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowApprovalDialog(false);
                      setApprovalNotes('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={updateStatus.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {updateStatus.isPending ? 'Approving...' : 'Approve Request'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent
          className={
            isMobile
              ? 'modal-above-safe-area fixed left-0 right-0 top-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0'
              : undefined
          }
          fullscreenAnimation={isMobile}
          hideCloseButton={isMobile}
        >
          {isMobile ? (
            mobileDialogShell(
              'Reject Request',
              'You are about to reject this purchase request. Please provide a clear reason.',
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Rejection Reason <span className="text-brand-red">*</span>
                </label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a clear reason for rejecting this request..."
                  rows={3}
                  required
                />
              </div>,
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowRejectionDialog(false);
                    setRejectionReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="min-w-[120px]"
                  onClick={handleReject}
                  disabled={updateStatus.isPending || !rejectionReason.trim()}
                >
                  {updateStatus.isPending ? 'Rejecting...' : 'Reject Request'}
                </Button>
              </div>,
            )
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-brand-red">
                  <ThumbsDown className="h-5 w-5" />
                  Reject Request
                </DialogTitle>
                <DialogDescription>
                  You are about to reject this purchase request. Please provide a clear reason.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Rejection Reason <span className="text-brand-red">*</span>
                  </label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a clear reason for rejecting this request..."
                    rows={3}
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectionDialog(false);
                      setRejectionReason('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={updateStatus.isPending || !rejectionReason.trim()}
                  >
                    {updateStatus.isPending ? 'Rejecting...' : 'Reject Request'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent
          className={
            isMobile
              ? 'modal-above-safe-area fixed left-0 right-0 top-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0'
              : undefined
          }
          fullscreenAnimation={isMobile}
          hideCloseButton={isMobile}
        >
          {isMobile ? (
            mobileDialogShell(
              'Delete Request',
              'Are you sure you want to delete this purchase request? This action cannot be undone and will permanently delete the request and all associated documents.',
              null,
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="min-w-[120px]"
                  onClick={handleDelete}
                  disabled={deleteRequest.isPending}
                >
                  {deleteRequest.isPending ? 'Deleting...' : 'Delete Request'}
                </Button>
              </div>,
            )
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-brand-red">
                  <Trash2 className="h-5 w-5" />
                  Delete Request
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this purchase request? This action cannot be undone and will
                  permanently delete the request and all associated documents.
                </DialogDescription>
              </DialogHeader>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteRequest.isPending}>
                  {deleteRequest.isPending ? 'Deleting...' : 'Delete Request'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
