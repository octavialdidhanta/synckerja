# CRUD Implementation for Job Position and Job Level

## Overview
Mengimplementasikan struktur CRUD (Create, Read, Update, Delete) untuk field "Job Position" dan "Job Level" di halaman `/my-info/employment?id={id}` dengan menggunakan CustomDropdown component yang sama seperti Department.

## Implementasi yang Dibuat

### 1. **Job Position CRUD**

#### **CustomDropdown Implementation**
```typescript
<CustomDropdown
  label="Job Position"
  value={formData.job_position_id}
  onChange={(value) => handleInputChange('job_position_id', value)}
  options={filteredJobPositions}
  isLoading={jobPositionsCrud.isLoading}
  onAdd={jobPositionsCrud.openAddModal}
  onEdit={jobPositionsCrud.openEditModal}
  onDelete={jobPositionsCrud.deleteItem}
  placeholder={!formData.department_id ? "Select department first" : "Select job position"}
  disabled={!isEditMode || isSaving || !formData.department_id}
/>
```

#### **Modal Implementation**
```typescript
{/* Job Position CRUD Modal */}
{jobPositionsCrud.modalOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
      <h3 className="text-lg font-semibold mb-4">
        {jobPositionsCrud.editItem?.id ? 'Edit Job Position' : 'Add Job Position'}
      </h3>
      <div className="space-y-4">
        <div>
          <Label htmlFor="job-position-name">Job Position Name</Label>
          <Input
            id="job-position-name"
            value={modalInputValue}
            onChange={(e) => setModalInputValue(e.target.value)}
            placeholder="Enter job position name"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={jobPositionsCrud.closeModal}
            disabled={jobPositionsCrud.saving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (modalInputValue.trim()) {
                jobPositionsCrud.saveItem(modalInputValue.trim());
              }
            }}
            disabled={jobPositionsCrud.saving || !modalInputValue.trim()}
          >
            {jobPositionsCrud.saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
```

### 2. **Job Level CRUD**

#### **CustomDropdown Implementation**
```typescript
<CustomDropdown
  label="Job Level"
  value={formData.job_level_id}
  onChange={(value) => handleInputChange('job_level_id', value)}
  options={jobLevelsCrud.data || []}
  isLoading={jobLevelsCrud.isLoading}
  onAdd={jobLevelsCrud.openAddModal}
  onEdit={jobLevelsCrud.openEditModal}
  onDelete={jobLevelsCrud.deleteItem}
  placeholder="Select job level"
  disabled={!isEditMode || isSaving}
/>
```

#### **Modal Implementation**
```typescript
{/* Job Level CRUD Modal */}
{jobLevelsCrud.modalOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
      <h3 className="text-lg font-semibold mb-4">
        {jobLevelsCrud.editItem?.id ? 'Edit Job Level' : 'Add Job Level'}
      </h3>
      <div className="space-y-4">
        <div>
          <Label htmlFor="job-level-name">Job Level Name</Label>
          <Input
            id="job-level-name"
            value={modalInputValue}
            onChange={(e) => setModalInputValue(e.target.value)}
            placeholder="Enter job level name"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={jobLevelsCrud.closeModal}
            disabled={jobLevelsCrud.saving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (modalInputValue.trim()) {
                jobLevelsCrud.saveItem(modalInputValue.trim());
              }
            }}
            disabled={jobLevelsCrud.saving || !modalInputValue.trim()}
          >
            {jobLevelsCrud.saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
```

### 3. **Enhanced useEffect for Multiple Modals**

```typescript
// Update modal input value when modal opens
useEffect(() => {
  if (departmentsCrud.modalOpen) {
    setModalInputValue(departmentsCrud.editItem?.name || '');
  } else if (jobPositionsCrud.modalOpen) {
    setModalInputValue(jobPositionsCrud.editItem?.name || '');
  } else if (jobLevelsCrud.modalOpen) {
    setModalInputValue(jobLevelsCrud.editItem?.name || '');
  } else {
    setModalInputValue('');
  }
}, [
  departmentsCrud.modalOpen, 
  departmentsCrud.editItem,
  jobPositionsCrud.modalOpen,
  jobPositionsCrud.editItem,
  jobLevelsCrud.modalOpen,
  jobLevelsCrud.editItem
]);
```

## Fitur yang Tersedia

