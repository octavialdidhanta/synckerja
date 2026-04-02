// Main Dashboard Page (Route Component)
export { CompanyDashboardPage, default as CompanyDashboardPageDefault } from './pages/CompanyDashboardPage';

// Main Dashboard Component
export { CompanyProfileDashboard } from './pages/CompanyProfileDashboard';

// Section Components (Header and Tabs) - NOT exporting HeaderAndTab to prevent shared usage
// Each tab must use their own HeaderAndTab component
// export * from './section';

// Dashboard Components
export * from './components';

// Hooks
export * from './hooks';

// Route / page skeletons (shared with company sub-routes)
export * from './skeletons';

// Utils (for files feature)
export * from './utils/fileTypes';
export * from './utils/fileValidation';

