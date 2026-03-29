# Application Form Components

This directory contains components related to job application and candidate profile management functionality.

## Main Components

### Wizard Components
- **CandidateProfileWizard**: Main wizard component for multi-step candidate profile completion
- **ApplicationForm**: Alias for CandidateProfileWizard (main export)

### Tab Components
- **CandidateInfoTabs**: Basic candidate information tabs
- **CandidateProfileTabs**: Advanced candidate profile tabs with sidebar
- **CandidateProfileSidebar**: Sidebar component for candidate profile navigation

### Tab Content Components
- **PersonalDetailsTab**: Personal information form
- **EducationTab**: Education history form
- **WorkExperienceTab**: Work experience form
- **FamilyMembersTab**: Family members information
- **DocumentsTab**: Document upload and management
- **DocumentsTabNew**: New document upload interface
- **InformalEducationTab**: Informal education and certifications
- **CandidateReviewsTab**: Candidate reviews and feedback

### Section Components
- **PersonalInfoSection**: Personal information section
- **AddressInfoSection**: Address information section
- **EmploymentInfoSection**: Employment information section
- **CVUploadSection**: CV/resume upload section

### Form Components
- **FamilyMemberForm**: Family member form component
- **WorkExperienceForm**: Work experience form component

### Success Component
- **ApplicationSuccess**: Application submission success page

## Services

### Data Services
- **applicationDataService**: Handles application data operations
- **counterService**: Manages application counters and statistics
- **fileUploadService**: Handles file upload operations

## Hooks

- **useApplicationSubmission**: Custom hook for application submission logic

## Utils

- **fileValidation**: File validation utilities
- **stepValidation**: Step-by-step form validation utilities

## Types

- **types.ts**: TypeScript type definitions for application forms

## Usage

These components are used in:
- **Pages**: `src/pages/JobApplication.tsx`, `src/pages/CandidateProfile.tsx`
- **Routes**: `/job-application/:token`, `/candidate/profile/:token`

## Features

- **Multi-step Wizard**: 7-step candidate profile completion process
- **Form Validation**: Real-time validation with step-by-step progression
- **File Upload**: Support for CV, documents, and photo uploads
- **Responsive Design**: Mobile-friendly interface
- **Progress Tracking**: Visual progress indicators
- **Data Persistence**: Automatic save and resume functionality
- **Success Handling**: Application submission confirmation

## Integration Points

- Uses Supabase for data storage and file uploads
- Integrates with recruitment system for job applications
- Supports both public and internal candidate profile management
- Includes comprehensive form validation and error handling
