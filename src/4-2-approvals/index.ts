// Main Page
export { ApprovalsPage } from './pages/ApprovalsPage';
export { ApprovalRequestsPage } from './pages/ApprovalRequestsPage';

// Table
export { ApprovalRequestsTable } from './section/ApprovalRequestsTable';

// Filters
export { ApprovalFilters, type ApprovalFiltersType } from './section/ApprovalFilters';
export { ApprovalRequestsFilters } from './section/ApprovalRequestsFilters';

// Metrics Cards
export { ApprovalMetricsCards } from './section/ApprovalMetricsCards';
export { ApprovalRequestsMetricsCards } from './section/ApprovalRequestsMetricsCards';

// Overview
export { RecentApprovalsOverview } from './components/RecentApprovalsOverview';

// Dropdowns
export { ApprovalActionsDropdown } from './components/ApprovalActionsDropdown';
export { ActionsDropdown } from './components/ActionsDropdown';

// Modals
export { PurchaseRequestDetailsModal } from './components/PurchaseRequestDetailsModal';

// Re-export hooks from dashboard for convenience
export { useExpenses, useExpenseMetrics } from '@/shared/hooks/finance';

