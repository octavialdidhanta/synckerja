import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Calendar as CalendarIcon, Clock, User, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { DeadlineHistory } from '../index';

interface DeadlineHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
  deadlineHistory: DeadlineHistory[];
}

export const DeadlineHistoryDialog: React.FC<DeadlineHistoryDialogProps> = ({
  isOpen,
  onClose,
  taskId,
  deadlineHistory
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto seamless-scroll">
        <DialogHeader>
          <DialogTitle>Deadline History</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {deadlineHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No deadline changes recorded</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deadlineHistory.map((history, index) => (
                <div key={history.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(history.status)}
                      <span className="font-medium text-sm">Request #{index + 1}</span>
                    </div>
                    {getStatusBadge(history.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium">Original Deadline:</span>
                      </div>
                      <p className="text-sm text-gray-700 ml-6">
                        {format(new Date(history.original_deadline), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium">New Deadline:</span>
                      </div>
                      <p className="text-sm text-gray-700 ml-6">
                        {format(new Date(history.new_deadline), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>

                  {history.reason && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-700">Reason:</span>
                      <p className="text-sm text-gray-600 mt-1 p-2 bg-white rounded border">
                        {history.reason}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span>Requested: {format(new Date(history.requested_at), 'MMM dd, yyyy HH:mm')}</span>
                    </div>
                    {history.approved_at && (
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        <span>Processed: {format(new Date(history.approved_at), 'MMM dd, yyyy HH:mm')}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
