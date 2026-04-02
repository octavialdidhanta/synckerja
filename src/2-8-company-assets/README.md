# Company Assets Module

This module contains all components related to the Company Assets page (`/company/assets`).

## Structure

```
2_8_assets/
├── CompanyAssetsPage.tsx          # Main assets page
├── AssetsTable.tsx                # Assets table display
├── AssetsFilters.tsx              # Filter controls
├── CompanyAssetsMetricsCards.tsx  # Metrics cards
│
├── Modals/
│   ├── AddAssetModal.tsx          # Add new asset
│   ├── EditAssetModal.tsx         # Edit existing asset
│   └── ViewAssetModal.tsx         # View asset details
│
├── asset-details/                 # Asset detail components
│   ├── AssetBasicInfo.tsx
│   ├── AssetCreatedDate.tsx
│   ├── AssetIdentifiers.tsx
│   ├── AssetImage.tsx
│   ├── AssetNotes.tsx
│   ├── AssetPurchaseInfo.tsx
│   ├── AssetStatusCondition.tsx
│   └── AssetStatusUtils.tsx
│
├── assets-table/                  # Table sub-components
│   ├── AssetRow.tsx
│   ├── AssetsEmptyState.tsx
│   ├── AssetsTableHeader.tsx
│   ├── DeleteAssetDialog.tsx
│   └── useAssetFilters.ts
│
├── index.ts                       # Module exports
└── README.md                      # This file
```

## Components

### CompanyAssetsPage
Main page component for asset management.

**Features:**
- Metrics cards showing total assets, active, under maintenance, retired
- Filters for search, status, category, location
- Assets table with CRUD operations
- Asset details modal

### AssetsTable
Table component displaying all company assets.

**Features:**
- Asset name and category
- Status badges (Active, Under Maintenance, Retired, Disposed)
- Purchase info (date, cost)
- Location
- Actions dropdown (View, Edit, Delete)
- Empty state when no assets

### AssetsFilters
Filter controls for asset list.

**Features:**
- Search by name or asset tag
- Status filter (All, Active, Under Maintenance, Retired, Disposed)
- Category filter (All, Electronics, Furniture, Vehicles, Equipment, Others)
- Location filter (All locations)
- Clear all filters button

### CompanyAssetsMetricsCards
Metrics cards showing asset statistics.

**Metrics:**
- Total Assets
- Active Assets
- Under Maintenance
- Retired Assets

### AddAssetModal
Modal for adding new assets.

**Fields:**
- Basic Info: Name, Category, Status, Condition
- Purchase Info: Date, Cost, Supplier
- Identifiers: Serial Number, Asset Tag
- Location
- Image upload
- Notes

### EditAssetModal
Modal for editing existing assets.

**Features:**
- Pre-filled form with current data
- Same fields as Add modal
- Update functionality

### ViewAssetModal
Modal for viewing asset details.

**Sections:**
- Asset image
- Basic information
- Purchase information
- Identifiers
- Status and condition
- Notes
- Created date

## Asset Status

- **Active**: Asset is in use
- **Under Maintenance**: Asset is being serviced
- **Retired**: Asset is no longer in use
- **Disposed**: Asset has been disposed

## Asset Conditions

- **Excellent**: Like new condition
- **Good**: Minor wear, fully functional
- **Fair**: Some wear, functional
- **Poor**: Significant wear, limited functionality
- **Damaged**: Not functional, needs repair

## Asset Categories

- **Electronics**: Computers, phones, etc.
- **Furniture**: Desks, chairs, etc.
- **Vehicles**: Cars, bikes, etc.
- **Equipment**: Tools, machinery, etc.
- **Others**: Miscellaneous assets

## Usage

```tsx
import { CompanyAssetsPage } from '@/components/1_halaman/2_8_assets';

// In Company.tsx
<TabsContent value="assets">
  <CompanyAssetsPage />
</TabsContent>
```

## Database Schema

### company_assets table
- `id`: UUID primary key
- `organization_id`: UUID foreign key
- `name`: Asset name
- `category`: Asset category
- `status`: Asset status (active, under_maintenance, retired, disposed)
- `condition`: Asset condition (excellent, good, fair, poor, damaged)
- `purchase_date`: Date asset was purchased
- `purchase_cost`: Purchase price
- `supplier`: Supplier name
- `serial_number`: Serial/model number
- `asset_tag`: Internal asset tag
- `location`: Physical location
- `image_url`: Asset image URL
- `notes`: Additional notes
- `created_at`, `updated_at`: Timestamps

## Integration Points

- **Routing:** `/company/assets`
- **Database:** `company_assets` table
- **Storage:** Supabase Storage for asset images
- **Permissions:** Requires access to company assets page

## Future Enhancements

- [ ] Asset maintenance scheduling
- [ ] Asset depreciation tracking
- [ ] Asset assignment to employees
- [ ] Asset transfer history
- [ ] Barcode/QR code generation
- [ ] Asset audit trail
- [ ] Export assets to CSV/PDF
- [ ] Bulk asset upload
- [ ] Asset warranty tracking
- [ ] Insurance information



