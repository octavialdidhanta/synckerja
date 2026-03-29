import React from 'react';
import { formatToRupiah } from '../utils/formatCurrency';
import { useAttendancePenaltyTotal } from '../hooks/useAttendancePenaltyTotal';

interface EmployeePenaltyCellProps {
  employeeId: string;
  month: number;
  year: number;
  fallbackAmount?: number;
}

export const EmployeePenaltyCell: React.FC<EmployeePenaltyCellProps> = ({
  employeeId,
  month,
  year,
  fallbackAmount = 0
}) => {
  const { data: totalPenalty = 0, isLoading } = useAttendancePenaltyTotal(employeeId, month, year);

  if (isLoading) {
    return (
      <td className="text-center p-2 font-medium text-sm border border-gray-200 bg-slate-50 text-gray-400">
        <div className="animate-pulse">...</div>
      </td>
    );
  }

  const displayAmount = totalPenalty > 0 ? totalPenalty : fallbackAmount;

  return (
    <td className="text-center p-2 font-medium text-sm border border-gray-200 bg-slate-50 text-red-600">
      {displayAmount > 0 ? formatToRupiah(displayAmount) : '-'}
    </td>
  );
};
