import { memo, useMemo, useCallback } from 'react';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { LoadingDots } from "@/shared/components/LoadingDots";
import { getPhotoUrl, getInitials } from '../hooks/photoUtils';
import { EmployeeActionsDropdown } from './EmployeeActionsDropdown';
import type { Employee } from '../hooks/useEmployees';
import { useOptimizedPerformanceMonitor } from '../hooks/useOptimizedPerformanceMonitor';
import { EmployeeTableFooter } from './EmployeeTableFooter';
import { EmployeeManagerCell } from './EmployeeManagerCell';
import { getEmployeeStatus, countActiveEmployees } from '../utils/employeeUtils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import './EmployeeTable.css';

interface EmployeeTableProps {
  employees: Employee[];
  /** Full org list (unfiltered) for manager dropdown options */
  allEmployees: Employee[];
  currentUserEmail?: string;
  userRole?: string;
  onRefresh: () => void;
  onViewEmployee: (id: string) => void;
  isLoading?: boolean;
}


// Memoized row component for performance
const EmployeeRow = memo(({ 
  employee, 
  allEmployees,
  currentUserEmail, 
  userRole,
  onRefresh, 
  onViewEmployee 
}: {
  employee: Employee;
  allEmployees: Employee[];
  currentUserEmail?: string;
  userRole?: string;
  onRefresh: () => void;
  onViewEmployee: (id: string) => void;
}) => {
  const getStatusColor = useCallback((statusName: string | null) => {
    if (!statusName) return 'bg-gray-100 text-gray-800 border-gray-200';

    const status = statusName.toLowerCase();
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'contract':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'permanent':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'probation':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'terminated':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      case 'pending removal':
      case 'pendingremoval':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  const formatDate = useCallback((dateString: string | null) => {
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
  }, []);

  const handleViewEmployee = useCallback(() => {
    onViewEmployee(employee.id);
  }, [employee.id, onViewEmployee]);

  // Use consistent status display logic
  const displayStatus = getEmployeeStatus(employee);

  const photoUrl = getPhotoUrl(employee.photo_url);
  return (
    <TableRow className="h-12 transition-colors hover:bg-gray-50/50">
      <TableCell className="w-64 px-4">
        <div className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            {photoUrl && (
              <AvatarImage 
                src={photoUrl} 
                alt={employee.full_name}
                className="object-cover"
                loading="lazy"
              />
            )}
            <AvatarFallback className="bg-blue-100 text-xs font-semibold text-blue-600">
              {getInitials(employee.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-900">{employee.full_name}</div>
            <div className="truncate text-xs text-gray-500">{employee.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="w-52 px-3 align-middle">
        <EmployeeManagerCell
          employee={employee}
          allEmployees={allEmployees}
          userRole={userRole}
          currentUserEmail={currentUserEmail}
          onRefresh={onRefresh}
        />
      </TableCell>
      <TableCell className="w-48 px-3">
        <span className="whitespace-nowrap rounded bg-gray-50 px-2 py-1 font-mono text-xs">{employee.employee_id}</span>
      </TableCell>
      <TableCell className="w-40 px-3 text-sm text-blue-600">
        <span className="truncate block" title={employee.department_name || '-'}>
          {employee.department_name || '-'}
        </span>
      </TableCell>
      <TableCell className="w-36 px-3 text-sm">
        <span className="truncate block" title={employee.job_position_name || '-'}>
          {employee.job_position_name || '-'}
        </span>
      </TableCell>
      <TableCell className="w-32 px-3 text-sm">
        <span className="truncate block" title={employee.job_level_name || '-'}>
          {employee.job_level_name || '-'}
        </span>
      </TableCell>
      <TableCell className="w-40 px-3">
        <Badge className={`${getStatusColor(displayStatus)} text-xs px-2 py-1 border`}>
          {displayStatus}
        </Badge>
      </TableCell>
      <TableCell className="w-36 px-3 text-sm whitespace-nowrap">{formatDate(employee.join_date)}</TableCell>
      <TableCell className="w-36 px-3 text-sm">
        <span className="truncate block" title={employee.mobile_phone || '-'}>
          {employee.mobile_phone || '-'}
        </span>
      </TableCell>
      <TableCell className="w-20 px-3 text-right align-middle">
        <div className="flex justify-end">
          <EmployeeActionsDropdown
            employee={employee}
            userRole={userRole}
            currentUserEmail={currentUserEmail}
            onRefresh={onRefresh}
            onViewDetails={handleViewEmployee}
          />
        </div>
      </TableCell>
    </TableRow>
  );
});

EmployeeRow.displayName = 'EmployeeRow';

export const EmployeeTable = memo(({ 
  employees = [], 
  allEmployees = [],
  currentUserEmail, 
  userRole,
  onRefresh, 
  onViewEmployee,
  isLoading = false,
}: EmployeeTableProps) => {
  useOptimizedPerformanceMonitor('EmployeeTable');
  const { t } = useAppTranslation();

  // Memoize the table headers to prevent re-renders
  const tableHeaders = useMemo(() => [
    { key: 'name', label: 'Employee Name', width: 'w-64' },
    { key: 'manager', label: t('employees.manager.column', 'Direct manager'), width: 'w-52' },
    { key: 'id', label: 'Employee ID', width: 'w-48' },
    { key: 'department', label: 'Department', width: 'w-40' },
    { key: 'position', label: 'Job Position', width: 'w-36' },
    { key: 'level', label: 'Job Level', width: 'w-32' },
    { key: 'status', label: 'Employment Status', width: 'w-40' },
    { key: 'join_date', label: 'Join Date', width: 'w-36' },
    { key: 'phone', label: 'Phone', width: 'w-36' },
    { key: 'actions', label: 'Actions', width: 'w-20' },
  ], [t]);


  const renderEmployeeRows = useMemo(() => (
    employees.map((employee) => (
      <EmployeeRow
        key={employee.id}
        employee={employee}
        allEmployees={allEmployees}
        currentUserEmail={currentUserEmail}
        userRole={userRole}
        onRefresh={onRefresh}
        onViewEmployee={onViewEmployee}
      />
    ))
  ), [employees, allEmployees, currentUserEmail, userRole, onRefresh, onViewEmployee]);

  return (
    <div className="h-full min-w-0 flex flex-col">
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-auto seamless-scroll nested-scroll-touch-chain">
        <table className="w-full caption-bottom text-sm employee-table">
          <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <TableRow className="hover:bg-transparent">
              {tableHeaders.map((header) => (
                <TableHead
                  key={header.key}
                  className={`whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700 ${header.width}`}
                >
                  {header.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center">
                  <div className="flex items-center justify-center">
                    <LoadingDots size="lg" />
                  </div>
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-gray-500">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-lg">👥</div>
                    <div>No employees found</div>
                    <div className="text-xs text-gray-400">Try adjusting your filters or search terms</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              renderEmployeeRows
            )}
          </TableBody>
        </table>
      </div>

      {/* Table Footer */}
      <EmployeeTableFooter 
        totalEmployees={employees.length}
        activeEmployees={countActiveEmployees(employees)}
        filteredEmployees={employees.length}
        selectedDepartment="all"
      />
    </div>
  );
});

EmployeeTable.displayName = 'EmployeeTable';
