// CRM Dashboard Module Exports

// Main Dashboard Component
export { CRMDashboard } from "./components/crm/CRMDashboard";
export { CRMDashboardContent } from "./components/crm/CRMDashboardContent";
export { CRMDashboardPage } from "./pages/CRMDashboardPage";
export { ConsultantDashboardPage } from "@/5-1-leads-management/pages/ConsultantDashboardPage";
export { HeaderAndTab } from "./components/layout/HeaderAndTab";
export { ConsultantsPageContent } from "./components/consultants/ConsultantsPageContent";
export { LeadsTableFooter } from "./components/leads/table/LeadsTableFooter";
export { LeadsSidebarFooter } from "./components/leads/table/LeadsSidebarFooter";

// Leads Tables and Views
export { LeadsTable } from "./components/leads/table/LeadsTable";
export { default as LeadsTableNew } from "./components/leads/table/LeadsTableNew";
export { LeadsTableViewContent } from "./components/leads/table/LeadsTableViewContent";

// Leads Filters and Metrics
export { LeadsFilters } from "./components/leads/filters/LeadsFilters";
export { LeadsMetricsCards } from "./components/leads/metrics/LeadsMetricsCards";
export { LeadsInsights } from "./components/leads/metrics/LeadsInsights";
export { generateLeadsPDF } from "./lib/LeadsPDFGenerator";

// Lead Forms and Dialogs
export { LeadForm } from "./components/leads/forms/LeadForm";
export { NewLeadForm } from "./components/leads/forms/NewLeadForm";
export { LeadDetail } from "./components/leads/forms/LeadDetail";
export { EditLeadDialog } from "./components/leads/dialogs/EditLeadDialog";
export { ViewLeadDialog } from "./components/leads/dialogs/ViewLeadDialog";
export { LeadFollowUpForm } from "./components/leads/forms/LeadFollowUpForm";
export { LeadActionsDropdown } from "./components/leads/actions/LeadActionsDropdown";
export { LeadStatusHistoryDialog } from "./components/leads/dialogs/LeadStatusHistoryDialog";
