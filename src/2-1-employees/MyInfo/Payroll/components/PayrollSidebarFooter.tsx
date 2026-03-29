import { User, DollarSign } from 'lucide-react';

interface PayrollSidebarFooterProps {
  employeeName: string;
  monthlySalary: number;
}

export const PayrollSidebarFooter = ({ 
  employeeName, 
  monthlySalary 
}: PayrollSidebarFooterProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1 truncate">
          <User className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{employeeName}</span>
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
          <DollarSign className="h-3 w-3" />
          <span className="truncate">{formatCurrency(monthlySalary)}</span>
        </span>
      </div>
    </div>
  );
};

