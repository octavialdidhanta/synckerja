# ModalAddTaskStep Component

## Overview
A popup modal component for adding new steps to tasks in the Daily Task management system. This component provides a user-friendly interface for breaking down tasks into smaller, actionable steps.

## Location
`src/components/8-2-DailyTask/section/ModalAddTaskStep.tsx`

## Features
- 🎯 **Clean Modal Interface**: Uses Dialog component for a professional modal experience
- 🌐 **Multi-language Support**: Fully integrated with i18n for English and Indonesian translations
- 📝 **Form Validation**: Ensures step title is provided before submission
- 💡 **Helpful Tips**: Provides guidance on creating effective task steps
- ✅ **Real-time Feedback**: Shows loading states and success/error notifications
- 🎨 **Beautiful UI**: Modern design with consistent styling

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | ✅ | Controls the visibility of the modal |
| `onOpenChange` | `(open: boolean) => void` | ✅ | Callback when modal open state changes |
| `taskId` | `string` | ✅ | The ID of the task to add the step to |
| `taskTitle` | `string` | ✅ | The title of the task (displayed in modal) |
| `onSuccess` | `() => void` | ❌ | Optional callback called after successful step creation |

## Usage Example

```tsx
import { useState } from 'react';
import { ModalAddTaskStep } from '@/components/8-2-DailyTask/section';

function TaskManagement() {
  const [addStepDialog, setAddStepDialog] = useState({
    isOpen: false,
    taskId: null,
    taskTitle: ''
  });

  return (
    <>
      <Button
        onClick={() => 
          setAddStepDialog({
            isOpen: true,
            taskId: 'task-123',
            taskTitle: 'Complete Project Report'
          })
        }
      >
        Add Step
      </Button>

      {addStepDialog.taskId && (
        <ModalAddTaskStep
          open={addStepDialog.isOpen}
          onOpenChange={(open) => 
            setAddStepDialog({ 
              isOpen: open, 
              taskId: null, 
              taskTitle: '' 
            })
          }
          taskId={addStepDialog.taskId}
          taskTitle={addStepDialog.taskTitle}
          onSuccess={() => {
            console.log('Step added successfully!');
          }}
        />
      )}
    </>
  );
}
```

## Form Fields

### Step Title (Required)
- **Field**: Text input
- **Validation**: Must not be empty
- **Placeholder**: "e.g., Review document, Send email, etc."
- **Auto-focus**: Yes

### Description (Optional)
- **Field**: Textarea
- **Rows**: 3
- **Placeholder**: "Add more details about this step..."

## UI Components

### Header
- Icon: ListChecks (blue)
- Title: Translatable "Add New Step"

### Task Context Card
- Displays the parent task title
- Blue background with border
- Helps users confirm they're adding steps to the correct task

### Tips Section
Provides three helpful tips:
1. Keep steps small and specific
2. Use action verbs (e.g., "Review", "Send", "Create")
3. Make each step completable in one sitting

### Action Buttons
- **Cancel**: Resets form and closes modal
- **Add Step**: Submits form (disabled if title is empty or submitting)

## Translation Keys

### English (`en`)
```json
{
  "dailyTask": {
    "addStep": "Add Step",
    "stepTitle": "Step Title",
    "stepTitlePlaceholder": "e.g., Review document, Send email, etc.",
    "stepTitleRequired": "Please enter a step title",
    "stepDescription": "Description",
    "stepDescriptionPlaceholder": "Add more details about this step...",
    "stepAddedSuccess": "Step added successfully",
    "stepAddedError": "Failed to add step",
    "taskTitle": "Task",
    "tipsTitle": "Tips for creating effective steps",
    "tip1": "Keep steps small and specific",
    "tip2": "Use action verbs (e.g., \"Review\", \"Send\", \"Create\")",
    "tip3": "Make each step completable in one sitting"
  }
}
```

### Indonesian (`id`)
```json
{
  "dailyTask": {
    "addStep": "Tambah Langkah",
    "stepTitle": "Judul Langkah",
    "stepTitlePlaceholder": "contoh: Tinjau dokumen, Kirim email, dll.",
    "stepTitleRequired": "Silakan masukkan judul langkah",
    "stepDescription": "Deskripsi",
    "stepDescriptionPlaceholder": "Tambahkan detail lebih lanjut tentang langkah ini...",
    "stepAddedSuccess": "Langkah berhasil ditambahkan",
    "stepAddedError": "Gagal menambahkan langkah",
    "taskTitle": "Tugas",
    "tipsTitle": "Tips untuk membuat langkah yang efektif",
    "tip1": "Buat langkah yang kecil dan spesifik",
    "tip2": "Gunakan kata kerja aktif (contoh: \"Tinjau\", \"Kirim\", \"Buat\")",
    "tip3": "Buat setiap langkah dapat diselesaikan dalam satu waktu"
  }
}
```

## Integration with DailyTaskContext

The component uses the `useDailyTask` hook to access:
- `addTaskStep(taskId, title)`: Function to add a new step to a task

## Dependencies

- `@/components/ui/dialog`: Dialog, DialogContent, DialogHeader, DialogTitle
- `@/components/ui/button`: Button
- `@/components/ui/input`: Input
- `@/components/ui/textarea`: Textarea
- `@/components/ui/label`: Label
- `lucide-react`: Plus, ListChecks icons
- `../DailyTaskContext`: useDailyTask hook
- `@/hooks/use-toast`: useToast hook
- `react-i18next`: useTranslation hook

## States

| State | Type | Description |
|-------|------|-------------|
| `stepTitle` | `string` | The title of the step being added |
| `stepDescription` | `string` | Optional description (currently not saved to DB) |
| `isSubmitting` | `boolean` | Loading state during submission |

## Error Handling

- **Empty Title**: Shows error toast if user tries to submit without a title
- **API Errors**: Catches and displays error toast if step creation fails
- **Form Reset**: Automatically resets form after successful submission or cancellation

## Styling

- Uses Tailwind CSS classes for responsive design
- Blue color scheme for consistency with step-related UI
- Disabled states for buttons during submission
- Loading spinner animation during submission

## Notes

1. The `stepDescription` field is currently in the UI but not saved to the database. This is intentional for future enhancement.
2. The modal automatically closes after successful step creation.
3. The component includes comprehensive error handling with user-friendly messages.
4. All text is translatable using the i18n system.

## Related Components

- `TaskList.tsx`: Uses this modal for adding steps
- `TaskStep.tsx`: Displays individual steps
- `DailyTaskContext.tsx`: Provides the data management functions

