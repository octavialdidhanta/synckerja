# Hook Order Fix - EmploymentInfoTab

## Overview
Memperbaiki error `Cannot access 'departmentsCrud' before initialization` yang menyebabkan halaman `/my-info/employment?id={id}` menjadi blank page.

## Masalah yang Ditemukan

### Error:
```
Uncaught ReferenceError: Cannot access 'departmentsCrud' before initialization
    at EmploymentInfoTab (EmploymentInfoTab.tsx:36:7)
```

### Root Cause:
- `departmentsCrud` didefinisikan di baris 193 (setelah `useEffect`)
- `useEffect` yang menggunakan `departmentsCrud` ada di baris 30-36 (sebelum deklarasi)
- JavaScript hoisting tidak berlaku untuk `const` declarations
- React hooks harus didefinisikan sebelum digunakan

## Perbaikan yang Dibuat

### 1. **Memindahkan Hook Declaration**
```typescript
// SEBELUM (SALAH)
export const EmploymentInfoTab = ({ employee, isEditMode, onUpdate }: EmploymentInfoTabProps) => {
  const { organizationId } = useCurrentOrg();
  const [modalInputValue, setModalInputValue] = useState('');

  // Update modal input value when modal opens
  useEffect(() => {
    if (departmentsCrud.modalOpen) { // ❌ ERROR: departmentsCrud belum didefinisikan
      setModalInputValue(departmentsCrud.editItem?.name || '');
    } else {
      setModalInputValue('');
    }
  }, [departmentsCrud.modalOpen, departmentsCrud.editItem]);

  // ... CustomDropdown component ...

  // Fetch master data
  const departmentsCrud = useDepartmentsCrud(organizationId); // ❌ Didefinisikan setelah useEffect
  // ...
};

// SESUDAH (BENAR)
export const EmploymentInfoTab = ({ employee, isEditMode, onUpdate }: EmploymentInfoTabProps) => {
  const { organizationId } = useCurrentOrg();
  const [modalInputValue, setModalInputValue] = useState('');
  
  // Initialize CRUD hooks - Pindahkan ke atas
  const departmentsCrud = useDepartmentsCrud(organizationId); // ✅ Didefinisikan sebelum useEffect

  // Update modal input value when modal opens
  useEffect(() => {
    if (departmentsCrud.modalOpen) { // ✅ Sekarang bisa diakses
      setModalInputValue(departmentsCrud.editItem?.name || '');
    } else {
      setModalInputValue('');
    }
  }, [departmentsCrud.modalOpen, departmentsCrud.editItem]);

  // ... CustomDropdown component ...

  // Fetch master data - Hapus duplikasi
  const jobPositionsCrud = useJobPositionsCrud(organizationId, { department_id: formData.department_id });
  // ...
};
```

### 2. **Menghapus Duplikasi Hook**
- Menghapus deklarasi `departmentsCrud` yang duplikat di baris 196
- Mempertahankan deklarasi di bagian atas component

## Prinsip React Hooks

### 1. **Rules of Hooks**
- Hooks harus dipanggil di level teratas component
- Hooks tidak boleh dipanggil di dalam loops, conditions, atau nested functions
- Hooks harus dipanggil dalam urutan yang sama setiap render

### 2. **Hook Order**
```typescript
// ✅ URUTAN YANG BENAR
const Component = () => {
  // 1. State hooks
  const [state, setState] = useState();
  
  // 2. Custom hooks (CRUD, data fetching)
  const dataHook = useDataHook();
  
  // 3. useEffect hooks
  useEffect(() => {
    // Bisa menggunakan dataHook di sini
  }, [dataHook.dependency]);
  
  // 4. Event handlers
  const handleClick = () => {};
  
  // 5. Render
  return <div />;
};
```

### 3. **Dependency Array**
```typescript
useEffect(() => {
  // Logic yang menggunakan departmentsCrud
}, [departmentsCrud.modalOpen, departmentsCrud.editItem]); // ✅ Dependencies yang benar
```

## Testing

### 1. **Before Fix**
- Halaman `/my-info/employment?id={id}` blank page
- Console error: `Cannot access 'departmentsCrud' before initialization`
- Component tidak bisa render

### 2. **After Fix**
- Halaman `/my-info/employment?id={id}` load normal
- Tidak ada console errors
- CRUD functionality berfungsi dengan baik
- Modal input field bisa diketik

## Best Practices

### 1. **Hook Organization**
```typescript
const Component = () => {
  // 1. Context/Props
  const { organizationId } = useCurrentOrg();
  
  // 2. State
  const [localState, setLocalState] = useState();
  
  // 3. Data Hooks (CRUD, API calls)
  const dataHook = useDataHook(organizationId);
  const anotherHook = useAnotherHook(organizationId);
  
  // 4. Effects
  useEffect(() => {
    // Effect logic
  }, [dataHook.dependency]);
  
  // 5. Event Handlers
  const handleEvent = () => {};
  
  // 6. Render
  return <div />;
};
```

### 2. **Error Prevention**
- Selalu deklarasikan hooks di level teratas
- Jangan gunakan hooks di dalam conditions atau loops
- Pastikan dependencies di useEffect sudah didefinisikan sebelumnya
- Gunakan ESLint rules untuk hooks

## Dependencies

### 1. **Hooks yang Digunakan**
- `useDepartmentsCrud`: Untuk CRUD operations department
- `useCurrentOrg`: Untuk organization context
- `useState`: Untuk local state management
- `useEffect`: Untuk side effects

### 2. **Order Dependencies**
- `departmentsCrud` harus didefinisikan sebelum `useEffect`
- `organizationId` harus tersedia sebelum `useDepartmentsCrud`
- `modalInputValue` state harus didefinisikan sebelum `useEffect`

## Notes
- Perbaikan ini mengikuti React Hooks rules dengan benar
- Hook order sangat penting untuk menghindari runtime errors
- Duplikasi hook declarations harus dihindari
- Dependencies di useEffect harus sudah didefinisikan sebelumnya
