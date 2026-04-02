# Create Organization Components

This directory contains components related to organization creation and management functionality.

## Main Components

### CreateOrganizationModal
- **Purpose**: Modal dialog for creating new organizations
- **Features**:
  - Modal interface with organization creation form
  - Success callback handling
  - Close functionality
  - Responsive design

### OrganizationForm
- **Purpose**: Main form component for organization creation
- **Features**:
  - Multi-step form with basic and additional information
  - Form validation and submission
  - Progress tracking
  - Success callback handling
  - Integration with organization creation hooks

### BasicInfoFields
- **Purpose**: Form fields for basic organization information
- **Features**:
  - Company name input
  - Industry selection dropdown
  - Company size selection
  - Form validation
  - Loading state handling

### AdditionalInfoFields
- **Purpose**: Form fields for additional organization information
- **Features**:
  - Address textarea
  - Phone number input
  - Website input
  - Description textarea
  - Terms acceptance checkbox

## Supporting Files

### Types
- **OrganizationFormData**: Interface for organization form data
- **initialFormData**: Default form values

### Constants
- **INDUSTRIES**: List of available industries
- **COMPANY_SIZES**: List of company size options

### Validation
- **validateFormData**: Form validation functions
- **validateOrganizationForm**: Organization-specific validation

## Features

### Form Management
- **Multi-step Interface**: Basic info and additional info sections
- **Form Validation**: Comprehensive validation for all fields
- **Loading States**: Proper loading state management
- **Error Handling**: User-friendly error messages
- **Progress Tracking**: Visual progress indicators

### Data Collection
- **Company Information**: Name, industry, size
- **Contact Details**: Address, phone, website
- **Additional Details**: Description and terms acceptance
- **Validation**: Required field validation and data format checking

### User Experience
- **Responsive Design**: Works on all screen sizes
- **Modal Interface**: Clean modal dialog for organization creation
- **Form Persistence**: Maintains form state during editing
- **Success Handling**: Proper success callbacks and navigation

## Usage

These components are used in:
- **Pages**: `src/pages/CreateOrganization.tsx`, `src/pages/EmployeeWelcome.tsx`
- **Components**: `src/components/OrganizationSwitcher.tsx`, `src/components/layouts/MainHeader.tsx`
- **Employee Management**: `src/pages/AddEmployee.tsx`

## Integration Points

- **Organization Creation**: Uses `useOrganizationCreation` hook
- **Form Validation**: Integrates with validation utilities
- **Modal Management**: Uses UI dialog components
- **Navigation**: Handles success callbacks and navigation
- **Data Persistence**: Saves organization data to database

## Data Flow

1. **CreateOrganizationModal** provides the modal interface
2. **OrganizationForm** manages the form state and submission
3. **BasicInfoFields** collects basic organization information
4. **AdditionalInfoFields** collects additional details
5. **Validation** ensures data integrity
6. **Hooks** handle data persistence and API calls

## Form Fields

### Basic Information
- **Company Name** (required)
- **Industry** (dropdown selection)
- **Company Size** (dropdown selection)

### Additional Information
- **Address** (required, textarea)
- **Phone Number** (input)
- **Website** (input)
- **Description** (textarea)
- **Terms Acceptance** (checkbox, required)

## Validation Rules

- **Required Fields**: Company name, industry, company size, address
- **Data Format**: Phone number format, website URL format
- **Terms Acceptance**: Must be checked to proceed
- **Length Limits**: Appropriate character limits for all fields

## Technical Details

- **State Management**: React useState for form state
- **Form Handling**: Controlled components with proper event handling
- **Validation**: Client-side validation with error messages
- **Loading States**: Proper loading state management
- **Error Handling**: User-friendly error messages and recovery
- **Responsive Design**: Mobile-first responsive design
- **Accessibility**: Proper ARIA labels and keyboard navigation
