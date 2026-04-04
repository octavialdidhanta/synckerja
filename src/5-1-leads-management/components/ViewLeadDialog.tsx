import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { X, User, Calendar, Tag, UserCheck, BarChart3, Activity, Globe } from "lucide-react";
import { format } from "date-fns";
import { NewLead } from '@/shared/types/leads';
import { getLeadStatusDisplayName } from '../utils/leadStatusDisplay';

interface ViewLeadDialogProps {
  open: boolean;
  onClose: () => void;
  lead: NewLead | null;
}

export const ViewLeadDialog = ({
  open,
  onClose,
  lead
}: ViewLeadDialogProps) => {
  if (!lead) return null;

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy, HH:mm');
    } catch {
      return dateString;
    }
  };

  const getFUPriorityColor = (priority?: string) => {
    const colors = {
      'High': 'bg-red-100 text-red-700',
      'Medium': 'bg-yellow-100 text-yellow-700', 
      'Low': 'bg-green-100 text-green-700'
    };
    return colors[priority as keyof typeof colors] || colors.Medium;
  };

  const getStatusColor = (status?: string) => {
    const colors = {
      'Open': 'bg-red-100 text-red-700',
      'In Progress': 'bg-yellow-100 text-yellow-700',
      'Closed': 'bg-green-100 text-green-700'
    };
    return colors[status as keyof typeof colors] || colors.Open;
  };

  const getSourceColor = (source?: string) => {
    const colors = {
      'Email': 'bg-blue-100 text-blue-700',
      'Phone': 'bg-purple-100 text-purple-700',
      'Chat': 'bg-pink-100 text-pink-700',
      'Website': 'bg-green-100 text-green-700',
      'WhatsApp': 'bg-emerald-100 text-emerald-700',
      'Instagram': 'bg-amber-100 text-amber-700'
    };
    return colors[source as keyof typeof colors] || colors.Website;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader className="flex items-center justify-between border-b pb-4">
          <div>
            <DialogTitle className="text-xl font-semibold">{lead.title}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Lead Details - {lead.ticket_id}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Client Name</label>
                <p className="text-sm font-medium mt-1">{lead.client}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Category</label>
                <p className="text-sm font-medium mt-1">{lead.category}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created By</label>
                <p className="text-sm font-medium mt-1">{lead.created_by_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Assignee</label>
                <p className="text-sm font-medium mt-1">{lead.assignee}</p>
              </div>
            </div>
          </div>

          {/* Status Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-500" />
              Status & Priority
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <Badge className={`${getStatusColor(lead.lead_status?.name || 'Open')} text-xs px-3 py-1 rounded-full font-medium`}>
                    {getLeadStatusDisplayName(lead.lead_status?.name || 'Open')}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">FU Priority</label>
                <div className="mt-1">
                  <Badge className={`${getFUPriorityColor(lead.fu_priority)} text-xs px-3 py-1 rounded-full font-medium`}>
                    {lead.fu_priority || 'Medium'}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Source</label>
                <div className="mt-1">
                  <Badge className={`${getSourceColor(lead.source)} text-xs px-3 py-1 rounded-full font-medium`}>
                    {lead.source || 'Website'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Follow-up Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              Follow-up Information
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Total Follow-ups</label>
                <p className="text-sm font-medium mt-1">{lead.followup || 0} follow-ups recorded</p>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              Timeline
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <p className="text-sm font-medium mt-1">{formatDate(lead.created_at)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Last Updated</label>
                <p className="text-sm font-medium mt-1">{formatDate(lead.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
