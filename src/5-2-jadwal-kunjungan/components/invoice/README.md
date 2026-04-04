# Invoice Components

This directory contains components related to invoice generation and management functionality for sales activities.

## Main Components

### CreateTemplateDialog
- **Purpose**: Dialog for creating new invoice templates
- **Features**:
  - Template name input
  - Company information (name, phone, email, address)
  - Invoice description/notes
  - Form validation and submission
  - Integration with invoice template hooks

### InvoicePreviewModal
- **Purpose**: Comprehensive invoice preview and customization modal
- **Features**:
  - Real-time PDF preview generation
  - Template selection and management
  - Client information editing
  - Invoice details customization
  - Item management (add, edit, remove)
  - Payment information display
  - Download functionality
  - Template creation integration

## Features

### CreateTemplateDialog
- **Form Fields**:
  - Template Name (required)
  - Company Name
  - Company Phone
  - Company Email
  - Company Address
  - Invoice Description/Notes
- **Validation**: Required field validation
- **State Management**: Form state with reset functionality
- **Integration**: Uses `useInvoiceTemplate` hook

### InvoicePreviewModal
- **Template Management**:
  - Load existing templates
  - Create new templates
  - Auto-save template changes
  - Template selection dropdown
- **Invoice Customization**:
  - Client information editing
  - Invoice number and dates
  - Item details management
  - Payment information display
- **Preview System**:
  - Real-time PDF generation
  - Debounced preview updates
  - Company logo integration
  - Responsive preview iframe
- **Payment Integration**:
  - Current payment details
  - Payment summary calculations
  - Previous payments history
  - Remaining balance tracking

## Usage

These components are used in:
- **PaymentUpdateModal**: Invoice generation for sales activities
- **Sales Management**: Invoice creation for client visits
- **Payment Processing**: Invoice preview and download

## Integration Points

- **Sales Activities**: Integrated with sales activity payment system
- **Template System**: Uses invoice template management
- **PDF Generation**: Integrates with InvoiceGenerator service
- **Payment Calculations**: Uses payment calculation utilities
- **Company Branding**: Supports company logo integration

## Data Flow

1. **CreateTemplateDialog** creates and saves invoice templates
2. **InvoicePreviewModal** loads templates and generates invoices
3. **PaymentUpdateModal** uses InvoicePreviewModal for invoice generation
4. **InvoiceGenerator** service creates PDF documents
5. **Download functionality** provides PDF files to users

## Key Features

### Template Management
- Create, load, and manage invoice templates
- Auto-save template changes
- Template selection and switching
- Company information persistence

### Invoice Customization
- Real-time preview updates
- Item management (add, edit, remove)
- Client information editing
- Payment details integration
- Date and number customization

### Payment Integration
- Current payment display
- Payment history tracking
- Remaining balance calculation
- Payment progress visualization
- Multiple payment type support

## Technical Details

- **PDF Generation**: Uses jsPDF for invoice creation
- **Debounced Updates**: Prevents excessive re-renders
- **State Management**: Complex state with multiple data sources
- **Error Handling**: Comprehensive error handling and user feedback
- **Responsive Design**: Adapts to different screen sizes
- **Performance**: Optimized for large datasets and real-time updates
