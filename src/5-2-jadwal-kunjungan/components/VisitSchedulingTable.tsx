import React, { memo, useMemo, useCallback } from 'react';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Calendar, Clock, MapPin, User, MoreVertical, Eye, Edit, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { VisitSchedulingTableFooter } from './VisitSchedulingTableFooter';
import { VisitSchedulingModal } from './VisitSchedulingModal';
import { PaymentUpdateModal } from './PaymentUpdateModal';

interface VisitSchedulingTableProps {
  visits: any[];
  onRefresh?: () => void;
  onEdit?: (visit: any) => void;
  onUpdatePayment?: (visit: any) => void;
  selectedStatus?: string;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'confirmed':
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'scheduled':
      return 'bg-brand-blue-soft text-brand-blue-deep border-brand-blue/25';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
};

// Memoized row component for performance
const VisitRow = memo(({ 
  visit, 
  onEdit,
  onUpdatePayment
}: {
  visit: any;
  onEdit?: (visit: any) => void;
  onUpdatePayment?: (visit: any) => void;
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);

  const handleEdit = useCallback(() => {
    setIsEditModalOpen(true);
  }, []);

  const handleUpdatePayment = useCallback(() => {
    setIsPaymentModalOpen(true);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setIsEditModalOpen(false);
    onEdit?.(visit);
  }, [visit, onEdit]);

  return (
    <>
      <TableRow className="hover:bg-gray-50/50 h-12 transition-colors">
        <TableCell className="w-40 px-3 text-sm">
          <span className="truncate block font-medium text-gray-900" title={visit.clientInfo?.company_name || 'Unknown Client'}>
            {visit.clientInfo?.company_name || 'Unknown Client'}
          </span>
        </TableCell>
        <TableCell className="w-36 px-3 text-sm">
          <div className="flex items-center">
            <User className="h-3 w-3 mr-1 flex-shrink-0 text-gray-400" />
            <span className="truncate block" title={visit.employees?.full_name || 'Unassigned'}>
              {visit.employees?.full_name || 'Unassigned'}
            </span>
          </div>
        </TableCell>
        <TableCell className="w-32 px-3 text-sm whitespace-nowrap">
          {formatDate(visit.visit_date)}
        </TableCell>
        <TableCell className="w-32 px-3 text-sm whitespace-nowrap">
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1 flex-shrink-0 text-gray-400" />
            <span>{visit.planned_start_time || 'TBD'}</span>
          </div>
        </TableCell>
        <TableCell className="w-48 px-3 text-sm">
          <span className="truncate block" title={visit.visit_purpose || '-'}>
            {visit.visit_purpose || '-'}
          </span>
        </TableCell>
        <TableCell className="w-32 px-3">
          <Badge className={`${getStatusColor(visit.status)} text-xs px-2 py-1 border`}>
            {visit.status?.charAt(0).toUpperCase() + visit.status?.slice(1) || 'Unknown'}
          </Badge>
        </TableCell>
        <TableCell className="w-40 px-3 text-sm">
          <div className="flex items-center">
            <MapPin className="h-3 w-3 mr-1 flex-shrink-0 text-gray-400" />
            <span className="truncate block" title={visit.locationInfo?.name || 'Location not set'}>
              {visit.locationInfo?.name || 'Location not set'}
            </span>
          </div>
        </TableCell>
        <TableCell className="w-24 px-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-xs">
                <Eye className="h-3 w-3 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={handleEdit}>
                <Edit className="h-3 w-3 mr-2" />
                Edit Visit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={handleUpdatePayment}>
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
        </TableCell>
      </TableRow>

      {/* Edit Modal */}
      <VisitSchedulingModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleEditSuccess}
      />

      {/* Payment Modal */}
      <PaymentUpdateModal
        open={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        salesActivityId={visit?.sales_activity_id || visit?.id}
        clientName={visit?.clientInfo?.company_name}
      />
    </>
  );
});

VisitRow.displayName = 'VisitRow';

export const VisitSchedulingTable = memo(({ 
  visits, 
  onRefresh,
  onEdit,
  onUpdatePayment,
  selectedStatus = 'all'
}: VisitSchedulingTableProps) => {
  // Memoize the table headers to prevent re-renders
  const tableHeaders = useMemo(() => [
    { key: 'client', label: 'Client', width: 'w-40' },
    { key: 'salesPerson', label: 'Sales Person', width: 'w-36' },
    { key: 'date', label: 'Date', width: 'w-32' },
    { key: 'time', label: 'Time', width: 'w-32' },
    { key: 'purpose', label: 'Purpose', width: 'w-48' },
    { key: 'status', label: 'Status', width: 'w-32' },
    { key: 'location', label: 'Location', width: 'w-40' },
    { key: 'actions', label: 'Actions', width: 'w-24' },
  ], []);

  const renderVisitRows = useMemo(() => (
    visits.map((visit) => (
      <VisitRow
        key={visit.id}
        visit={visit}
        onEdit={onEdit}
        onUpdatePayment={onUpdatePayment}
      />
    ))
  ), [visits, onEdit, onUpdatePayment]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="bg-gray-50 sticky top-0 z-20 shadow-sm">
            <TableRow className="hover:bg-transparent">
              {tableHeaders.map((header) => (
                <TableHead key={header.key} className={`text-xs font-medium text-gray-700 ${header.width} px-3 bg-gray-50 whitespace-nowrap`}>
                  {header.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500 text-sm">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-lg">📅</div>
                    <div>No visits found</div>
                    <div className="text-xs text-gray-400">Try adjusting your filters or search terms</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              renderVisitRows
            )}
          </TableBody>
        </table>
      </div>

      {/* Table Footer */}
      <VisitSchedulingTableFooter 
        totalVisits={visits.length}
        scheduledVisits={visits.filter(v => v.status === 'scheduled').length}
        filteredVisits={visits.length}
        selectedStatus={selectedStatus}
      />
    </div>
  );
});

VisitSchedulingTable.displayName = 'VisitSchedulingTable';

