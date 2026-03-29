
import { OkrPeriodType, OkrCycle } from '@/types/okr';

export const generateOKRCycleName = (
  year: number,
  periodType: OkrPeriodType,
  quarter?: string
): string => {
  switch (periodType) {
    case 'yearly':
      return `${year} - Yearly`;
    case 'half_yearly':
      const halfYear = new Date().getMonth() < 6 ? 'H1' : 'H2';
      return `${year} - ${halfYear}`;
    case 'quarterly':
      return `${year} - ${quarter}`;
    default:
      return `${year} - ${periodType}`;
  }
};

export const calculateDateRange = (
  year: number,
  periodType: OkrPeriodType,
  quarter?: string
) => {
  const startDate = new Date(year, 0, 1);
  let endDate = new Date(year, 11, 31);

  switch (periodType) {
    case 'half_yearly':
      const isFirstHalf = new Date().getMonth() < 6;
      if (isFirstHalf) {
        endDate = new Date(year, 5, 30);
      } else {
        startDate.setMonth(6);
        endDate = new Date(year, 11, 31);
      }
      break;
    case 'quarterly':
      if (quarter) {
        const quarterNum = parseInt(quarter.replace('Q', ''));
        const startMonth = (quarterNum - 1) * 3;
        const endMonth = startMonth + 2;
        startDate.setMonth(startMonth);
        endDate = new Date(year, endMonth + 1, 0);
      }
      break;
  }

  return {
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  };
};

export const getCurrentActiveCycle = (cycles: OkrCycle[]): OkrCycle | undefined => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Find cycle that matches current period
  return cycles.find(cycle => {
    if (cycle.year !== currentYear) return false;
    
    const startDate = new Date(cycle.start_date);
    const endDate = new Date(cycle.end_date);
    
    return now >= startDate && now <= endDate;
  }) || cycles.find(cycle => cycle.is_active && cycle.year === currentYear);
};

export const getDefaultCycleForCurrentPeriod = (cycles: OkrCycle[]): string => {
  const currentCycle = getCurrentActiveCycle(cycles);
  if (currentCycle?.id) {
    return currentCycle.id;
  }
  // Fallback to first available cycle (most recent)
  if (cycles.length > 0) {
    return cycles[0].id;
  }
  return '';
};
