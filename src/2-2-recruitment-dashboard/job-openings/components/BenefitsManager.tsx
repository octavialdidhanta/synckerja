import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { JobBenefit } from '../hooks/jobOpeningTypes';

interface BenefitsManagerProps {
  benefits: JobBenefit[];
  onChange: (benefits: JobBenefit[]) => void;
}

export const BenefitsManager = ({ benefits, onChange }: BenefitsManagerProps) => {
  const [localBenefits, setLocalBenefits] = useState<JobBenefit[]>(benefits || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [snapshotForCancel, setSnapshotForCancel] = useState<JobBenefit | null>(null);

  const handleAddBenefit = () => {
    const newBenefits = [...localBenefits, { title: '', description: '' }];
    setLocalBenefits(newBenefits);
    onChange(newBenefits);
    setEditingIndex(localBenefits.length);
    setSnapshotForCancel({ title: '', description: '' });
  };

  const handleRemoveBenefit = (index: number) => {
    const newBenefits = localBenefits.filter((_, i) => i !== index);
    setLocalBenefits(newBenefits);
    onChange(newBenefits);
    if (editingIndex === index) {
      setEditingIndex(null);
      setSnapshotForCancel(null);
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleUpdateBenefit = (index: number, field: 'title' | 'description', value: string) => {
    const newBenefits = localBenefits.map((benefit, i) => {
      if (i === index) {
        return { ...benefit, [field]: value };
      }
      return benefit;
    });
    setLocalBenefits(newBenefits);
    onChange(newBenefits);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setSnapshotForCancel({ ...localBenefits[index] });
  };

  const handleSaveEdit = () => {
    setEditingIndex(null);
    setSnapshotForCancel(null);
  };

  const handleCancelEdit = () => {
    if (editingIndex === null || snapshotForCancel === null) return;
    const newBenefits = localBenefits.map((benefit, i) =>
      i === editingIndex ? { ...snapshotForCancel } : benefit
    );
    setLocalBenefits(newBenefits);
    onChange(newBenefits);
    setEditingIndex(null);
    setSnapshotForCancel(null);
  };

  // Sync with external changes (e.g. modal opened with different data)
  useEffect(() => {
    if (benefits !== localBenefits) {
      setLocalBenefits(benefits || []);
      setEditingIndex(null);
      setSnapshotForCancel(null);
    }
  }, [benefits]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Benefits</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddBenefit}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Benefit
        </Button>
      </div>

      {localBenefits.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No benefits added yet. Click "Add Benefit" to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {localBenefits.map((benefit, index) => {
            const isEditing = editingIndex === index;
            return (
              <div
                key={index}
                className={`rounded-lg border ${isEditing ? 'p-4 space-y-3 border-input' : 'p-3 border-border/60 bg-muted/30'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  {!isEditing ? (
                    <>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium text-foreground">
                          {benefit.title || '—'}
                        </p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {benefit.description || 'No description'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleStartEdit(index)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveBenefit(index)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 space-y-3 min-w-0">
                        <div className="space-y-2">
                          <Label htmlFor={`benefit-title-${index}`}>Title</Label>
                          <Input
                            id={`benefit-title-${index}`}
                            placeholder="e.g., Health Insurance"
                            value={benefit.title}
                            onChange={(e) => handleUpdateBenefit(index, 'title', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`benefit-description-${index}`}>Description</Label>
                          <Textarea
                            id={`benefit-description-${index}`}
                            placeholder="Enter benefit description..."
                            value={benefit.description}
                            onChange={(e) => handleUpdateBenefit(index, 'description', e.target.value)}
                            className="min-h-[80px]"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveEdit}
                          className="flex items-center gap-1.5"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBenefit(index)}
                          className="text-red-600 hover:text-red-700 justify-start"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
