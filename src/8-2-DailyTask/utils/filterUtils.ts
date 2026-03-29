import { RecentStepUpdate, RecentStepFilters } from '../types/taskTypes';

/**
 * Filter recent step updates based on current filters
 */
export const filterRecentStepUpdates = (
  updates: RecentStepUpdate[],
  filters: RecentStepFilters
): RecentStepUpdate[] => {
  let filtered = [...updates];

  // Filter by action type
  if (filters.actionType !== 'all') {
    filtered = filtered.filter(update => update.action === filters.actionType);
  }

  // Filter by date range
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  filtered = filtered.filter(update => {
    const updateDate = new Date(update.updated_at);

    switch (filters.dateRange) {
      case 'today':
        return updateDate >= today;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return updateDate >= yesterday && updateDate < today;
      case 'this_week':
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return updateDate >= weekStart;
      case 'this_month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return updateDate >= monthStart;
      case 'last_month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        return updateDate >= lastMonthStart && updateDate < lastMonthEnd;
      case 'custom':
        if (filters.customStartDate && filters.customEndDate) {
          const startDate = new Date(filters.customStartDate);
          const endDate = new Date(filters.customEndDate);
          endDate.setHours(23, 59, 59, 999); // Include the entire end date
          return updateDate >= startDate && updateDate <= endDate;
        }
        return true;
      default:
        return true;
    }
  });

  return filtered;
};

