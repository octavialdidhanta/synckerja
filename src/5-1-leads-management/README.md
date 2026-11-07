# Leads Management Module

This module handles leads management functionality for the consultant system.

## Folder layout

- **`pages/`** — Route-level screens (e.g. consultant leads management page).
- **`components/`** — `LeadStatusSelect` only. Leads table, filters, dialogs and forms live in `@/5-3-dashboard/components/leads`.
- **`utils/`** — Pure helpers (`leadStatusDisplay`, follow-up priority logic).
- **`skeletons/`** — Loading shells aligned with the page layout.

Public exports stay available from `index.ts` at the module root.

## Components

- **LeadStatusSelect** — lead status picker (shared by inbox and leads UI).

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

