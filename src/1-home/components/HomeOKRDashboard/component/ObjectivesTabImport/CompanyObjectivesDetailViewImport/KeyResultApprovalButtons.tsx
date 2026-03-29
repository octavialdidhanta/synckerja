
import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Check, X, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { useApproveKeyResult, useRejectKeyResult, useGetKeyResultApproval, useCreateKeyResultApproval } from '../../../../../hooks/useKeyResultApprovals';
import { useCurrentUserRole } from '../../../../../hooks/useCurrentUserRole';
import { useCurrentOrg } from '../../../hooks/useCurrentOrg';

interface KeyResultApprovalButtonsProps {
  keyResultId: string;
  isDepartmentLevel: boolean;
}

export const KeyResultApprovalButtons: React.FC<KeyResultApprovalButtonsProps> = ({
  keyResultId,
  isDepartmentLevel
}) => {
  const { data: userRole } = useCurrentUserRole();
  const { organizationId } = useCurrentOrg();
  const { data: approval } = useGetKeyResultApproval(keyResultId);
  const approveKeyResult = useApproveKeyResult();
  const rejectKeyResult = useRejectKeyResult();
  const createApproval = useCreateKeyResultApproval();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');

  // Show approval buttons based on KR level and user role
  if (!userRole) {
    return null;
  }
  
  // For company-level KRs: only owners can approve
  // For department-level KRs: owners and admins can approve
  const canApprove = isDepartmentLevel 
    ? ['owner', 'admin'].includes(userRole)
    : userRole === 'owner';
    
  if (!canApprove) {
    return null;
  }

  const handleCreateApproval = async () => {
    if (organizationId) {
      try {
        console.log('Creating approval for KR:', keyResultId);
        await createApproval.mutateAsync({
          keyResultId,
          organizationId
        });
        console.log('Approval created successfully');
      } catch (error) {
        console.error('Error creating approval:', error);
      }
    }
  };

  const handleApprove = async () => {
    if (approval) {
      try {
        console.log('Approving KR approval:', approval.id);
        await approveKeyResult.mutateAsync({
          approvalId: approval.id,
          notes: notes || undefined
        });
        console.log('KR approved successfully');
        setNotes('');
      } catch (error) {
        console.error('Error approving KR:', error);
      }
    }
  };

  const handleReject = async () => {
    if (approval && rejectionReason.trim()) {
      try {
        console.log('Rejecting KR approval:', approval.id);
        await rejectKeyResult.mutateAsync({
          approvalId: approval.id,
          rejectionReason: rejectionReason.trim(),
          notes: notes || undefined
        });
        console.log('KR rejected successfully');
        setRejectDialogOpen(false);
        setRejectionReason('');
        setNotes('');
      } catch (error) {
        console.error('Error rejecting KR:', error);
      }
    }
  };

  const getStatusBadge = () => {
    if (!approval) return null;
    
    switch (approval.status) {
      case 'approved':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
            <Check className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
            <X className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  // If no approval record exists, show create approval button
  if (!approval) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreateApproval}
          disabled={createApproval.isPending}
          className="h-6 px-2 py-1 text-xs"
        >
          {createApproval.isPending ? 'Creating...' : 'Request Approval'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      {getStatusBadge()}
      
      {approval.status === 'pending' && (
        <div className="flex gap-1">
          {/* Approve Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleApprove}
            disabled={approveKeyResult.isPending}
            className="h-6 px-2 py-1 text-xs border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/20"
          >
            <Check className="w-3 h-3" />
          </Button>
          
          {/* Reject Button */}
          <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 py-1 text-xs border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
              >
                <X className="w-3 h-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Reject Key Result</DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Berikan alasan dan catatan tambahan sebelum menolak Key Result ini.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="rejection-reason">Alasan Reject *</Label>
                  <Textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Berikan alasan mengapa Key Result ini di-reject..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Catatan Tambahan</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Catatan atau saran perbaikan..."
                    className="mt-1"
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setRejectDialogOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={!rejectionReason.trim() || rejectKeyResult.isPending}
                  >
                    {rejectKeyResult.isPending ? 'Rejecting...' : 'Reject'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
      
      {approval.rejection_reason && (
        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
          Alasan: {approval.rejection_reason}
        </div>
      )}
    </div>
  );
};

