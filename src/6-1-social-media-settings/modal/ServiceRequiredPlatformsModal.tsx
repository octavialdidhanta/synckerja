import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { X, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useServiceRequiredPlatforms, ServiceRequiredPlatform, CreateServiceRequiredPlatformData, UpdateServiceRequiredPlatformData } from '@/6-1-dashboard/hook/useServiceRequiredPlatforms';
import { useSocialMediaNames } from '@/6-1-dashboard/hook/useSocialMediaNames';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useConnectedPlatformAccounts } from '@/6-1-scheduled-posts/hooks/useConnectedPlatformAccounts';
import {
  getPlatformSettingsPath,
  isOAuthRequiredPlatform,
} from '@/6-1-scheduled-posts/lib/platformOAuthConfig';
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
  'Other',
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
  editingPlatform,
}) => {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { socialMediaNames, getNamesByPlatform } = useSocialMediaNames(organizationId);
  const { getAccountsForPlatform, isLoading: oauthAccountsLoading } =
    useConnectedPlatformAccounts(organizationId);
  const {
    createRequiredPlatform,
    createRequiredPlatformAsync,
    updateRequiredPlatform,
    isCreating,
    isUpdating,
    requiredPlatforms,
  } = useServiceRequiredPlatforms(serviceId || undefined);

  const [formData, setFormData] = useState({
    platform: '',
    social_media_name_id: '',
    custom_platform_name: '',
    platform_account_id: '',
    useCustom: false,
  });

  useEffect(() => {
    if (isOpen) {
      if (editingPlatform) {
        setFormData({
          platform: editingPlatform.platform,
          social_media_name_id: editingPlatform.social_media_name_id || '',
          custom_platform_name: editingPlatform.custom_platform_name || '',
          platform_account_id: editingPlatform.platform_account_id || '',
          useCustom: Boolean(
            !editingPlatform.platform_account_id &&
              !editingPlatform.social_media_name_id &&
              editingPlatform.custom_platform_name,
          ),
        });
      } else {
        setFormData({
          platform: '',
          social_media_name_id: '',
          custom_platform_name: '',
          platform_account_id: '',
          useCustom: false,
        });
      }
    }
  }, [isOpen, editingPlatform]);

  const usesOAuthAccounts = formData.platform
    ? isOAuthRequiredPlatform(formData.platform)
    : false;

  const oauthAccounts = useMemo(
    () => (formData.platform ? getAccountsForPlatform(formData.platform) : []),
    [formData.platform, getAccountsForPlatform],
  );

  const existingForPlatform = useMemo(() => {
    if (!serviceId || !formData.platform) return [];
    return requiredPlatforms.filter(
      (rp) =>
        rp.service_id === serviceId &&
        rp.platform === formData.platform &&
        (!editingPlatform || rp.id !== editingPlatform.id),
    );
  }, [requiredPlatforms, serviceId, formData.platform, editingPlatform]);

  const availableOAuthAccounts = useMemo(() => {
    const usedIds = new Set(
      existingForPlatform
        .map((rp) => rp.platform_account_id?.trim())
        .filter((id): id is string => Boolean(id)),
    );
    return oauthAccounts.filter((acc) => !usedIds.has(acc.accountId));
  }, [oauthAccounts, existingForPlatform]);

  const manualNames = formData.platform ? getNamesByPlatform(formData.platform) : [];

  const availableManualNames = useMemo(() => {
    const usedIds = new Set(
      existingForPlatform
        .map((rp) => rp.social_media_name_id)
        .filter((id): id is string => Boolean(id)),
    );
    return manualNames.filter((name) => !usedIds.has(name.id));
  }, [manualNames, existingForPlatform]);

  useEffect(() => {
    if (!usesOAuthAccounts || !formData.platform_account_id || editingPlatform) return;
    const stillAvailable = availableOAuthAccounts.some(
      (acc) => acc.accountId === formData.platform_account_id,
    );
    if (!stillAvailable) {
      setFormData((prev) => ({ ...prev, platform_account_id: '' }));
    }
  }, [availableOAuthAccounts, formData.platform_account_id, usesOAuthAccounts, editingPlatform]);

  useEffect(() => {
    if (usesOAuthAccounts || !formData.social_media_name_id || editingPlatform) return;
    const stillAvailable = availableManualNames.some(
      (name) => name.id === formData.social_media_name_id,
    );
    if (!stillAvailable) {
      setFormData((prev) => ({ ...prev, social_media_name_id: '' }));
    }
  }, [availableManualNames, formData.social_media_name_id, usesOAuthAccounts, editingPlatform]);

  const settingsPath = formData.platform ? getPlatformSettingsPath(formData.platform) : null;

  const handleSave = async () => {
    if (!serviceId || !organizationId) {
      toast.error('Service ID or Organization ID is missing');
      return;
    }

    if (!formData.platform || formData.platform.trim() === '') {
      toast.error('Please select a platform');
      return;
    }

    if (usesOAuthAccounts) {
      if (!formData.platform_account_id) {
        toast.error(t('digitalMarketing.scheduledPosts.oauthAccountRequired'));
        return;
      }
    } else if (!formData.useCustom && !formData.social_media_name_id) {
      toast.error('Please select a social media name');
      return;
    } else if (formData.useCustom && !formData.custom_platform_name.trim()) {
      toast.error('Please enter a custom platform name');
      return;
    }

    if (!editingPlatform) {
      const duplicateExists = requiredPlatforms.some((rp) => {
        if (rp.service_id !== serviceId || rp.platform !== formData.platform) return false;
        if (usesOAuthAccounts) {
          return rp.platform_account_id === formData.platform_account_id;
        }
        const socialMediaNameId = formData.useCustom ? null : formData.social_media_name_id || null;
        return rp.social_media_name_id === socialMediaNameId;
      });

      if (duplicateExists) {
        toast.error(t('digitalMarketing.scheduledPosts.duplicateRequiredPlatform'));
        return;
      }
    }

    try {
      const selectedOAuth = availableOAuthAccounts.find(
        (acc) => acc.accountId === formData.platform_account_id,
      ) ?? oauthAccounts.find((acc) => acc.accountId === formData.platform_account_id);

      if (editingPlatform) {
        const updates: UpdateServiceRequiredPlatformData = {
          platform: formData.platform,
          is_active: true,
        };

        if (usesOAuthAccounts) {
          updates.platform_account_id = formData.platform_account_id;
          updates.platform_account_label = selectedOAuth?.accountLabel ?? null;
          updates.social_media_name_id = null;
          updates.custom_platform_name = null;
        } else if (formData.useCustom) {
          updates.social_media_name_id = null;
          updates.custom_platform_name = formData.custom_platform_name || null;
          updates.platform_account_id = null;
          updates.platform_account_label = null;
        } else {
          updates.social_media_name_id = formData.social_media_name_id || null;
          updates.custom_platform_name = null;
          updates.platform_account_id = null;
          updates.platform_account_label = null;
        }

        updateRequiredPlatform({ id: editingPlatform.id, updates });
        setTimeout(() => onClose(), 100);
      } else {
        const data: CreateServiceRequiredPlatformData = {
          service_id: serviceId,
          platform: formData.platform,
          organization_id: organizationId,
          is_active: true,
        };

        if (usesOAuthAccounts) {
          data.platform_account_id = formData.platform_account_id;
          data.platform_account_label = selectedOAuth?.accountLabel ?? null;
        } else if (formData.useCustom) {
          data.custom_platform_name = formData.custom_platform_name || null;
        } else {
          data.social_media_name_id = formData.social_media_name_id || null;
        }

        await createRequiredPlatformAsync(data);
        onClose();
      }
    } catch (error: unknown) {
      console.error('Error saving required platform:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save required platform');
    }
  };

  const isSaving = isCreating || isUpdating;
  const isValid = usesOAuthAccounts
    ? Boolean(formData.platform && formData.platform_account_id)
    : Boolean(
        formData.platform &&
          (formData.useCustom ? formData.custom_platform_name.trim() : formData.social_media_name_id),
      );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[600px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            {editingPlatform ? 'Edit Required Platform' : 'Add Required Platform'}
          </DialogTitle>
          <DialogDescription>
            Configure a required platform for this service. Plans will need to have links for all
            required platforms before being marked as done.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="platform">Platform *</Label>
            <Select
              value={formData.platform}
              onValueChange={(value) => {
                setFormData({
                  platform: value,
                  social_media_name_id: '',
                  custom_platform_name: '',
                  platform_account_id: '',
                  useCustom: false,
                });
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

          {formData.platform ? (
            usesOAuthAccounts ? (
              <div className="space-y-2">
                <Label htmlFor="platform_account_id">
                  {t('digitalMarketing.scheduledPosts.accountLabel', 'Account')} *
                </Label>
                {oauthAccountsLoading ? (
                  <div className="rounded border p-2 text-sm text-muted-foreground">Loading...</div>
                ) : oauthAccounts.length > 0 && availableOAuthAccounts.length > 0 ? (
                  <Select
                    value={formData.platform_account_id}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, platform_account_id: value }))
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger id="platform_account_id">
                      <SelectValue placeholder={t('digitalMarketing.scheduledPosts.selectAccount', 'Select account')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOAuthAccounts.map((acc) => (
                        <SelectItem key={acc.accountId} value={acc.accountId}>
                          {acc.accountLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : oauthAccounts.length > 0 ? (
                  <div className="rounded border p-2 text-sm text-muted-foreground">
                    {t(
                      'digitalMarketing.scheduledPosts.allAccountsConfigured',
                      'All connected accounts for this platform are already configured.',
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 rounded border p-3 text-sm text-muted-foreground">
                    <p>{t('digitalMarketing.scheduledPosts.connectOAuthAccountHint')}</p>
                    {settingsPath ? (
                      <Link
                        to={settingsPath}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {t('digitalMarketing.scheduledPosts.openPlatformSettings', {
                          platform: formData.platform,
                        })}
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="useCustom"
                      checked={formData.useCustom}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          useCustom: e.target.checked,
                          social_media_name_id: e.target.checked ? '' : prev.social_media_name_id,
                          custom_platform_name: e.target.checked ? prev.custom_platform_name : '',
                        }))
                      }
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
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          custom_platform_name: e.target.value,
                        }))
                      }
                      placeholder="Enter custom platform name"
                      disabled={isSaving}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="social_media_name">Social Media Name *</Label>
                    {availableManualNames.length > 0 ? (
                      <Select
                        value={formData.social_media_name_id}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, social_media_name_id: value }))
                        }
                        disabled={isSaving}
                      >
                        <SelectTrigger id="social_media_name">
                          <SelectValue placeholder="Select social media name" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableManualNames.map((name) => (
                            <SelectItem key={name.id} value={name.id}>
                              {name.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : manualNames.length > 0 ? (
                      <div className="rounded border p-2 text-sm text-muted-foreground">
                        {t(
                          'digitalMarketing.scheduledPosts.allAccountsConfigured',
                          'All connected accounts for this platform are already configured.',
                        )}
                      </div>
                    ) : (
                      <div className="rounded border p-2 text-sm text-muted-foreground">
                        No social media names found for {formData.platform}. Please create one
                        first or use custom platform name.
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
