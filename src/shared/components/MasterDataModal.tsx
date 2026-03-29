
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/components/ui/button';

interface MasterDataModalProps {
  open: boolean;
  title: string;
  value: { id?: string; name: string } | null;
  onClose: () => void;
  onSave: (name: string) => void;
  saving: boolean;
}

export const MasterDataModal: React.FC<MasterDataModalProps> = ({
  open,
  title,
  value,
  onClose,
  onSave,
  saving
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      setName(value?.name || '');
    }
  }, [open, value]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999999]">
      <div className="bg-white rounded-lg p-6 w-96 relative z-[1000000]">
        <h2 className="text-lg font-semibold mb-4">
          {value?.id ? 'Edit' : 'Add'} {title}
        </h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {title} Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`Enter ${title.toLowerCase()} name`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
