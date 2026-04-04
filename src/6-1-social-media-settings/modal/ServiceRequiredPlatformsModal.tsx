import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { X, Save } from 'lucide-react';
import { useServiceRequiredPlatforms, ServiceRequiredPlatform, CreateServiceRequiredPlatformData, UpdateServiceRequiredPlatformData } from '@/6-1-dashboard/hook/useServiceRequiredPlatforms';
import { useSocialMediaNames } from '@/6-1-dashboard/hook/useSocialMediaNames';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';

const PLATFORM_OPTIONS = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Facebook',
  'LinkedIn',
  'Twitter',
  'Shopee',
  'Tokopedia',
  'Other'
];

interface ServiceRequiredPlatformsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string | null;
  editingPlatform?: ServiceRequiredPlatform | null;
}

export const ServiceRequiredPlatformsModal: React.FC<ServiceRequiredPlatformsModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  editingPlatform
}) => {
  const { organizationId } = useCurrentOrg();
  const { socialMediaNames, getNamesByPlatform } = useSocialMediaNames(organizationId);
  const { createRequiredPlatform, createRequiredPlatformAsync, updateRequiredPlatform, isCreating, isUpdating, requiredPlatforms } = useServiceRequiredPlatforms(serviceId || undefined);

  const [formData, setFormData] = useState({
    platform: '',
    social_media_name_id: '',
    custom_platform_name: '',
    useCustom: false
  });

  // Reset form when modal opens/closes or editingPlatform changes
  useEffect(() => {
    if (isOpen) {
      if (editingPlatform) {
        // Edit mode: populate form with existing data
        setFormData({
          platform: editingPlatform.platform,
          social_media_name_id: editingPlatform.social_media_name_id || '',
          custom_platform_name: editingPlatform.custom_platform_name || '',
          useCustom: !editingPlatform.social_media_name_id
        });
      } else {
        // Add mode: reset form
        setFormData({
          platform: '',
          social_media_name_id: '',
          custom_platform_name: '',
          useCustom: false
        });
      }
    }
  }, [isOpen, editingPlatform]);

  const handleSave = async () => {
    if (!serviceId || !organizationId) {
      toast.error('Service ID or Organization ID is missing');
      return;
    }

    if (!formData.platform || formData.platform.trim() === '') {
      toast.error('Please select a platform');
      return;
    }

    if (!formData.useCustom && !formData.social_media_name_id) {
      toast.error('Please select a social media name');
      return;
    }

    if (formData.useCustom && (!formData.custom_platform_name || formData.custom_platform_name.trim() === '')) {
      toast.error('Please enter a custom platform name');
      return;
    }

    // Check for duplicate before creating (only for new platforms)
    if (!editingPlatform) {
      const socialMediaNameId = formData.useCustom ? null : formData.social_media_name_id || null;
      const duplicateExists = requiredPlatforms.some(rp => 
        rp.service_id === serviceId &&
        rp.platform === formData.platform &&
        rp.social_media_name_id === socialMediaNameId &&
        rp.id !== editingPlatform?.id // Exclude current editing platform if updating
      );

      if (duplicateExists) {
        const platformName = formData.useCustom 
          ? formData.custom_platform_name 
          : socialMediaNames.find(n => n.id === formData.social_media_name_id)?.name || 'selected social media name';
        toast.error(`This platform (${formData.platform}) with ${platformName} is already configured as a required platform for this service.`);
        return;
      }
    }

    try {
      if (editingPlatform) {
        // Update existing platform
        const updates: UpdateServiceRequiredPlatformData = {
          platform: formData.platform,
          is_active: true
        };

        if (formData.useCustom) {
          updates.social_media_name_id = null;
          updates.custom_platform_name = formData.custom_platform_name || null;
        } else {
          updates.social_media_name_id = formData.social_media_name_id || null;
          updates.custom_platform_name = null;
        }

        // Update mutation handles success/error via callbacks
        updateRequiredPlatform({
          id: editingPlatform.id,
          updates
        });
        // Close modal after update (success toast will be shown by hook)
        setTimeout(() => onClose(), 100);
      } else {
        // Create new platform
        const data: CreateServiceRequiredPlatformData = {
          service_id: serviceId,
          platform: formData.platform,
          organization_id: organizationId,
          is_active: true
        };

        if (formData.useCustom) {
          data.social_media_name_id = null;
          data.custom_platform_name = formData.custom_platform_name || null;
        } else {
          data.social_media_name_id = formData.social_media_name_id || null;
          data.custom_platform_name = null;
        }

        // Use async version to handle success/error properly
        try {
          await createRequiredPlatformAsync(data);
          onClose();
        } catch (error: any) {
          // Error is already handled in the hook's onError callback
          // Don't close modal on error so user can fix the issue
        }
      }
    } catch (error: any) {
      console.error('Error saving required platform:', error);
      toast.error(error.message || 'Failed to save required platform');
    }
  };

  const availableNames = formData.platform ? getNamesByPlatform(formData.platform) : [];
  const isSaving = isCreating || isUpdating;
  const isValid = formData.platform && 
    (formData.useCustom ? formData.custom_platform_name.trim() : formData.social_media_name_id);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[600px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            {editingPlatform ? 'Edit Required Platform' : 'Add Required Platform'}
          </DialogTitle>
          <DialogDescription>
            Configure a required platform for this service. Plans will need to have links for all required platforms before being marked as done.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="platform">Platform *</Label>
            <Select
              value={formData.platform}
              onValueChange={(value) => {
                setFormData(prev => ({
                  ...prev,
                  platform: value,
                  social_media_name_id: '', // Reset when platform changes
                  custom_platform_name: '' // Reset when platform changes
                }));
              }}
              disabled={isSaving}
            >
              <SelectTrigger id="platform">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.platform && (
            <>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useCustom"
                    checked={formData.useCustom}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      useCustom: e.target.checked,
                      social_media_name_id: e.target.checked ? '' : prev.social_media_name_id,
                      custom_platform_name: e.target.checked ? prev.custom_platform_name : ''
                    }))}
                    disabled={isSaving}
                    className="rounded"
                  />
                  <Label htmlFor="useCustom" className="cursor-pointer">
                    Use custom platform name (not in Social Media Names)
                  </Label>
                </div>
              </div>

              {formData.useCustom ? (
                <div className="space-y-2">
                  <Label htmlFor="custom_platform_name">Custom Platform Name *</Label>
                  <Input
                    id="custom_platform_name"
                    value={formData.custom_platform_name}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      custom_platform_name: e.target.value
                    }))}
                    placeholder="Enter custom platform name"
                    disabled={isSaving}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="social_media_name">Social Media Name *</Label>
                  {availableNames.length > 0 ? (
                    <Select
                      value={formData.social_media_name_id}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        social_media_name_id: value
                      }))}
                      disabled={isSaving}
                    >
                      <SelectTrigger id="social_media_name">
                        <SelectValue placeholder="Select social media name" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableNames.map((name) => (
                          <SelectItem key={name.id} value={name.id}>
                            {name.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-muted-foreground p-2 border rounded">
                      No social media names found for {formData.platform}. Please create one first or use custom platform name.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

