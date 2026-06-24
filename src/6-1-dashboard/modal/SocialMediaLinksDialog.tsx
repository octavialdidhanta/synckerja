
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Save, X, Plus, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { useSocialMediaLinks } from '@/6-1-dashboard/hook/useSocialMediaLinks';
import { useSocialMediaNames } from '../hook/useSocialMediaNames';
import { useServiceRequiredPlatforms } from '../hook/useServiceRequiredPlatforms';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { CreateSocialMediaLinkData, type SocialMediaLink } from '@/shared/types/social-media-links';
import { resolveSocialMediaLinkName } from '../lib/resolveSocialMediaLinkName';
import type { SocialMediaName } from '@/shared/types/social-media-names';
import type { ServiceRequiredPlatform } from '../hook/useServiceRequiredPlatforms';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { AutoScheduleSection } from '@/6-1-scheduled-posts/components/AutoScheduleSection';
import { RequiredPlatformsProgress } from '@/6-1-scheduled-posts/components/RequiredPlatformsProgress';
import { useScheduledPostsByPlan } from '@/6-1-scheduled-posts/hooks/useScheduledPostsByPlan';
import { buildTikTokCaption } from '@/6-1-scheduled-posts/lib/buildTikTokCaption';
import { syncPlanCompletionStateClient } from '@/6-1-scheduled-posts/lib/syncPlanCompletionStateClient';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useBriefExtended } from '../hook/useBriefExtended';
import { Check } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { DeletePublishedConfirmDialog } from '@/6-1-scheduled-posts/components/DeletePublishedConfirmDialog';
import { useDeletePublishedPost } from '@/6-1-scheduled-posts/hooks/useDeletePublishedPost';
import {
  resolvePlatformAccountIdForDelete,
  shouldDeleteViaPlatformPublish,
} from '@/6-1-scheduled-posts/lib/resolvePlatformAccountIdForDelete';

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

function buildFormLinkFromServer(
  link: SocialMediaLink,
  requiredPlatforms: ServiceRequiredPlatform[],
  getNamesByPlatform: (platform: string) => SocialMediaName[],
): SocialMediaLinkForm {
  const platformNames = getNamesByPlatform(link.platform);
  const social_media_name = resolveSocialMediaLinkName({
    platform: link.platform,
    storedName: link.social_media_name,
    platformAccountOpenId: link.platform_account_open_id,
    url: link.url,
    requiredPlatforms,
    namesForPlatform: platformNames,
  });

  return {
    id: link.id,
    platform: link.platform,
    social_media_name,
    url: link.url,
    isNew: false,
    urlError: validateUrlForPlatform(link.url, link.platform) || undefined,
  };
}

function mergeServerLinksIntoForm(
  prev: SocialMediaLinkForm[],
  serverLinks: SocialMediaLink[],
  requiredPlatforms: ServiceRequiredPlatform[],
  getNamesByPlatform: (platform: string) => SocialMediaName[],
): SocialMediaLinkForm[] {
  const serverById = new Map(serverLinks.map((link) => [link.id, link]));
  let changed = false;

  const merged = prev.flatMap((formRow) => {
    if (formRow.isNew) return [formRow];

    const server = serverById.get(formRow.id);
    if (!server) {
      changed = true;
      return [];
    }

    const fromServer = buildFormLinkFromServer(server, requiredPlatforms, getNamesByPlatform);
    let next = formRow;

    if (!formRow.url.trim() && fromServer.url.trim()) {
      next = { ...next, url: fromServer.url, urlError: fromServer.urlError };
      changed = true;
    }

    const shouldFillName =
      !formRow.social_media_name.trim() &&
      fromServer.social_media_name.trim() &&
      (!formRow.url.trim() || formRow.url.trim() === fromServer.url.trim());

    if (shouldFillName) {
      next = { ...next, social_media_name: fromServer.social_media_name };
      changed = true;
    }

    if (fromServer.url.trim() && !formRow.url.trim()) {
      return [next];
    }

    if (!server.url?.trim() && formRow.url.trim()) {
      next = { ...next, url: '', urlError: undefined };
      changed = true;
    }

    return [next];
  });

  for (const server of serverLinks) {
    if (!merged.some((row) => row.id === server.id)) {
      merged.push(buildFormLinkFromServer(server, requiredPlatforms, getNamesByPlatform));
      changed = true;
    }
  }

  return changed ? merged : prev;
}

