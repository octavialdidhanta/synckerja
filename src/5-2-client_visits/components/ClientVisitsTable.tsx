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
import { Calendar, Clock, MapPin, MoreVertical, Eye, Edit, Trash } from 'lucide-react';
import { ClientVisitsTableFooter } from './ClientVisitsTableFooter';
import { format } from 'date-fns';

interface ClientVisitsTableProps {
  visits: any[];
  onEdit?: (visit: any) => void;
  selectedStatus?: string;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'scheduled':
      return 'bg-brand-blue-soft text-brand-blue-deep border-brand-blue/25';
    case 'ongoing':
      return 'bg-amber-100 text-amber-800 border-amber-200';
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

const formatTime = (time: string | null) => {
  if (!time) return '-';
  try {
    return format(new Date(`1970-01-01T${time}`), 'HH:mm');
  } catch {
    return time;
  }
};

// Memoized row component for performance
const VisitRow = memo(({ 
  visit, 
  onEdit
}: {
  visit: any;
  onEdit?: (visit: any) => void;
}) => {
  const handleViewDetails = useCallback(() => {
    console.log('View details:', visit);
  }, [visit]);

  const handleEdit = useCallback(() => {
    onEdit?.(visit);
  }, [visit, onEdit]);

  const handleDelete = useCallback(() => {
    console.log('Delete visit:', visit);
  }, [visit]);

  return (
    <TableRow className="hover:bg-gray-50/50 h-12 transition-colors">
      <TableCell className="w-40 px-3 text-sm">
        <div>
          <span className="truncate block font-medium text-gray-900" title={visit.clientInfo?.company_name || 'Unknown Client'}>
            {visit.clientInfo?.company_name || 'Unknown Client'}
          </span>
          {visit.clientInfo?.contact_phone && (
            <span className="text-xs text-gray-500 truncate block" title={visit.clientInfo.contact_phone}>
              {visit.clientInfo.contact_phone}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-36 px-3 text-sm">
        <div>
          <span className="truncate block font-medium text-gray-900" title={visit.employees?.full_name || 'Unknown Employee'}>
            {visit.employees?.full_name || 'Unknown Employee'}
          </span>
          {visit.employees?.email && (
            <span className="text-xs text-gray-500 truncate block" title={visit.employees.email}>
              {visit.employees.email}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-32 px-3 text-sm whitespace-nowrap">
        {formatDate(visit.visit_date)}
      </TableCell>
      <TableCell className="w-40 px-3 text-sm">
        <div>
          <div className="flex items-center text-xs text-gray-600 mb-1">
            <Clock className="h-3 w-3 mr-1 flex-shrink-0 text-brand-blue" />
            <span>Plan: {formatTime(visit.planned_start_time)} - {formatTime(visit.planned_end_time)}</span>
          </div>
          {(visit.actual_start_time || visit.actual_end_time) && (
            <div className="flex items-center text-xs text-green-600">
              <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
              <span>Actual: {formatTime(visit.actual_start_time)} - {formatTime(visit.actual_end_time)}</span>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="w-48 px-3 text-sm">
        <div>
          <span className="truncate block" title={visit.visit_purpose || '-'}>
            {visit.visit_purpose || '-'}
          </span>
          {visit.notes && (
            <span className="text-xs text-gray-500 truncate block" title={visit.notes}>
              {visit.notes}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-32 px-3">
        <Badge className={`${getStatusColor(visit.status)} text-xs px-2 py-1 border`}>
          {visit.status?.charAt(0).toUpperCase() + visit.status?.slice(1) || 'Unknown'}
        </Badge>
      </TableCell>
      <TableCell className="w-40 px-3 text-sm">
        <div>
          <div className="flex items-center">
            <MapPin className="h-3 w-3 mr-1 flex-shrink-0 text-gray-400" />
            <span className="truncate block" title={visit.locationInfo?.name || 'Location not set'}>
              {visit.locationInfo?.name || 'Location not set'}
            </span>
          </div>
          {visit.locationInfo?.address && (
            <span className="text-xs text-gray-500 truncate block" title={visit.locationInfo.address}>
              {visit.locationInfo.address}
            </span>
          )}
          {visit.validation_accuracy_meters && (
            <span className="text-xs text-green-600 truncate block">
              ✓ Verified ({visit.validation_accuracy_meters}m)
            </span>
          )}
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
            <DropdownMenuItem className="text-xs" onClick={handleViewDetails}>
              <Eye className="h-3 w-3 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" onClick={handleEdit}>
              <Edit className="h-3 w-3 mr-2" />
              Edit Visit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-red-600" onClick={handleDelete}>
              <Trash className="h-3 w-3 mr-2" />
              Cancel Visit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

VisitRow.displayName = 'VisitRow';

export const ClientVisitsTable = memo(({ 
  visits, 
  onEdit,
  selectedStatus = 'all'
}: ClientVisitsTableProps) => {
  // Memoize the table headers to prevent re-renders
  const tableHeaders = useMemo(() => [
    { key: 'client', label: 'Client', width: 'w-40' },
    { key: 'employee', label: 'Employee', width: 'w-36' },
    { key: 'date', label: 'Date', width: 'w-32' },
    { key: 'time', label: 'Time', width: 'w-40' },
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
      />
    ))
  ), [visits, onEdit]);

  return (
    <div className="flex h-full flex-col">
      {/* Match `VisitSchedulingTable`: one axis emphasis avoids extra scrollport + AppShell double bar */}
      <div className="scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-sm">
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
                    <div className="text-lg">👥</div>
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
      <ClientVisitsTableFooter 
        totalVisits={visits.length}
        completedVisits={visits.filter(v => v.status === 'completed').length}
        filteredVisits={visits.length}
        selectedStatus={selectedStatus}
      />
    </div>
  );
});

ClientVisitsTable.displayName = 'ClientVisitsTable';
