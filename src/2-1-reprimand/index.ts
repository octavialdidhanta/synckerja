/**
 * Reprimand Management Module
 *
 * Disciplinary / reprimand records for employees (org-scoped, HR/Admin/Owner route guard).
 */

export { ReprimandManagementPage } from "./pages/ReprimandManagementPage";

export { AddReprimandDialog } from "./components/AddReprimandDialog";
export { default as ReprimandDepartmentCard } from "./components/ReprimandDepartmentCard";
export { default as ReprimandTableFooter } from "./components/ReprimandTableFooter";
export { default as ReprimandViewDropdown } from "./components/ReprimandViewDropdown";

export { useReprimands, useCreateReprimand } from "./hooks/useReprimands";
export { useEmployees } from "./hooks/useEmployees";
