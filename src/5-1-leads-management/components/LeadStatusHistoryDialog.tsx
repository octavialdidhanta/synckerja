import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { format } from "date-fns";
import { useLeadStatusHistory, LeadStatusHistoryEntry } from '@/shared/hooks/organized/sales';
import { getLeadStatusDisplayName } from '../utils/leadStatusDisplay';
import { Calendar, User, ArrowRight } from 'lucide-react';

interface LeadStatusHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadTitle: string;
}

export const LeadStatusHistoryDialog: React.FC<LeadStatusHistoryDialogProps> = ({
  open,
  onClose,
  leadId,
  leadTitle
}) => {
  const [history, setHistory] = useState<LeadStatusHistoryEntry[]>([]);
  const { getStatusHistory, loading } = useLeadStatusHistory();

  useEffect(() => {
    const fetchHistory = async () => {
      if (open && leadId) {
        try {
          const historyData = await getStatusHistory(leadId);
          
          // Remove duplicates based on unique combination of fields
          const uniqueHistory = historyData.filter((entry, index, self) => {
            return index === self.findIndex(
              (e) => 
                e.lead_id === entry.lead_id &&
                e.old_status === entry.old_status &&
                e.new_status === entry.new_status &&
                e.changed_at === entry.changed_at &&
                e.changed_by === entry.changed_by &&
                e.notes === entry.notes
            );
          });
          
          setHistory(uniqueHistory);
        } catch (error) {
          console.error('Error fetching history:', error);
          setHistory([]);
        }
      } else {
        setHistory([]);
      }
    };

    fetchHistory();
  }, [open, leadId]);

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'Open': 'bg-blue-50 text-blue-700 border-blue-200',
      'In Progress': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'Qualified': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Converted': 'bg-green-50 text-green-700 border-green-200',
      'Closed': 'bg-gray-50 text-gray-700 border-gray-200',
      'Lost': 'bg-red-50 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy, HH:mm');
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Status History
          </DialogTitle>
          <DialogDescription>
            Status change history for lead: <span className="font-medium">{leadTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] w-full">
          {loading ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">Loading status history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">No status changes recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-4 p-1">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {entry.old_status && (
                        <>
                          <Badge className={`${getStatusColor(entry.old_status)} text-xs px-2 py-1 rounded-sm font-medium border`}>
                            {getLeadStatusDisplayName(entry.old_status)}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                        </>
                      )}
                      <Badge className={`${getStatusColor(entry.new_status)} text-xs px-2 py-1 rounded-sm font-medium border`}>
                        {getLeadStatusDisplayName(entry.new_status)}
                      </Badge>
                      {entry.new_status === 'Converted' && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs px-2 py-1 rounded-sm font-medium border">
                          🎉 Converted!
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(entry.changed_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    <span>Changed by: {entry.changed_by_name}</span>
                  </div>

                  {entry.notes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                      <strong>Notes:</strong> {entry.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

