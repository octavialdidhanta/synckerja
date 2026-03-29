# CRUD Implementation for Department Section

## Overview
Mengimplementasikan struktur CRUD (Create, Read, Update, Delete) pada section Department di halaman `/my-info/employment?id={id}` dengan menggunakan CustomDropdown component yang memiliki fungsi Add, Edit, dan Delete.

## Struktur CRUD yang Diimplementasikan

### 1. **Add Button**
```html
<button class="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md h-6 px-2 text-xs" type="button">
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus h-3 w-3 mr-1">
    <path d="M5 12h14"></path>
    <path d="M12 5v14"></path>
  </svg>
  Add
</button>
```

### 2. **CustomDropdown Component**
Mengganti Select biasa dengan CustomDropdown yang memiliki:
- **Header dengan Add Button**: Label + Add button di sebelah kanan
- **Dropdown Trigger**: Menampilkan value yang dipilih dengan chevron down
- **Dropdown Content**: List options dengan action buttons (Edit/Delete)
- **CRUD Operations**: Add, Edit, Delete functionality

## Perubahan yang Dibuat

### 1. **Import Dependencies**
```typescript
import { Button } from '@/features/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/features/ui/dropdown-menu';
import { Briefcase, Plus, ChevronDown, MoreVertical, Edit, Trash2 } from 'lucide-react';
```

### 2. **CustomDropdown Component**
```typescript
const CustomDropdown = ({ 
  label, 
  value, 
  onChange, 
  options, 
  isLoading, 
  onAdd, 
  onEdit, 
  onDelete, 
  placeholder,
  disabled 
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string; isDefault?: boolean }>;
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (item: { id: string; name: string; isDefault?: boolean }) => void;
  onDelete: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
}) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <label className="block text-sm font-medium">{label} <span className="text-red-500">*</span></label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        className="h-6 px-2 text-xs"
        disabled={disabled}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add
      </Button>
    </div>
    
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between text-sm h-10 px-3"
          disabled={isLoading || disabled}
        >
          <span className="truncate">
            {isLoading 
              ? "Loading..." 
              : value 
              ? options.find(opt => opt.id === value)?.name || placeholder
              : placeholder
            }
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full min-w-[var(--radix-dropdown-menu-trigger-width)] bg-white border shadow-md">
        {!isLoading && options.map((option) => (
          <div key={option.id} className="flex items-center">
            <DropdownMenuItem
              onClick={() => onChange(option.id)}
              className="flex-1 cursor-pointer text-xs py-2 px-3"
            >
              {option.name}
              {option.isDefault && " (Default)"}
            </DropdownMenuItem>
            {!option.isDefault && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 mx-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border shadow-md">
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(option);
                    }}
                    className="text-xs"
                  >
                    <Edit className="h-3 w-3 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(option.id);
                    }}
                    className="text-red-600 text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
        {!isLoading && options.length === 0 && (
          <DropdownMenuItem disabled className="text-xs text-gray-500">
            No options available
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
```

### 3. **Department Section Replacement**
```typescript
// Sebelum (Select biasa)
<div className="space-y-2">
  <Label htmlFor="department_id">Department <span className="text-red-500">*</span></Label>
  <Select
    value={formData.department_id}
    onValueChange={(value) => handleInputChange('department_id', value)}
    disabled={!isEditMode || isSaving}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select department" />
    </SelectTrigger>
    <SelectContent>
      {departmentsCrud.data?.map((dept) => (
        <SelectItem key={dept.id} value={dept.id}>
          {dept.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

// Sesudah (CustomDropdown dengan CRUD)
<CustomDropdown
  label="Department"
  value={formData.department_id}
  onChange={(value) => handleInputChange('department_id', value)}
  options={departmentsCrud.data || []}
  isLoading={departmentsCrud.isLoading}
  onAdd={departmentsCrud.openAddModal}
  onEdit={departmentsCrud.openEditModal}
  onDelete={departmentsCrud.deleteItem}
  placeholder="Select department"
  disabled={!isEditMode || isSaving}
/>
```

### 4. **CRUD Modal**
```typescript
{/* Department CRUD Modal */}
{departmentsCrud.modalOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
      <h3 className="text-lg font-semibold mb-4">
        {departmentsCrud.editItem?.id ? 'Edit Department' : 'Add Department'}
      </h3>
      <div className="space-y-4">
        <div>
          <Label htmlFor="department-name">Department Name</Label>
          <Input
            id="department-name"
            value={departmentsCrud.editItem?.name || ''}
            onChange={(e) => {
              if (departmentsCrud.editItem) {
                departmentsCrud.editItem.name = e.target.value;
              }
            }}
            placeholder="Enter department name"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={departmentsCrud.closeModal}
            disabled={departmentsCrud.saving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (departmentsCrud.editItem?.name) {
                departmentsCrud.saveItem(departmentsCrud.editItem.name);
              }
            }}
            disabled={departmentsCrud.saving || !departmentsCrud.editItem?.name}
          >
            {departmentsCrud.saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
```

## Fitur yang Tersedia

### 1. **Add Department**
- Klik tombol "Add" di sebelah label
- Modal popup untuk input nama department baru
- Validasi input tidak boleh kosong
- Auto-refresh data setelah berhasil

### 2. **Edit Department**
- Klik tombol "..." (MoreVertical) di sebelah department
- Pilih "Edit" dari dropdown menu
- Modal popup dengan nama department yang sudah ada
- Update nama department
- Default departments tidak bisa diedit

### 3. **Delete Department**
- Klik tombol "..." (MoreVertical) di sebelah department
- Pilih "Delete" dari dropdown menu
- Konfirmasi delete
- Default departments tidak bisa dihapus

### 4. **Select Department**
- Klik dropdown untuk memilih department
- Menampilkan semua departments yang tersedia
- Default departments ditandai dengan "(Default)"
- Loading state saat data sedang dimuat

## Dependencies

### 1. **Hooks yang Digunakan**
- `useDepartmentsCrud`: Untuk CRUD operations
- `useCurrentOrg`: Untuk organization context

### 2. **UI Components**
- `Button`: Untuk Add button dan modal actions
- `DropdownMenu`: Untuk dropdown functionality
- `Input`: Untuk modal input
- `Label`: Untuk form labels

### 3. **Icons**
- `Plus`: Add button icon
- `ChevronDown`: Dropdown trigger icon
- `MoreVertical`: Action menu icon
- `Edit`: Edit action icon
- `Trash2`: Delete action icon

## Testing

### 1. **Add Department**
- Klik tombol "Add" → Modal terbuka
- Input nama department → Validasi input
- Klik "Save" → Department tersimpan
- Dropdown ter-refresh dengan department baru

### 2. **Edit Department**
- Klik "..." pada department → Menu terbuka
- Klik "Edit" → Modal terbuka dengan nama lama
- Ubah nama → Klik "Save"
- Department ter-update di dropdown

### 3. **Delete Department**
- Klik "..." pada department → Menu terbuka
- Klik "Delete" → Konfirmasi muncul
- Klik "OK" → Department terhapus
- Dropdown ter-refresh tanpa department yang dihapus

### 4. **Select Department**
- Klik dropdown → List department muncul
- Pilih department → Value ter-update
- Form data ter-update sesuai pilihan

## Notes
- Implementasi mengikuti pola yang sama dengan `EmploymentDetailsSection.tsx`
- Menggunakan `useDepartmentsCrud` hook yang sudah ada
- Modal menggunakan z-index tinggi untuk overlay
- Default departments (organization_id = NULL) tidak bisa diedit/dihapus
- Loading states dan error handling sudah terintegrasi
