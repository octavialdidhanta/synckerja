
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ContentPillar } from '../types/social-media';

interface EnhancedContentPillarModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  item: ContentPillar | null;
  onClose: () => void;
  onSave: (data: Partial<ContentPillar>) => void;
  saving: boolean;
}

export const EnhancedContentPillarModal: React.FC<EnhancedContentPillarModalProps> = ({
  open,
  mode,
  item,
  onClose,
  onSave,
  saving
}) => {
  const [formData, setFormData] = useState({
    name: '',
    funnel_stage: '',
    description: ''
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: item?.name || '',
        funnel_stage: item?.funnel_stage || '',
        description: item?.description || ''
      });
    }
  }, [open, item]);

  const handleSave = () => {
    if (formData.name.trim() && formData.funnel_stage) {
      const data: Partial<ContentPillar> = {
        name: formData.name.trim(),
        funnel_stage: formData.funnel_stage as 'top' | 'middle' | 'bottom',
        description: formData.description.trim() || undefined
      };
      onSave(data);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && formData.name.trim() && formData.funnel_stage) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999999]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 relative z-[1000000]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'add' ? 'Add' : 'Edit'} Content Pillar
          </h2>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
              Content Pillar Name *
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter content pillar name"
              className="w-full"
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="funnel_stage" className="text-sm font-medium text-gray-700">
              Funnel Stage *
            </Label>
            <Select 
              value={formData.funnel_stage} 
              onValueChange={(value) => setFormData({ ...formData, funnel_stage: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select funnel stage" />
              </SelectTrigger>
              <SelectContent className="bg-white border shadow-lg z-[1000001]">
                <SelectItem value="top">Top Funnel (Awareness)</SelectItem>
                <SelectItem value="middle">Middle Funnel (Consideration)</SelectItem>
                <SelectItem value="bottom">Bottom Funnel (Conversion)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">
              Description
            </Label>
            <Input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description (optional)"
              className="w-full"
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !formData.name.trim() || !formData.funnel_stage}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
