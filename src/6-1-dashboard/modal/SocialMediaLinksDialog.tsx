
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Save, X, Plus, Trash2, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSocialMediaLinks } from '@/6-1-dashboard/hook/useSocialMediaLinks';
import { useSocialMediaNames } from '../hook/useSocialMediaNames';
import { useServiceRequiredPlatforms } from '../hook/useServiceRequiredPlatforms';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { CreateSocialMediaLinkData } from '@/shared/types/social-media-links';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';

interface SocialMediaLinksDialogProps {
  isOpen: boolean;
  onClose: () => void;
  socialMediaPlanId: string;
  planTitle?: string;
}

interface SocialMediaLinkForm {
  id: string;
  platform: string;
  social_media_name: string;
  url: string;
  isNew?: boolean;
  urlError?: string;
}

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

// URL validation function based on platform
const validateUrlForPlatform = (url: string, platform: string): string | null => {
  if (!url || url.trim() === '') {
    return null; // Empty URL is handled separately
  }

  const urlLower = url.toLowerCase().trim();
  
  // Basic URL format validation
  if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) {
    return 'URL must start with http:// or https://';
  }

  // Platform-specific validation
  if (platform === 'TikTok') {
    if (!urlLower.includes('tiktok.com')) {
      return 'URL must be a valid TikTok link (e.g., https://www.tiktok.com/@username/video/...)';
    }
  } else if (platform === 'YouTube') {
    if (!urlLower.includes('youtube.com') && !urlLower.includes('youtu.be')) {
      return 'URL must be a valid YouTube link (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)';
    }
  } else if (platform === 'Instagram') {
    if (!urlLower.includes('instagram.com') && !urlLower.includes('facebook.com')) {
      return 'URL must be a valid Instagram or Facebook link';
    }
  } else if (platform === 'Facebook') {
    if (!urlLower.includes('facebook.com')) {
      return 'URL must be a valid Facebook link';
    }
  } else if (platform === 'LinkedIn') {
    if (!urlLower.includes('linkedin.com')) {
      return 'URL must be a valid LinkedIn link';
    }
  } else if (platform === 'Twitter') {
    if (!urlLower.includes('twitter.com') && !urlLower.includes('x.com')) {
      return 'URL must be a valid Twitter/X link';
    }
  } else if (platform === 'Shopee') {
    if (!urlLower.includes('shopee.co.id') && !urlLower.includes('shopee.com') && !urlLower.includes('shp.ee')) {
      return 'URL must be a valid Shopee link (e.g., https://shopee.co.id/... or https://id.shp.ee/...)';
    }
  } else if (platform === 'Tokopedia') {
    if (!urlLower.includes('tokopedia.com')) {
      return 'URL must be a valid Tokopedia link';
    }
  }

  return null; // Valid URL
};

