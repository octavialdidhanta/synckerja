import { DollarSign, TrendingUp } from 'lucide-react';

interface PayrollTableFooterProps {
  currentMonth: string;
  totalSalary: number;
}

export const PayrollTableFooter = ({ 
  currentMonth, 
  totalSalary 
}: PayrollTableFooterProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="px-4 py-1.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          Period: {currentMonth}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Total Salary: {formatCurrency(totalSalary)}
        </span>
      </div>
    </div>
  );
};

