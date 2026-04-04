import { useState } from 'react';
import { Calendar, Clock, MapPin, User, MoreVertical, Plus, CheckCircle, XCircle, Edit, Eye, DollarSign } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { VisitSchedulingModal } from './VisitSchedulingModal';
import { PaymentUpdateModal } from './PaymentUpdateModal';
import { useVisitScheduling } from '@/shared/hooks/organized/sales';
export const VisitSchedulingList = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentModalVisit, setPaymentModalVisit] = useState<any>(null);
  const { visits, loading, createScheduledVisit } = useVisitScheduling();
  
  const handleScheduleVisit = async (visitData: any) => {
    await createScheduledVisit(visitData);
    setIsModalOpen(false);
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-200">Confirmed</Badge>;
      case 'scheduled':
        return <Badge variant="default" className="text-xs bg-brand-blue-soft text-brand-blue-deep border-brand-blue/25">Scheduled</Badge>;
      case 'cancelled':
        return <Badge variant="default" className="text-xs bg-red-100 text-red-700 border-red-200">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Unknown</Badge>;
    }
  };
  return <div>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Scheduled Visits</h2>
          <p className="text-xs text-slate-500">Manage sales team visit schedules</p>
        </div>
        
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">Client</th>
              <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">Sales Person</th>
              <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">Date</th>
              <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">Time</th>
              <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">Purpose</th>
              <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="text-left p-3 text-xs font-medium text-slate-600 uppercase tracking-wider w-40 max-w-40">Location</th>
              <th className="text-right p-3 text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white/50 divide-y divide-slate-100/80">
            {loading ? <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500">Loading visits...</td>
              </tr> : visits.length === 0 ? <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500">No visits scheduled</td>
              </tr> : visits.map(visit => <tr key={visit.id} className="hover:bg-brand-blue-soft/40 transition-colors">
                  <td className="p-3">
                    <div className="text-sm font-medium text-slate-800">
                      {visit.clientInfo?.company_name || 'Unknown Client'}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center text-sm text-slate-600">
                      <User className="h-3 w-3 mr-1 flex-shrink-0" />
                      {visit.employees?.full_name || 'Unassigned'}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center text-sm text-slate-600">
                      <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                      {new Date(visit.visit_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center text-sm text-slate-600">
                      <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                      {visit.planned_start_time || 'TBD'}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-slate-700">{visit.visit_purpose}</span>
                  </td>
                  <td className="p-3">
                    {getStatusBadge(visit.status)}
                  </td>
                  <td className="p-3 w-40 max-w-40">
                    <div className="flex items-center text-xs text-slate-600">
                      <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate" title={visit.locationInfo?.name || 'Location not set'}>
                        {visit.locationInfo?.name || 'Location not set'}
                      </span>
                    </div>
                  </td>
                <td className="p-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem className="text-xs">
                        <Eye className="h-3 w-3 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-xs">
                        <Edit className="h-3 w-3 mr-2" />
                        Edit Visit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-xs"
                        onClick={() => setPaymentModalVisit(visit)}
                      >
                        <DollarSign className="h-3 w-3 mr-2" />
                        Update Payment
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-2" />
                        Confirm
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-xs text-red-600">
                        <XCircle className="h-3 w-3 mr-2" />
                        Cancel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </td>
                </tr>)}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between p-4 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          Showing {visits.length} visits
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" className="text-xs h-8" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8" disabled>
            Next
          </Button>
        </div>
      </div>

      {/* Visit Scheduling Modal */}
      <VisitSchedulingModal open={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleScheduleVisit} />
      
      {/* Payment Update Modal */}
      <PaymentUpdateModal 
        open={!!paymentModalVisit}
        onClose={() => setPaymentModalVisit(null)}
        salesActivityId={paymentModalVisit?.sales_activity_id || paymentModalVisit?.id}
        clientName={paymentModalVisit?.clientInfo?.company_name}
      />
    </div>;
};
