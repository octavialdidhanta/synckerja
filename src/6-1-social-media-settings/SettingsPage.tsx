import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useServiceRequiredPlatforms } from '@/6-1-dashboard/hook/useServiceRequiredPlatforms';
import { useScriptAIConfig } from '@/6-1-script-generator/hooks/useScriptAIConfig';
import { HeaderAndTab } from './section/HeaderAndTab';
import { SettingsSidebar } from './section/SettingsSidebar';
import { ApprovalAccessSection } from './section/ApprovalAccessSection';
import { ContentSchedulingSection } from './section/ContentSchedulingSection';
import { ScriptAIConfigSection } from './section/ScriptAIConfigSection';
import { DigitalAssetsSection } from './section/DigitalAssetsSection';
import { DetectFromImageSection } from './section/DetectFromImageSection';
import { ComingSoonSection } from './section/ComingSoonSection';
import { ApprovalAccessModal } from './modal/ApprovalAccessModal';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useSocialMediaSettingsApprovalAccess } from './hooks/useSocialMediaSettingsApprovalAccess';
import { useSettingsServicesQuery } from './hooks/useSettingsServicesQuery';
import {
  useDigitalAssetCharactersListQuery,
  useDigitalAssetObjectsListQuery,
  useDigitalAssetBrandColorsListQuery,
  useDigitalAssetCompanyLogosListQuery,
} from './hooks/useDigitalAssetsListQueries';
import { SocialMediaSettingsPageSkeleton } from './skeletons/SocialMediaSettingsPageSkeleton';
import { useSocialMediaSettingsPageSkeletonGate } from './hooks/useSocialMediaSettingsPageSkeletonGate';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useAppTranslation();
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();

  const { data: approvalData, isPending: approvalPending } = useSocialMediaSettingsApprovalAccess();
  const { isPending: servicesPending } = useSettingsServicesQuery();
  const { isPending: platformsPending } = useServiceRequiredPlatforms();
  const { isPending: scriptAiPending } = useScriptAIConfig();
  const { isPending: charactersPending } = useDigitalAssetCharactersListQuery();
  const { isPending: objectsPending } = useDigitalAssetObjectsListQuery();
  const { isPending: brandColorsPending } = useDigitalAssetBrandColorsListQuery();
  const { isPending: companyLogosPending } = useDigitalAssetCompanyLogosListQuery();

  const hasOrg = Boolean(organizationId);
  const rawPagePending =
    orgBootstrapPending ||
    (hasOrg &&
      (approvalPending ||
        servicesPending ||
        platformsPending ||
        scriptAiPending ||
        charactersPending ||
        objectsPending ||
        brandColorsPending ||
        companyLogosPending));

  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    rawPagePending,
    '/digital-marketing/social-media/settings',
  );
  const showPageSkeleton = useSocialMediaSettingsPageSkeletonGate(showFullPageSkeleton);

  const [activeSection, setActiveSection] = useState('approval-access');
  const [activeMainTab, setActiveMainTab] = useState('settings');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);

  const approvalConfigs = approvalData?.configs ?? [];
  const userRole = approvalData?.userRole ?? null;
  const isAdmin = ['owner', 'admin', 'hr'].includes(userRole || '');

  const invalidateApprovalAccess = () => {
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: ['social-media-settings-approval-access', organizationId] });
    }
  };

  const handleAddConfig = (success: boolean) => {
    if (success) {
      invalidateApprovalAccess();
      setIsModalOpen(false);
    }
  };

  const handleEditConfig = (success: boolean) => {
    if (success) {
      invalidateApprovalAccess();
      setIsEditModalOpen(false);
      setEditingConfig(null);
    }
  };

  const handleUpdateConfig = async (id: string, updates: any) => {
    try {
      const { error } = await (supabase as any)
        .from('approval_access_configurations')
        .update({
          is_active: updates.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Error updating config:', error);
        toast.error('Failed to update configuration');
        return;
      }

      invalidateApprovalAccess();
      toast.success('Configuration updated successfully');
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Failed to update configuration');
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      const { error } = await supabase.from('approval_access_configurations').delete().eq('id', id);

      if (error) {
        console.error('Error deleting config:', error);
        toast.error('Failed to delete configuration');
        return;
      }

      invalidateApprovalAccess();
      toast.success('Configuration deleted successfully');
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Failed to delete configuration');
    }
  };

  const handleTabChange = (newTab: string) => {
    setActiveMainTab(newTab);
    navigate(`/digital-marketing/social-media/${newTab}`);
  };

  const onNavigateToDetectImage = () => setActiveSection('detect-from-image');

  const renderContent = () => {
    switch (activeSection) {
      case 'approval-access':
        return (
          <ApprovalAccessSection
            approvalConfigs={approvalConfigs}
            isLoading={approvalPending}
            isAdmin={isAdmin}
            onAddConfig={() => setIsModalOpen(true)}
            onUpdateConfig={handleUpdateConfig}
            onDeleteConfig={handleDeleteConfig}
            onEditConfig={(config) => {
              setEditingConfig(config);
              setIsEditModalOpen(true);
            }}
          />
        );
      case 'scheduling':
        return <ContentSchedulingSection />;
      case 'asset-digital':
        return <DigitalAssetsSection onNavigateToDetectImage={onNavigateToDetectImage} />;
      case 'detect-from-image':
        return <DetectFromImageSection />;
      case 'script-ai':
        return <ScriptAIConfigSection />;
      default:
        return <ComingSoonSection />;
    }
  };

  const panelScrollClass =
    'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  return (
    <>
      <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-muted/40 font-sans">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
            <div className="flex h-full min-h-0 flex-col">
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="relative flex min-h-full flex-1 flex-col">
                  <div
                    className={
                      showPageSkeleton
                        ? 'invisible pointer-events-none flex min-h-full min-h-0 flex-1 flex-col'
                        : 'flex min-h-full min-h-0 flex-1 flex-col'
                    }
                    aria-hidden={showPageSkeleton}
                  >
                    <div className="mb-1 flex-shrink-0">
                      <HeaderAndTab activeMainTab={activeMainTab} handleTabChange={handleTabChange} />
                    </div>

                    <ModuleShellContentGate pagePath="/digital-marketing/social-media/settings">
                    <div className="grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-12 gap-2 items-stretch [grid-template-rows:minmax(0,1fr)] lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
                      <div className="col-span-12 flex min-h-0 flex-col overflow-hidden md:col-span-3 lg:h-full">
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[5px] border border-border bg-card shadow-sm lg:h-full">
                          <div className="flex-shrink-0 border-b border-border bg-primary/5 px-4 py-1.5">
                            <h3 className="text-sm font-semibold text-foreground">Pengaturan Social Media</h3>
                            <p className="mt-1 text-xs text-muted-foreground">Konfigurasi sistem social media</p>
                          </div>
                          <div className={`${panelScrollClass} p-3`}>
                            <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
                          </div>
                          <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Settings Overview</span>
                              <span className="text-xs text-primary/80">Real-time</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden md:col-span-9 lg:h-full">
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-full">
                          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[5px] border border-border bg-card shadow-sm lg:h-full">
                            <div className="flex-shrink-0 border-b border-border bg-primary/5 px-4 py-2">
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <h2 className="truncate text-sm font-semibold text-foreground">
                                    {activeSection === 'approval-access'
                                      ? 'Approval Access'
                                      : activeSection === 'scheduling'
                                        ? 'Content Scheduling'
                                        : activeSection === 'asset-digital'
                                          ? 'Digital Assets'
                                          : activeSection === 'detect-from-image'
                                            ? t('detectFromImage.title', 'Detect from Image')
                                            : activeSection === 'script-ai'
                                              ? 'Script AI Configuration'
                                              : 'Settings'}
                                  </h2>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {activeSection === 'approval-access'
                                      ? 'Manage approval access configurations'
                                      : activeSection === 'scheduling'
                                        ? 'Configure required platforms for content scheduling'
                                        : activeSection === 'asset-digital'
                                          ? 'Manage digital assets and media library'
                                          : activeSection === 'detect-from-image'
                                            ? t(
                                                'detectFromImage.description',
                                                'Analyze image with AI then save to Character or Object'
                                              )
                                            : activeSection === 'script-ai'
                                              ? 'Konfigurasi Google AI API untuk Script Generator'
                                              : 'Configure social media settings'}
                                  </p>
                                </div>
                                {activeSection === 'approval-access' && (
                                  <button
                                    type="button"
                                    onClick={() => setIsModalOpen(true)}
                                    disabled={approvalPending || !isAdmin}
                                    title={isAdmin ? undefined : 'Only admins can create configurations'}
                                    className="ml-4 flex flex-shrink-0 items-center gap-2 rounded-[5px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="24"
                                      height="24"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="h-4 w-4"
                                    >
                                      <path d="M5 12h14"></path>
                                      <path d="M12 5v14"></path>
                                    </svg>
                                    Add New Configuration
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className={panelScrollClass}>
                              <div className="p-4">{renderContent()}</div>
                            </div>

                            <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  Total Settings: <span className="font-medium text-foreground">1</span>
                                </span>
                                <span className="text-xs">
                                  Status:{' '}
                                  <span className="font-medium text-primary">Active</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    </ModuleShellContentGate>

                    <div
                      className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                      aria-hidden
                    />
                  </div>

                  {showPageSkeleton && (
                    <div
                      className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-muted/40"
                      aria-busy
                      aria-label="Memuat pengaturan social media"
                    >
                      <span className="sr-only">Memuat pengaturan social media</span>
                      <SocialMediaSettingsPageSkeleton mode="overlay" headerActiveTabId={activeMainTab} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ApprovalAccessModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleAddConfig} />

      <ApprovalAccessModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingConfig(null);
        }}
        onSave={handleEditConfig}
        editData={editingConfig}
      />
    </>
  );
};

export default SettingsPage;
