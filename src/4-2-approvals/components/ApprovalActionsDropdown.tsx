
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/shared/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { useUpdatePurchaseRequestStatus, useDeletePurchaseRequest, usePurchaseRequests, PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { PurchaseRequestDetailsModal } from './PurchaseRequestDetailsModal';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
import { useToast } from '@/shared/components/ui/use-toast';

interface ApprovalActionsDropdownProps {
  requestId: string;
  status: string;
}

export const ApprovalActionsDropdown = ({ requestId, status }: ApprovalActionsDropdownProps) => {
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

  const request: PurchaseRequest | undefined = requests.find(r => r.id === requestId);
  const canApprove = userRole && ['owner', 'admin', 'hr'].includes(userRole);
  const canTakeAction = canApprove && status === 'submitted';

  const handleApprove = async () => {
    try {
      await updateStatus.mutateAsync({
        id: requestId,
        status: 'approved',
        approvalNotes: approvalNotes
      });
      toast({
        title: "Request Approved",
        description: "Purchase request has been approved successfully.",
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
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateStatus.mutateAsync({
        id: requestId,
        status: 'rejected',
        rejectionReason: rejectionReason
      });
      toast({
        title: "Request Rejected",
        description: "Purchase request has been rejected.",
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowDetailsModal(true)}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          
          {canTakeAction && (
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
          )}
          
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-brand-red focus:text-brand-red/90"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Details Modal */}
      <PurchaseRequestDetailsModal
        request={request || null}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
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
              <label className="block text-sm font-medium mb-2">
                Approval Notes (Optional)
              </label>
              <Textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any notes or comments for this approval..."
                rows={3}
              />
            </div>
            
            <div className="flex gap-2 justify-end">
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
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
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
              <label className="block text-sm font-medium mb-2">
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
            
            <div className="flex gap-2 justify-end">
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
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-brand-red">
              <Trash2 className="h-5 w-5" />
              Delete Request
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this purchase request? This action cannot be undone and will permanently delete the request and all associated documents.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRequest.isPending}
            >
              {deleteRequest.isPending ? 'Deleting...' : 'Delete Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

