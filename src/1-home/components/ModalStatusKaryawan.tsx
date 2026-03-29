import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Send, Loader2, Edit3 } from 'lucide-react';
import { useEmployeeStatus, EmployeeStatus } from './useEmployeeStatus';

interface ModalStatusKaryawanProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusCreated?: () => void;
  onStatusUpdated?: () => void;
  editingStatus?: EmployeeStatus | null;
}

export const ModalStatusKaryawan = ({ 
  isOpen, 
  onClose, 
  onStatusCreated, 
  onStatusUpdated, 
  editingStatus 
}: ModalStatusKaryawanProps) => {
  const [newStatus, setNewStatus] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const { createStatus, updateStatus } = useEmployeeStatus();
  const isEditMode = !!editingStatus;

  const locations = [
    "Kantor Pusat Jakarta", 
    "Ruang Meeting A", 
    "Ruang Meeting B", 
    "Pantry", 
    "Dev Room", 
    "Design Studio", 
    "Remote/WFH"
  ];

  const statusTypes = [
    { value: "work", label: "Kerja" },
    { value: "meeting", label: "Meeting" },
    { value: "break", label: "Istirahat" },
    { value: "lunch", label: "Makan Siang" },
    { value: "training", label: "Training" },
    { value: "other", label: "Lainnya" }
  ];

  // Populate form when editing
  useEffect(() => {
    if (editingStatus) {
      setNewStatus(editingStatus.status_text);
      setSelectedLocation(editingStatus.location);
      setSelectedType(editingStatus.status_type);
    } else {
      // Reset form when creating new status
      setNewStatus('');
      setSelectedLocation('');
      setSelectedType('');
    }
  }, [editingStatus]);

  const handleSubmitStatus = async () => {
    if (!newStatus.trim() || !selectedLocation || !selectedType) {
      return;
    }

    setIsCreating(true);
    try {
      const statusData = {
        status_text: newStatus,
        location: selectedLocation,
        status_type: selectedType as 'work' | 'meeting' | 'break' | 'call' | 'wfh'
      };

      if (isEditMode && editingStatus) {
        // Update existing status
        const success = await updateStatus(editingStatus.id, statusData);
        if (success && onStatusUpdated) {
          onStatusUpdated();
        }
      } else {
        // Create new status
        const success = await createStatus(statusData);
        if (success && onStatusCreated) {
          onStatusCreated();
        }
      }

      // Close modal
      onClose();
    } catch (error) {
      console.error('Error submitting status:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setNewStatus('');
      setSelectedLocation('');
      setSelectedType('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-gray-900 leading-snug">
            {isEditMode ? 'Edit Status' : 'Buat Status Baru'}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Bagikan status kegiatan atau lokasi Anda saat ini agar tim dapat memantau aktivitas karyawan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 leading-normal">Status</label>
            <Input 
              placeholder="Apa yang sedang Anda lakukan?" 
              value={newStatus} 
              onChange={e => setNewStatus(e.target.value)} 
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 leading-normal">Lokasi</label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih lokasi" />
              </SelectTrigger>
              <SelectContent className="z-[1000001]">
                {locations.map(location => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 leading-normal">Kategori</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent className="z-[1000001]">
                {statusTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={handleSubmitStatus} 
            className="w-full text-sm font-medium leading-normal" 
            disabled={!newStatus.trim() || !selectedLocation || !selectedType || isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditMode ? 'Memperbarui...' : 'Memposting...'}
              </>
            ) : (
              <>
                {isEditMode ? (
                  <>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Update Status
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Posting Status
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};


