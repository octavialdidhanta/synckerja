import { useState } from "react";
import { Button } from "@/mobile/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/mobile/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/features/ui/dialog";
import { Textarea } from "@/features/ui/textarea";
import { MoreHorizontal, Eye, ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";
import { useUpdatePurchaseRequestStatus, useDeletePurchaseRequest, usePurchaseRequests, type PurchaseRequest } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { useCurrentUserRole } from "@/features/share/hooks/useCurrentUserRole";
import { useToast } from "@/features/ui/use-toast";
import { MobilePurchaseRequestDetailsModal } from "@/mobile/pages/expenses/approvals/modal/MobilePurchaseRequestDetailsModal";

interface MobileApprovalActionsDropdownProps {
  requestId: string;
  status: string;
}

export function MobileApprovalActionsDropdown({ requestId, status }: MobileApprovalActionsDropdownProps) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: requests = [] } = usePurchaseRequests();
  const { data: userRole } = useCurrentUserRole();
  const updateStatus = useUpdatePurchaseRequestStatus();
  const deleteRequest = useDeletePurchaseRequest();
  const { toast } = useToast();

  const request: PurchaseRequest | undefined = requests.find((r) => r.id === requestId);
  const canApprove = userRole && ["owner", "admin", "hr"].includes(userRole);
  const canTakeAction = canApprove && status === "submitted";

  const handleApprove = async () => {
    try {
      await updateStatus.mutateAsync({ id: requestId, status: "approved", approvalNotes });
      toast({ title: "Request Approved", description: "Purchase request has been approved successfully." });
      setShowApprovalDialog(false);
      setApprovalNotes("");
    } catch {}
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({ title: "Rejection Reason Required", description: "Please provide a reason for rejection.", variant: "destructive" });
      return;
    }
    try {
      await updateStatus.mutateAsync({ id: requestId, status: "rejected", rejectionReason });
      toast({ title: "Request Rejected", description: "Purchase request has been rejected." });
      setShowRejectionDialog(false);
      setRejectionReason("");
    } catch {}
  };

  const handleDelete = async () => {
    try {
      await deleteRequest.mutateAsync(requestId);
      setShowDeleteDialog(false);
    } catch {}
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-10 w-10 p-0 touch-manipulation">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowDetailsModal(true)}>
            <Eye className="mr-2 h-4 w-4" />View Details
          </DropdownMenuItem>
          {canTakeAction && (
            <>
              <DropdownMenuItem onClick={() => setShowApprovalDialog(true)}>
                <ThumbsUp className="mr-2 h-4 w-4 text-green-600" />Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowRejectionDialog(true)}>
                <ThumbsDown className="mr-2 h-4 w-4 text-red-600" />Reject
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-600 focus:text-red-700">
            <Trash2 className="mr-2 h-4 w-4" />Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MobilePurchaseRequestDetailsModal request={request || null} isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} />

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600"><ThumbsUp className="h-5 w-5" />Approve Request</DialogTitle>
            <DialogDescription>You are about to approve this purchase request. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} placeholder="Add any notes or comments for this approval..." rows={3} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowApprovalDialog(false); setApprovalNotes(""); }}>Cancel</Button>
              <Button onClick={handleApprove} disabled={updateStatus.isPending} className="bg-green-600 hover:bg-green-700">
                {updateStatus.isPending ? "Approving..." : "Approve Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><ThumbsDown className="h-5 w-5" />Reject Request</DialogTitle>
            <DialogDescription>You are about to reject this purchase request. Please provide a clear reason.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Please provide a clear reason for rejecting this request..." rows={3} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowRejectionDialog(false); setRejectionReason(""); }}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={updateStatus.isPending || !rejectionReason.trim()}>
                {updateStatus.isPending ? "Rejecting..." : "Reject Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" />Delete Request</DialogTitle>
            <DialogDescription>Are you sure you want to delete this purchase request?</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRequest.isPending}>
              {deleteRequest.isPending ? "Deleting..." : "Delete Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
