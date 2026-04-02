# Company Dashboard Module

This module contains all components related to the Company pages (`/company/*`).

## Structure

```
2_8_dashboard/
├── CompanyProfileDashboard.tsx    # Main dashboard component
├── CompanyAssetsPage.tsx          # Assets management page
├── CompanyFilesPage.tsx           # Files management page
├── CompanyOrganizationPage.tsx    # Organization chart page
│
├── Dashboard Components/
│   ├── CompanyProfileHeader.tsx
│   ├── CompanyBasicInfo.tsx
│   ├── CompanyMissionVision.tsx
│   ├── CompanyDepartments.tsx
│   ├── CompanyValues.tsx
│   └── CompanyProfilePhoto.tsx
│
├── Assets Components/
│   ├── AssetsTable.tsx
│   ├── AssetsFilters.tsx
│   ├── CompanyAssetsMetricsCards.tsx
│   ├── AddAssetModal.tsx
│   ├── EditAssetModal.tsx
│   ├── ViewAssetModal.tsx
│   └── asset-details/
│       ├── AssetBasicInfo.tsx
│       ├── AssetCreatedDate.tsx
│       ├── AssetIdentifiers.tsx
│       ├── AssetImage.tsx
│       ├── AssetNotes.tsx
│       ├── AssetPurchaseInfo.tsx
│       ├── AssetStatusCondition.tsx
│       └── AssetStatusUtils.tsx
│   └── assets-table/
│       ├── AssetRow.tsx
│       ├── AssetsEmptyState.tsx
│       ├── AssetsTableHeader.tsx
│       ├── DeleteAssetDialog.tsx
│       └── useAssetFilters.ts
│
├── Files Components/
│   ├── CompanyFilesTable.tsx
│   ├── CompanyFilesFilters.tsx
│   ├── CompanyFilesMetricsCards.tsx
│   ├── CompanyFilesOverview.tsx
│   └── files/
│       ├── FileDeleteDialog.tsx
│       ├── FileEditModal.tsx
│       ├── FilePreviewModal.tsx
│       ├── FileTable.tsx
│       └── FileUploadModal.tsx
│
├── Organization Components/
│   └── organization/
│       ├── OrganizationalChart.tsx
│       ├── OrganizationalDiagram.tsx
│       └── OrganizationStatistics.tsx
│
├── Modals/
│   └── EditCompanyModal.tsx
│
├── hooks/
│   ├── useCompanyFiles.ts
│   ├── useCompanyLogo.ts
│   ├── useCompanyObjectives.ts
│   ├── useCompanyProfile.ts
│   └── useCompanyValues.ts
│
├── index.ts                       # Module exports
└── README.md                      # This file
```

## Components

### CompanyProfileDashboard
Main dashboard showing company profile with:
- Company header with logo
- Basic info (name, industry, website, email, phone)
- Mission & Vision statements
- Departments list
- Company values

**Props:** None (uses hooks for data)

### CompanyAssetsPage
Asset management page with:
- Metrics cards (Total Assets, Active, Under Maintenance, Retired)
- Filters (search, status, category, location)
- Assets table with CRUD operations

**Features:**
- Add/Edit/View/Delete assets
- Asset details with image, purchase info, identifiers
- Status tracking (Active, Under Maintenance, Retired, Disposed)

### CompanyFilesPage
Document management page with:
- Metrics cards (Total Files, Storage Used, Recent Uploads)
- Filters (search, type, date)
- Files table with preview/download
- File upload functionality

**Features:**
- Upload/Edit/Delete files
- File preview modal
- Storage tracking
- File type categorization

### CompanyOrganizationPage
Organization structure page with:
- Organizational chart visualization
- Department hierarchy
- Employee statistics by department

**Features:**
- Interactive org chart
- Department drill-down
- Employee count per department

## Hooks

### useCompanyProfile
Fetches company profile data from `organizations` table.

**Returns:**
- `data`: Company profile data
- `isLoading`: Loading state
- `error`: Error state

### useCompanyLogo
Manages company logo upload and retrieval.

**Returns:**
- `logoUrl`: Current logo URL
- `updateLogo`: Function to update logo
- `isUpdating`: Update loading state

### useCompanyFiles
Manages company files CRUD operations.

**Returns:**
- `files`: List of files
- `uploadFile`: Upload function
- `deleteFile`: Delete function
- `updateFile`: Update function

### useCompanyValues
Manages company values data.

**Returns:**
- `values`: Company values array
- `addValue`: Add value function
- `updateValue`: Update value function
- `deleteValue`: Delete value function

### useCompanyObjectives
Fetches company-level OKR objectives.

**Returns:**
- `objectives`: Company objectives
- `isLoading`: Loading state

## Usage

```tsx
import { 
  CompanyProfileDashboard,
  CompanyAssetsPage,
  CompanyFilesPage,
  CompanyOrganizationPage 
} from '@/components/1_halaman/2_8_dashboard';

// In Company.tsx
<TabsContent value="dashboard">
  <CompanyProfileDashboard />
</TabsContent>

<TabsContent value="assets">
  <CompanyAssetsPage />
</TabsContent>

<TabsContent value="files">
  <CompanyFilesPage />
</TabsContent>

<TabsContent value="organization">
  <CompanyOrganizationPage />
</TabsContent>
```

## Integration Points

- **Routing:** Tabs at `/company/dashboard`, `/company/assets`, `/company/files`, `/company/organization`
- **Database:** Uses `organizations`, `company_assets`, `company_files` tables
- **Storage:** Uses Supabase Storage for logos and files
- **Permissions:** Integrates with `useDepartmentAccess` for tab access control

## Database Schema

### organizations table
- Basic company info (name, industry, website, email, phone)
- Mission & vision
- Logo URL
- Created/updated timestamps

### company_assets table
- Asset details (name, category, status, condition)
- Purchase info (date, cost, supplier)
- Identifiers (serial number, asset tag)
- Location, notes
- Image URL

### company_files table
- File metadata (name, type, size)
- Storage path
- Upload date, uploader
- Category, tags

## Future Enhancements

- [ ] Add company history timeline
- [ ] Add company policies section
- [ ] Add company certifications
- [ ] Add asset maintenance scheduling
- [ ] Add file versioning
- [ ] Add file sharing/permissions
- [ ] Add org chart export (PDF/PNG)
- [ ] Add department budget tracking



