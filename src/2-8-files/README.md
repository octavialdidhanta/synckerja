# Company Files Module

This module contains all components related to the Company Files page (`/company/files`).

## Structure

```
2_8_files/
├── CompanyFilesPage.tsx           # Main files page
├── CompanyFilesTable.tsx          # Files table display
├── CompanyFilesFilters.tsx        # Filter controls
├── CompanyFilesMetricsCards.tsx   # Metrics cards
├── CompanyFilesOverview.tsx       # Files overview sidebar
│
├── files/                         # File modals
│   ├── FileUploadModal.tsx        # Upload new files
│   ├── FilePreviewModal.tsx       # Preview files
│   ├── FileEditModal.tsx          # Edit file metadata
│   ├── FileDeleteDialog.tsx       # Delete confirmation
│   └── FileTable.tsx              # File table component
│
├── useCompanyFiles.ts             # Files hook
├── index.ts                       # Module exports
└── README.md                      # This file
```

## Components

### CompanyFilesPage
Main page component for file management.

**Features:**
- Metrics cards showing total files, storage used, recent uploads
- Filters for search, file type, date range
- Files table with CRUD operations
- File preview, download, and delete

### CompanyFilesTable
Table component displaying all company files.

**Features:**
- File name with icon (based on type)
- File type badge
- File size
- Upload date and uploader
- Visibility badge (Public, Internal, Private)
- Actions dropdown (View, Edit, Delete)
- Empty state when no files

### CompanyFilesFilters
Filter controls for file list.

**Features:**
- Search by file name
- File type filter (All, Documents, Images, Spreadsheets, Presentations, Others)
- Date range filter
- Category filter
- Clear all filters button

### CompanyFilesMetricsCards
Metrics cards showing file statistics.

**Metrics:**
- Total Files
- Total Storage Used (GB/MB)
- Recent Uploads (last 7 days)
- File Types breakdown

### CompanyFilesOverview
Sidebar overview component.

**Features:**
- Recent uploads list
- Storage usage chart
- Quick file type statistics
- Upload trends

### FileUploadModal
Modal for uploading new files.

**Features:**
- Drag and drop file upload
- Multiple file selection
- File metadata input (category, visibility, tags)
- Upload progress indicator
- File size validation
- File type validation

### FilePreviewModal
Modal for previewing files.

**Features:**
- Image preview (jpg, png, gif, etc.)
- PDF preview (embedded viewer)
- Document preview (limited)
- Download button
- File metadata display
- Share link generation

### FileEditModal
Modal for editing file metadata.

**Features:**
- Update file name
- Change category
- Modify visibility
- Update tags
- Change description

### FileDeleteDialog
Confirmation dialog for file deletion.

**Features:**
- Warning message
- File info display
- Confirm/Cancel actions
- Permanent deletion notice

## File Types

### Supported Types
- **Documents**: PDF, DOC, DOCX, TXT, RTF
- **Images**: JPG, PNG, GIF, SVG, WEBP
- **Spreadsheets**: XLS, XLSX, CSV
- **Presentations**: PPT, PPTX
- **Others**: ZIP, RAR, MP4, etc.

### File Visibility

- **Public**: Accessible by anyone with link
- **Internal**: Accessible by organization members
- **Private**: Accessible only by owner and admins

### File Categories

- **Contracts**: Legal documents, agreements
- **Policies**: Company policies, procedures
- **Reports**: Monthly, quarterly reports
- **Marketing**: Marketing materials, branding
- **HR**: HR documents, forms
- **Finance**: Financial documents, invoices
- **Others**: Miscellaneous files

## Hooks

### useCompanyFiles
Manages company files CRUD operations.

**Returns:**
- `files`: Array of company files
- `isLoading`: Loading state
- `uploadFile`: Function to upload file
- `deleteFile`: Function to delete file
- `updateFile`: Function to update file metadata
- `downloadFile`: Function to download file
- `isDeleting`: Delete loading state
- `isUpdating`: Update loading state

**Usage:**
```tsx
const {
  files,
  isLoading,
  uploadFile,
  deleteFile,
  updateFile,
  downloadFile
} = useCompanyFiles();
```

## Usage

```tsx
import { CompanyFilesPage } from '@/components/1_halaman/2_8_files';

// In Company.tsx
<TabsContent value="files">
  <CompanyFilesPage />
</TabsContent>
```

## Database Schema

### company_files table
- `id`: UUID primary key
- `organization_id`: UUID foreign key
- `file_name`: Original file name
- `file_type`: MIME type
- `file_size`: Size in bytes
- `storage_path`: Supabase storage path
- `category`: File category
- `visibility`: Access level (public, internal, private)
- `tags`: Array of tags
- `description`: File description
- `uploaded_by`: User ID
- `created_at`, `updated_at`: Timestamps

## Storage

### Supabase Storage Buckets
- **Bucket**: `company-files`
- **Path structure**: `{organization_id}/{file_id}/{filename}`
- **Public access**: Based on visibility setting
- **Max file size**: 50MB (configurable)

## Integration Points

- **Routing:** `/company/files`
- **Database:** `company_files` table
- **Storage:** Supabase Storage bucket `company-files`
- **Permissions:** Requires access to company files page
- **Toast notifications:** Success/error messages for operations

## Future Enhancements

- [ ] File versioning
- [ ] File sharing with external users
- [ ] Folder organization
- [ ] Advanced search (content search)
- [ ] File comments/annotations
- [ ] File approval workflow
- [ ] File expiration dates
- [ ] Batch file operations
- [ ] File conversion (PDF, etc.)
- [ ] File compression
- [ ] File analytics (views, downloads)
- [ ] Integration with Google Drive/Dropbox



