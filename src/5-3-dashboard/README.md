# Leads Management Module

This module handles leads management functionality for the consultant system.

## Components

### Leads Tables and Views
- **LeadsTable** - Main leads table component
- **LeadsTableNew** - Enhanced leads table with advanced features
- **LeadsTableViewContent** - Table view content wrapper for leads

### Leads Filters and Metrics
- **LeadsFilters** - Filters for leads data
- **LeadsMetricsCards** - Key metrics display for leads
- **LeadsInsights** - Insights and analytics for leads
- **generateLeadsPDF** - PDF generation function for leads

### Lead Forms and Dialogs
- **LeadForm** - Form for creating/editing leads
- **NewLeadForm** - Form for creating new leads
- **LeadDetail** - Detailed view of a lead
- **EditLeadDialog** - Dialog for editing leads
- **ViewLeadDialog** - Dialog for viewing lead details
- **LeadFollowUpForm** - Form for lead follow-ups
- **LeadActionsDropdown** - Actions dropdown for leads
- **LeadStatusHistoryDialog** - Dialog showing lead status history

## Usage

This module is used in the `/operations/consultant/leads` route and provides comprehensive leads management functionality including:

- Lead creation and editing
- Lead status tracking
- Follow-up management
- Lead analytics and insights
- PDF export functionality
- Advanced filtering and search

## Dependencies

- Uses shared UI components from the design system
- Integrates with leads data management
- Supports PDF generation and export functionality
- Includes advanced table features and filtering