### 1. **Job Position CRUD**
- **Add Job Position**: Klik tombol "Add" → Modal popup → Input nama job position → Save
- **Edit Job Position**: Klik "..." → "Edit" → Modal popup → Update nama → Save
- **Delete Job Position**: Klik "..." → "Delete" → Konfirmasi → Hapus job position
- **Select Job Position**: Dropdown untuk memilih job position yang ada
- **Dependency**: Job Position hanya bisa dipilih setelah Department dipilih

### 2. **Job Level CRUD**
- **Add Job Level**: Klik tombol "Add" → Modal popup → Input nama job level → Save
- **Edit Job Level**: Klik "..." → "Edit" → Modal popup → Update nama → Save
- **Delete Job Level**: Klik "..." → "Delete" → Konfirmasi → Hapus job level
- **Select Job Level**: Dropdown untuk memilih job level yang ada
- **Independent**: Job Level bisa dipilih tanpa dependency

### 3. **Shared Modal State**
- Satu `modalInputValue` state untuk semua modal
- `useEffect` yang cerdas untuk mengelola input value berdasarkan modal yang aktif
- Auto-reset input value ketika modal ditutup

## Dependencies

### 1. **Hooks yang Digunakan**
- `useJobPositionsCrud`: Untuk CRUD operations job position
- `useJobLevelsCrud`: Untuk CRUD operations job level
- `useDepartmentsCrud`: Untuk dependency job position
- `useCurrentOrg`: Untuk organization context

### 2. **UI Components**
- `CustomDropdown`: Reusable component untuk CRUD functionality
- `Button`: Untuk Add button dan modal actions
- `DropdownMenu`: Untuk dropdown functionality
- `Input`: Untuk modal input
- `Label`: Untuk form labels

### 3. **State Management**
- `modalInputValue`: Shared state untuk semua modal inputs
- `useEffect`: Untuk mengelola modal input value
- CRUD hooks: Untuk modal state management

## Struktur yang Diimplementasikan

### 1. **Job Position Section**
```html
<CustomDropdown
  label="Job Position"
  value={formData.job_position_id}
  onChange={(value) => handleInputChange('job_position_id', value)}
  options={filteredJobPositions}
  isLoading={jobPositionsCrud.isLoading}
  onAdd={jobPositionsCrud.openAddModal}
  onEdit={jobPositionsCrud.openEditModal}
  onDelete={jobPositionsCrud.deleteItem}
  placeholder={!formData.department_id ? "Select department first" : "Select job position"}
  disabled={!isEditMode || isSaving || !formData.department_id}
/>
{!formData.department_id && (
  <p className="text-sm text-gray-500">Please select a department first</p>
)}
```

### 2. **Job Level Section**
```html
<CustomDropdown
  label="Job Level"
  value={formData.job_level_id}
  onChange={(value) => handleInputChange('job_level_id', value)}
  options={jobLevelsCrud.data || []}
  isLoading={jobLevelsCrud.isLoading}
  onAdd={jobLevelsCrud.openAddModal}
  onEdit={jobLevelsCrud.openEditModal}
  onDelete={jobLevelsCrud.deleteItem}
  placeholder="Select job level"
  disabled={!isEditMode || isSaving}
/>
```

## Testing

### 1. **Job Position Testing**
- ✅ Add Job Position: Modal terbuka, input bisa diketik, save berhasil
- ✅ Edit Job Position: Modal terbuka dengan data existing, update berhasil
- ✅ Delete Job Position: Konfirmasi muncul, delete berhasil
- ✅ Select Job Position: Dropdown menampilkan options, selection berhasil
- ✅ Dependency: Job Position disabled sampai Department dipilih

### 2. **Job Level Testing**
- ✅ Add Job Level: Modal terbuka, input bisa diketik, save berhasil
- ✅ Edit Job Level: Modal terbuka dengan data existing, update berhasil
- ✅ Delete Job Level: Konfirmasi muncul, delete berhasil
- ✅ Select Job Level: Dropdown menampilkan options, selection berhasil
- ✅ Independent: Job Level bisa dipilih tanpa dependency

### 3. **Modal State Testing**
- ✅ Shared Input: Satu input field untuk semua modal
- ✅ Auto-populate: Input ter-populate dengan data existing saat edit
- ✅ Auto-reset: Input ter-reset saat modal ditutup
- ✅ Validation: Tombol Save disabled jika input kosong

## Notes
- Implementasi mengikuti pola yang sama dengan Department CRUD
- Menggunakan `CustomDropdown` component yang reusable
- Modal state management yang efisien dengan shared input
- Dependency handling untuk Job Position (requires Department)
- Independent operation untuk Job Level
- Semua CRUD operations terintegrasi dengan database
- Loading states dan error handling sudah terintegrasi