const SocialMediaLinksDialog: React.FC<SocialMediaLinksDialogProps> = ({
  isOpen,
  onClose,
  socialMediaPlanId,
  planTitle
}) => {
  const { organizationId } = useCurrentOrg();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: currentEmployee } = useCurrentEmployee();
  const [formLinks, setFormLinks] = useState<SocialMediaLinkForm[]>([]);
  const [deleteLinkTarget, setDeleteLinkTarget] = useState<{
    linkId: string;
    platform: string;
    accountLabel: string;
    accountId: string;
  } | null>(null);
  const deletePublishedMutation = useDeletePublishedPost();
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
  const { data: schedules = [] } = useScheduledPostsByPlan(isOpen ? socialMediaPlanId : undefined);

  const { socialMediaNames, getNamesByPlatform, isLoading: isLoadingNames } = useSocialMediaNames(organizationId);

  // Fetch plan data to get service_id, done status, and content_type
  const { data: planData, isLoading: isLoadingPlanData } = useQuery({
    queryKey: ['social-media-plan', socialMediaPlanId],
    queryFn: async () => {
      if (!socialMediaPlanId) return null;
      const { data, error } = await supabase
        .from('social_media_plans')
        .select('service_id, done, organization_id, post_date, approved, production_approved, google_drive_link, content_type:content_types(id, name)')
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

  const { caption: briefCaption } = useBriefExtended(socialMediaPlanId, isOpen);
  const [tiktokCaption, setTiktokCaption] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTiktokCaption(buildTikTokCaption(planTitle ?? '', briefCaption ?? ''));
  }, [isOpen, planTitle, briefCaption]);

  const contentTypeName = planData?.content_type?.name ?? null;
  const reelEligible = Boolean(
    planData?.post_date &&
    planData?.approved &&
    planData?.production_approved &&
    planData?.google_drive_link?.trim() &&
    contentTypeName === 'Reel',
  );
  const { requiredPlatforms, isLoading: isLoadingRequiredPlatforms } = useServiceRequiredPlatforms(
    planData?.service_id || undefined
  );

  const progressLinks = useMemo(() => {
    const merged = new Map<
      string,
      {
        platform: string;
        url: string | null;
        social_media_name?: string | null;
        platform_account_open_id?: string | null;
      }
    >();

    for (const link of links) {
      merged.set(link.id, {
        platform: link.platform,
        url: link.url,
        social_media_name: link.social_media_name ?? null,
        platform_account_open_id: link.platform_account_open_id ?? null,
      });
    }

    for (const form of formLinks) {
      if (!form.platform?.trim()) continue;

      if (form.isNew) {
        const url = form.url?.trim();
        if (!url) continue;
        merged.set(form.id, {
          platform: form.platform,
          url,
          social_media_name: form.social_media_name?.trim() || null,
          platform_account_open_id: null,
        });
        continue;
      }

      const serverLink = links.find((row) => row.id === form.id);
      if (!serverLink) continue;

      const url = form.url?.trim() || serverLink.url?.trim() || null;
      if (!url) continue;

      merged.set(form.id, {
        platform: form.platform,
        url,
        social_media_name: form.social_media_name?.trim() || serverLink.social_media_name || null,
        platform_account_open_id: serverLink.platform_account_open_id ?? null,
      });
    }

    return Array.from(merged.values());
  }, [links, formLinks]);

  useEffect(() => {
    if (!isOpen || !socialMediaPlanId) return;

    const channel = supabase
      .channel(`publish-progress-${socialMediaPlanId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_media_links',
          filter: `social_media_plan_id=eq.${socialMediaPlanId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['socialMediaLinks', socialMediaPlanId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_media_scheduled_posts',
          filter: `social_media_plan_id=eq.${socialMediaPlanId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['socialMediaScheduledPosts', socialMediaPlanId] });
          if (organizationId) {
            queryClient.invalidateQueries({ queryKey: ['social-media-plans', organizationId] });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isOpen, socialMediaPlanId, organizationId, queryClient]);

  // Track if form has been initialized to prevent reset on refetch
  const formInitializedRef = useRef(false);

  useEffect(() => {
    formInitializedRef.current = false;
    setFormLinks([]);
    setDeleteLinkTarget(null);
  }, [socialMediaPlanId]);

  const formattedPostDate = useMemo(() => {
    const raw = planData?.post_date;
    if (!raw) return null;
    try {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return null;
      return format(date, 'd MMM yyyy', { locale: idLocale });
    } catch {
      return null;
    }
  }, [planData?.post_date]);
  
  // Initialize form data when dialog opens or links change
  useEffect(() => {
    if (!isOpen) {
      formInitializedRef.current = false;
      return;
    }

    if (isLoading || isLoadingNames) return;
    if (planData?.service_id && isLoadingRequiredPlatforms) return;

    if (!formInitializedRef.current) {
      formInitializedRef.current = true;
      if (links.length > 0) {
        setFormLinks(
          links.map((link) =>
            buildFormLinkFromServer(link, requiredPlatforms, getNamesByPlatform),
          ),
        );
      } else {
        setFormLinks([
          {
            id: `new-${Date.now()}`,
            platform: '',
            social_media_name: '',
            url: '',
            isNew: true,
          },
        ]);
      }
      return;
    }

    setFormLinks((prev) =>
      mergeServerLinksIntoForm(prev, links, requiredPlatforms, getNamesByPlatform),
    );
  }, [
    isOpen,
    isLoading,
    isLoadingNames,
    isLoadingRequiredPlatforms,
    links,
    planData?.service_id,
    requiredPlatforms,
    socialMediaNames,
  ]);

  useEffect(() => {
    if (!isOpen || isLoadingNames || isLoadingRequiredPlatforms) return;

    setFormLinks((prev) => {
      let changed = false;
      const next = prev.map((link) => {
        if (!link.platform?.trim() || !link.url?.trim()) return link;

        const platformNames = getNamesByPlatform(link.platform);
        const resolved = resolveSocialMediaLinkName({
          platform: link.platform,
          storedName: link.social_media_name,
          url: link.url,
          requiredPlatforms,
          namesForPlatform: platformNames,
        });

        if (!resolved || resolved === link.social_media_name) return link;

        const shouldReplace =
          !link.social_media_name?.trim() ||
          (platformNames.some((name) => name.name === resolved) &&
            !platformNames.some((name) => name.name === link.social_media_name));

        if (!shouldReplace) return link;

        changed = true;
        return { ...link, social_media_name: resolved };
      });

      return changed ? next : prev;
    });
  }, [isOpen, requiredPlatforms, socialMediaNames, isLoadingNames, isLoadingRequiredPlatforms]);

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
    const link = formLinks.find((row) => row.id === id);
    if (!link) return;

    if (isNew) {
      setFormLinks((prev) => prev.filter((row) => row.id !== id));
      return;
    }

    if (shouldDeleteViaPlatformPublish(link)) {
      const serverLink = links.find((row) => row.id === id);
      const accountId = resolvePlatformAccountIdForDelete(link, serverLink, requiredPlatforms);
      if (!accountId || !organizationId) {
        toast.error(t('digitalMarketing.scheduledPosts.deleteFromPlatformFailed'));
        return;
      }
      setDeleteLinkTarget({
        linkId: id,
        platform: link.platform,
        accountLabel: link.social_media_name?.trim() || link.platform,
        accountId: accountId,
      });
      return;
    }

    await deleteLink(id);
    setFormLinks((prev) => prev.filter((row) => row.id !== id));
  };

  const handleDeleteLinkConfirm = async () => {
    if (!deleteLinkTarget || !organizationId) return;
    try {
      await deletePublishedMutation.mutateAsync({
        platform: deleteLinkTarget.platform,
        organizationId,
        planId: socialMediaPlanId,
        accountId: deleteLinkTarget.accountId,
      });
      setFormLinks((prev) => prev.filter((row) => row.id !== deleteLinkTarget.linkId));
      setDeleteLinkTarget(null);
    } catch {
      // toast handled in hook
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
            if (value.trim() && !updatedLink.social_media_name?.trim()) {
              const resolved = resolveSocialMediaLinkName({
                platform: updatedLink.platform,
                storedName: '',
                url: value,
                requiredPlatforms,
                namesForPlatform: getNamesByPlatform(updatedLink.platform),
              });
              if (resolved) {
                updatedLink.social_media_name = resolved;
              }
            }
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
      await syncPlanCompletionStateClient(socialMediaPlanId);
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
      <DialogContent
        fullscreenAnimation
        className="fixed left-0 right-0 top-0 z-50 flex h-dvh max-h-none min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-white p-0 shadow-none sm:rounded-none dark:bg-background"
      >
        <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-6 pb-4 pr-14 pt-6 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Save className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-xl font-semibold">
                Social Media Publish Setup
              </DialogTitle>
              <DialogDescription className="mt-1 truncate text-sm text-muted-foreground">
                Schedule TikTok posts and manage social media links for this content.
              </DialogDescription>
              {planTitle && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Content: {planTitle}
                  {formattedPostDate ? ` · ${formattedPostDate}` : ''}
                </p>
              )}
              <p className="sr-only">Plan ID: {socialMediaPlanId}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-6 pb-4 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="shrink-0 min-w-0 space-y-4">
            {reelEligible && (
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  ['Post date', Boolean(planData?.post_date)],
                  ['Reel', contentTypeName === 'Reel'],
                  ['Approved', planData?.approved],
                  ['Drive link', Boolean(planData?.google_drive_link?.trim())],
                  ['Prod approved', planData?.production_approved],
                ].map(([label, ok]) => (
                  <span
                    key={label}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${ok ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}
                  >
                    {ok && <Check className="h-3 w-3" />}
                    {label}
                  </span>
                ))}
              </div>
            )}

            {organizationId && (
              <AutoScheduleSection
                organizationId={organizationId}
                planId={socialMediaPlanId}
                planTitle={planTitle ?? null}
                postDate={planData?.post_date ?? null}
                caption={tiktokCaption}
                onCaptionChange={setTiktokCaption}
                googleDriveLink={planData?.google_drive_link ?? null}
                employeeId={currentEmployee?.id}
                reelEligible={reelEligible}
                serviceId={planData?.service_id ?? null}
                requiredPlatforms={requiredPlatforms}
              />
            )}

            {!isLoadingPlanData && planData?.service_id && (
              isLoadingRequiredPlatforms ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600" />
                    <Label className="text-sm text-muted-foreground">Loading required platforms...</Label>
                  </div>
                </div>
              ) : (
                <RequiredPlatformsProgress
                  requiredPlatforms={requiredPlatforms}
                  links={progressLinks}
                  schedules={schedules}
                  contentTypeName={contentTypeName}
                  showWhenDone
                  planDone={planData?.done === true}
                />
              )
            )}

            <div className="flex shrink-0 items-center justify-between gap-2">
              <Label className="text-sm font-medium">Manual social media links</Label>
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

          <div className="min-h-0 flex-1 py-2">
            {isLoading || isLoadingPlanData || isLoadingRequiredPlatforms ? (
              <div className="py-8 text-center text-gray-500">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
                <p className="text-sm">Loading...</p>
              </div>
            ) : (
              <div className="space-y-4 py-2 pr-3">
                {formLinks.map((link) => {
                  const platformNames = link.platform ? getNamesByPlatform(link.platform) : [];
                  const showOrphanName =
                    Boolean(link.social_media_name?.trim()) &&
                    !platformNames.some((name) => name.name === link.social_media_name);

                  return (
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
                                    {showOrphanName && (
                                      <SelectItem value={link.social_media_name}>
                                        {link.social_media_name}
                                      </SelectItem>
                                    )}
                                    {platformNames.map((name) => (
                                      <SelectItem key={name.id} value={name.name}>
                                        {name.name}
                                      </SelectItem>
                                    ))}
                                    {platformNames.length === 0 && !showOrphanName && (
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
                          disabled={isSaving || isDeleting || deletePublishedMutation.isPending}
                          title="Delete link"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}

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
          </div>
          <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
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
            disabled={!hasValidLinks || isSaving || hasUrlErrors}
            title={
              hasUrlErrors
                ? 'Please fix URL validation errors before saving'
                : undefined
            }
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Links'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <DeletePublishedConfirmDialog
        open={deleteLinkTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteLinkTarget(null);
        }}
        platform={deleteLinkTarget?.platform ?? 'YouTube'}
        accountLabel={deleteLinkTarget?.accountLabel ?? ''}
        platformNote={
          deleteLinkTarget?.platform === 'TikTok'
            ? t('digitalMarketing.scheduledPosts.deleteFromPlatformTikTokNote')
            : undefined
        }
        isPending={deletePublishedMutation.isPending}
        onConfirm={() => {
          void handleDeleteLinkConfirm();
        }}
      />
    </Dialog>
  );
};

export default SocialMediaLinksDialog;