const SocialMediaLinksDialog: React.FC<SocialMediaLinksDialogProps> = ({
  isOpen,
  onClose,
  socialMediaPlanId,
  planTitle
}) => {
  const { organizationId } = useCurrentOrg();
  const [formLinks, setFormLinks] = useState<SocialMediaLinkForm[]>([]);
  const { 
    links, 
    isLoading, 
    createLink, 
    updateLink, 
    deleteLink, 
    createMultipleLinks,
    isCreating,
    isUpdating,
    isDeleting 
  } = useSocialMediaLinks(socialMediaPlanId);

  const { socialMediaNames, getNamesByPlatform, isLoading: isLoadingNames } = useSocialMediaNames(organizationId);

  // Fetch plan data to get service_id, done status, and content_type
  const { data: planData, isLoading: isLoadingPlanData } = useQuery({
    queryKey: ['social-media-plan', socialMediaPlanId],
    queryFn: async () => {
      if (!socialMediaPlanId) return null;
      const { data, error } = await supabase
        .from('social_media_plans')
        .select('service_id, done, organization_id, content_type:content_types(id, name)')
        .eq('id', socialMediaPlanId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!socialMediaPlanId && isOpen,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    retry: 1,
  });

  // Fetch required platforms for the service
  const { requiredPlatforms, isLoading: isLoadingRequiredPlatforms } = useServiceRequiredPlatforms(
    planData?.service_id || undefined
  );

  // Calculate validation status
  const validationStatus = React.useMemo(() => {
    // If still loading required platforms, return default state
    if (isLoadingRequiredPlatforms) {
      return {
        isValid: false,
        progress: 0,
        missingPlatforms: [],
        totalRequired: 0,
        filledRequired: 0
      };
    }

    if (!planData?.service_id || planData.done === true) {
      // If plan is already done, no validation needed
      return {
        isValid: true,
        progress: 100,
        missingPlatforms: [],
        totalRequired: 0,
        filledRequired: 0
      };
    }

    const activeRequiredPlatforms = requiredPlatforms.filter(rp => rp.is_active === true);
    
    if (activeRequiredPlatforms.length === 0) {
      // No required platforms configured
      return {
        isValid: true,
        progress: 100,
        missingPlatforms: [],
        totalRequired: 0,
        filledRequired: 0
      };
    }

    // Get content type name from planData
    const contentTypeName = planData?.content_type?.name || null;
    
    // Filter out YouTube and Shopee from required platforms if content type is "Carousel" or "Post"
    const filteredRequiredPlatforms = activeRequiredPlatforms.filter(rp => {
      if ((contentTypeName === 'Carousel' || contentTypeName === 'Post') && 
          (rp.platform === 'YouTube' || rp.platform === 'Shopee')) {
        return false; // Exclude YouTube and Shopee for Carousel and Post
      }
      return true;
    });

    if (filteredRequiredPlatforms.length === 0) {
      // All required platforms were filtered out
      return {
        isValid: true,
        progress: 100,
        missingPlatforms: [],
        totalRequired: 0,
        filledRequired: 0
      };
    }

    // Create a set of filled platforms (only platform, not platform + name)
    // Required platforms only require the platform to be filled, not a specific social_media_name
    const filledPlatformsSet = new Set<string>();
    
    formLinks.forEach(link => {
      if (
        link.platform && 
        link.platform.trim() !== '' &&
        link.social_media_name && 
        link.social_media_name.trim() !== '' &&
        link.url && 
        link.url.trim() !== '' &&
        !link.urlError // URL must be valid (no validation errors)
      ) {
        const platform = link.platform.trim();
        filledPlatformsSet.add(platform);
      }
    });

    // Check which required platforms are missing
    // Required platforms only require the platform to be filled, regardless of social_media_name
    const missingPlatforms: string[] = [];
    filteredRequiredPlatforms.forEach(rp => {
      const platform = rp.platform.trim();
      
      if (!filledPlatformsSet.has(platform)) {
        // Display name for missing platform
        const displayName = rp.social_media_name
          ? `${rp.platform} - ${rp.social_media_name.name}`
          : rp.custom_platform_name
          ? `${rp.platform} - ${rp.custom_platform_name}`
          : rp.platform;
        missingPlatforms.push(displayName);
      }
    });

    const filledRequired = filteredRequiredPlatforms.length - missingPlatforms.length;
    const progress = filteredRequiredPlatforms.length > 0
      ? Math.round((filledRequired / filteredRequiredPlatforms.length) * 100)
      : 100;

    return {
      isValid: missingPlatforms.length === 0,
      progress,
      missingPlatforms,
      totalRequired: filteredRequiredPlatforms.length,
      filledRequired
    };
  }, [formLinks, requiredPlatforms, planData, isLoadingRequiredPlatforms]);

  // Track if form has been initialized to prevent reset on refetch
  const formInitializedRef = useRef(false);
  
  // Initialize form data when dialog opens or links change
  // Only initialize once when dialog opens, not on every links change
  useEffect(() => {
    if (isOpen && !formInitializedRef.current) {
      formInitializedRef.current = true;
      if (links.length > 0) {
        // Convert existing links to form format with URL validation
        const existingLinks: SocialMediaLinkForm[] = links.map(link => {
          const urlError = validateUrlForPlatform(link.url, link.platform) || undefined;
          return {
            id: link.id,
            platform: link.platform,
            social_media_name: link.social_media_name,
            url: link.url,
            isNew: false,
            urlError
          };
        });
        setFormLinks(existingLinks);
      } else {
        // Start with one empty link
        setFormLinks([{
          id: `new-${Date.now()}`,
          platform: '',
          social_media_name: '',
          url: '',
          isNew: true
        }]);
      }
    } else if (!isOpen) {
      // Reset flag when dialog closes
      formInitializedRef.current = false;
    }
  }, [isOpen, links]);

  const handleAddLink = () => {
    setFormLinks(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        platform: '',
        social_media_name: '',
        url: '',
        isNew: true
      }
    ]);
  };

  const handleRemoveLink = async (id: string, isNew: boolean = false) => {
    if (isNew) {
      // Just remove from form if it's a new link
      setFormLinks(prev => prev.filter(link => link.id !== id));
    } else {
      // Delete from database if it's an existing link
      await deleteLink(id);
      // Remove from form as well
      setFormLinks(prev => prev.filter(link => link.id !== id));
    }
  };

  const handleFieldChange = (id: string, field: keyof SocialMediaLinkForm, value: string) => {
    setFormLinks(prev => prev.map(link => {
      if (link.id === id) {
        const updatedLink = { ...link, [field]: value };
        
        // If platform changed, reset social_media_name and URL error
        if (field === 'platform') {
          updatedLink.social_media_name = '';
          updatedLink.urlError = undefined;
          // Re-validate URL if it exists
          if (updatedLink.url) {
            updatedLink.urlError = validateUrlForPlatform(updatedLink.url, value) || undefined;
          }
        }
        
        // If URL changed, validate it
        if (field === 'url') {
          if (updatedLink.platform) {
            updatedLink.urlError = validateUrlForPlatform(value, updatedLink.platform) || undefined;
          } else {
            updatedLink.urlError = undefined;
          }
        }
        
        return updatedLink;
      }
      return link;
    }));
  };

  const handleOpenSocialLink = (url: string) => {
    if (url && typeof url === 'string' && url !== '' && (url.startsWith('http://') || url.startsWith('https://'))) {
      window.open(url, '_blank');
    }
  };

  const handleSave = async () => {
    try {
      // Validate all links with platform-specific URL validation
      const validLinks = formLinks.filter(link => {
        // Basic validation
        if (!link.platform || link.platform.trim() === '') return false;
        if (!link.social_media_name || link.social_media_name.trim() === '') return false;
        if (!link.url || link.url.trim() === '') return false;
        
        // URL format validation
        const urlTrimmed = link.url.trim();
        if (!urlTrimmed.startsWith('http://') && !urlTrimmed.startsWith('https://')) {
          return false;
        }
        
        // Platform-specific URL validation
        const urlError = validateUrlForPlatform(urlTrimmed, link.platform);
        if (urlError) {
          // Set error and don't include in valid links
          setFormLinks(prev => prev.map(l => 
            l.id === link.id ? { ...l, urlError } : l
          ));
          return false;
        }
        
        return true;
      });

      // Check if there are any URL errors
      const hasUrlErrors = formLinks.some(link => link.urlError);
      if (hasUrlErrors) {
        return; // Don't save if there are URL validation errors
      }

      if (validLinks.length === 0) {
        return;
      }

      // Separate new links and existing links to update
      const newLinks: CreateSocialMediaLinkData[] = [];
      const updatedLinks: { id: string; updates: any }[] = [];

      for (const link of validLinks) {
        // Ensure all fields are trimmed and valid
        const platform = link.platform?.trim() || '';
        const socialMediaName = link.social_media_name?.trim() || '';
        const url = link.url?.trim() || '';
        
        // Skip if any required field is empty (should not happen due to validation above)
        if (!platform || !socialMediaName || !url) {
          console.warn('Skipping link with empty required fields:', link);
          continue;
        }
        
        if (link.isNew) {
          newLinks.push({
            social_media_plan_id: socialMediaPlanId,
            platform: platform,
            social_media_name: socialMediaName,
            url: url
          });
        } else {
          // Check if the existing link has changes
          const originalLink = links.find(l => l.id === link.id);
          if (originalLink && (
            originalLink.platform !== platform ||
            originalLink.social_media_name !== socialMediaName ||
            originalLink.url !== url
          )) {
            updatedLinks.push({
              id: link.id,
              updates: {
                platform: platform,
                social_media_name: socialMediaName,
                url: url
              }
            });
          }
        }
      }

      // Execute mutations
      if (newLinks.length > 0) {
        // Data is already validated and sanitized above, just ensure it's in correct format
        // Hook will do additional sanitization, but we ensure basic structure here
        const finalNewLinks = newLinks.map(link => ({
          social_media_plan_id: link.social_media_plan_id,
          platform: link.platform,
          social_media_name: link.social_media_name,
          url: link.url
        }));
        
        await createMultipleLinks(finalNewLinks);
      }

      for (const updatedLink of updatedLinks) {
        // Ensure update data is valid (prevent JSON errors)
        const validatedUpdates: any = {};
        if (updatedLink.updates.platform) {
          validatedUpdates.platform = String(updatedLink.updates.platform).trim();
        }
        if (updatedLink.updates.social_media_name) {
          validatedUpdates.social_media_name = String(updatedLink.updates.social_media_name).trim();
        }
        if (updatedLink.updates.url) {
          validatedUpdates.url = String(updatedLink.updates.url).trim();
        }
        
        if (Object.keys(validatedUpdates).length > 0) {
          await updateLink({
            id: updatedLink.id,
            updates: validatedUpdates
          });
        }
      }

      onClose();
    } catch (error) {
      console.error('Error saving social media links:', error);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const hasValidLinks = formLinks.some(link => 
    link.platform && link.platform.trim() !== '' && 
    link.social_media_name && link.social_media_name.trim() !== '' &&
    link.url && link.url.trim() !== '' &&
    !link.urlError // No URL validation errors
  );

  const hasUrlErrors = formLinks.some(link => link.urlError);

  const isSaving = isCreating || isUpdating || isDeleting;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="flex h-[min(640px,calc(100vh-2rem))] max-h-[90vh] w-full max-w-[min(720px,95vw)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-6 pb-4 pr-14 pt-6 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Save className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-xl font-semibold">
                Social Media Links
              </DialogTitle>
              <DialogDescription className="mt-1 truncate text-sm text-muted-foreground">
                Manage social media links for this content.
              </DialogDescription>
              {planTitle && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Content: {planTitle}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-4 pt-4">
          <div className="shrink-0 space-y-4 overflow-x-hidden">
            {/* Required Platforms Progress Indicator */}
            {!isLoadingPlanData && planData?.service_id && !planData.done && (
              isLoadingRequiredPlatforms ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600" />
                    <Label className="text-sm text-muted-foreground">Loading required platforms...</Label>
                  </div>
                </div>
              ) : validationStatus.totalRequired > 0 ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {validationStatus.isValid ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 shrink-0 text-orange-600" />
                      )}
                      <Label className="text-sm font-semibold">Required Platforms Progress</Label>
                    </div>
                    <Badge variant={validationStatus.isValid ? 'default' : 'secondary'} className="shrink-0">
                      {validationStatus.filledRequired} / {validationStatus.totalRequired}
                    </Badge>
                  </div>
                  <Progress value={validationStatus.progress} className="mb-2 h-2 [&>div]:bg-blue-600" />
                  {validationStatus.missingPlatforms.length > 0 && (
                    <div className="mt-2 max-h-24 overflow-y-auto pr-1">
                      <p className="mb-1 text-xs font-medium text-orange-700 dark:text-orange-400">
                        Missing required platforms:
                      </p>
                      <ul className="list-inside list-disc space-y-0.5 text-xs text-orange-600 dark:text-orange-500">
                        {validationStatus.missingPlatforms.map((platform, idx) => (
                          <li key={idx}>{platform}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null
            )}

            <div className="flex shrink-0 items-center justify-between gap-2">
              <Label className="text-sm font-medium">Add social media links</Label>
              <Button
                onClick={handleAddLink}
                variant="outline"
                size="sm"
                className="flex shrink-0 items-center gap-2"
                disabled={isSaving}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {isLoading || isLoadingPlanData || isLoadingRequiredPlatforms ? (
              <div className="py-8 text-center text-gray-500">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
                <p className="text-sm">Loading...</p>
              </div>
            ) : (
              <div className="space-y-4 py-2 pr-3">
                {formLinks.map((link) => (
                  <div key={link.id} className="min-w-0 overflow-hidden rounded-lg border bg-gray-50 p-4">
                    <div className="grid min-w-0 grid-cols-12 gap-3 items-end">
                      <div className="col-span-3 min-w-0 space-y-1">
                        <Label className="text-xs text-gray-600">Platform</Label>
                        <Select
                          value={link.platform}
                          onValueChange={(value) => {
                            // Prevent event bubbling that might close dialog
                            handleFieldChange(link.id, 'platform', value);
                          }}
                          disabled={isSaving}
                        >
                          <SelectTrigger className="h-10 min-w-0 max-w-full">
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
                      
                      <div className="col-span-3 min-w-0 space-y-1">
                        <Label className="text-xs text-gray-600">Social Media Name</Label>
                        {link.platform ? (
                          link.platform === 'Other' ? (
                            <Input
                              value={link.social_media_name}
                              onChange={(e) => handleFieldChange(link.id, 'social_media_name', e.target.value)}
                              placeholder="Enter custom name"
                              className="h-10"
                              disabled={isSaving}
                            />
                          ) : (
                            <Select
                              value={link.social_media_name}
                              onValueChange={(value) => {
                                // Prevent event bubbling that might close dialog
                                handleFieldChange(link.id, 'social_media_name', value);
                              }}
                              disabled={isSaving}
                            >
                              <SelectTrigger className="h-10 min-w-0 max-w-full">
                                <SelectValue placeholder="Select account name" />
                              </SelectTrigger>
                              <SelectContent>
                                {isLoadingNames ? (
                                  <SelectItem value="loading" disabled>
                                    Loading...
                                  </SelectItem>
                                ) : (
                                  <>
                                    {getNamesByPlatform(link.platform).map((name) => (
                                      <SelectItem key={name.id} value={name.name}>
                                        {name.name}
                                      </SelectItem>
                                    ))}
                                    {getNamesByPlatform(link.platform).length === 0 && (
                                      <SelectItem value="no-names-available" disabled>
                                        No names available for {link.platform}
                                      </SelectItem>
                                    )}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          )
                        ) : (
                          <Input
                            value=""
                            placeholder="Select platform first"
                            className="h-10"
                            disabled
                          />
                        )}
                      </div>
                      
                      <div className="col-span-5 min-w-0 space-y-1">
                        <Label className="text-xs text-gray-600">URL</Label>
                        <div className="relative min-w-0">
                          <Input
                            value={link.url}
                            onChange={(e) => handleFieldChange(link.id, 'url', e.target.value)}
                            placeholder={
                              link.platform === 'TikTok' 
                                ? "https://www.tiktok.com/@username/video/..." 
                                : link.platform === 'YouTube'
                                ? "https://www.youtube.com/watch?v=... or https://youtu.be/..."
                                : "https://..."
                            }
                            className={`h-10 min-w-0 max-w-full pr-8 ${link.urlError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                            disabled={isSaving}
                          />
                          {link.url && !link.urlError && (link.url.startsWith('http://') || link.url.startsWith('https://')) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                              onClick={() => handleOpenSocialLink(link.url)}
                              title="Open link"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {link.urlError && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {link.urlError}
                          </p>
                        )}
                      </div>

                      <div className="col-span-1 flex shrink-0 justify-center">
                        <Button
                          onClick={() => handleRemoveLink(link.id, link.isNew)}
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          disabled={isSaving}
                          title="Delete link"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {formLinks.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No social media links added yet.</p>
                    <Button
                      onClick={handleAddLink}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={isSaving}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Link
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex shrink-0 flex-wrap gap-2 border-t bg-muted/30 px-6 pb-6 pt-4 sm:flex-nowrap sm:justify-end">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex items-center gap-2"
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex items-center gap-2"
            disabled={!hasValidLinks || isSaving || !validationStatus.isValid || hasUrlErrors}
            title={
              hasUrlErrors 
                ? 'Please fix URL validation errors before saving' 
                : !validationStatus.isValid 
                ? 'Please fill all required platforms before saving' 
                : undefined
            }
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Links'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SocialMediaLinksDialog;
