import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { HeaderAndTab } from '@/6-1-content-calendar/container/HeaderAndTab';
import { RealtimeSocialMediaProvider } from '@/6-1-dashboard/hook/RealtimeSocialMediaProvider';
import OptimizedErrorBoundary from '@/6-1-dashboard/components/OptimizedErrorBoundary';
import { PICFilterProvider } from '@/6-1-dashboard/context/PICFilterContext';
import { ScriptGeneratorForm } from './components/ScriptGeneratorForm';
import { ScriptResult } from './components/ScriptResult';
import { AIScriptResult } from './components/AIScriptResult';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useScriptGeneratorFormMasterData } from './hooks/useScriptGeneratorFormMasterData';
import { useProductKnowledge } from '@/6-1-product-knowledge/hooks/useProductKnowledge';
import { useProductKnowledgeDetail } from '@/6-1-product-knowledge/hooks/useProductKnowledgeDetail';
import { useProductKnowledgeStyle } from '@/6-1-product-knowledge/hooks/useProductKnowledgeStyle';
import { useProductKnowledgeHooks } from '@/6-1-product-knowledge/hooks/useProductKnowledgeHooks';
import { useKeywords } from '@/6-1-product-knowledge/hooks/useKeywords';
import { ScriptGeneratorPageSkeleton } from './skeletons/ScriptGeneratorPageSkeleton';
import { useScriptGeneratorPageSkeletonGate } from './hooks/useScriptGeneratorPageSkeletonGate';
import { ScriptGeneratorWorkspace } from './layout/ScriptGeneratorWorkspace';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { Button } from '@/shared/components/ui/button';
import {
  isTextAIConfigured,
  resolveTextAIProvider,
  textAIProviderLabel,
} from '@/6-1-script-generator/utils/scriptAiTextProvider';
import { useScriptGeneratorSession } from './hooks/useScriptGeneratorSession';

const ScriptGeneratorContent: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const [activeMainTab, setActiveMainTab] = useState('script-generator');
  const {
    aiConfig,
    scriptAiPending,
    aiConfigError,
    refetchAiConfig,
    isGenerating,
    isGeneratingAI,
    isSwitchingTextProvider,
    generatedPrompt,
    aiGeneratedScript,
    lastFormDataForPlan,
    formPanelHidden,
    setFormPanelHidden,
    setAiGeneratedScript,
    handleGenerate,
    handleGenerateWithAI,
    handleSetTextAIProvider,
  } = useScriptGeneratorSession();
  const { isPending: masterPending } = useScriptGeneratorFormMasterData();
  const { isPending: productKnowledgePending } = useProductKnowledge();
  const { isPending: productKnowledgeDetailPending } = useProductKnowledgeDetail();
  const { isPending: stylePending } = useProductKnowledgeStyle();
  const { isPending: hooksPending } = useProductKnowledgeHooks();
  const { isPending: keywordsPending } = useKeywords();

  const hasOrg = Boolean(organizationId);
  const rawPagePending =
    orgBootstrapPending ||
    (hasOrg &&
      (masterPending ||
        productKnowledgePending ||
        productKnowledgeDetailPending ||
        stylePending ||
        hooksPending ||
        keywordsPending ||
        scriptAiPending));

  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    rawPagePending,
    '/digital-marketing/social-media/script-generator',
  );
  const showPageSkeleton = useScriptGeneratorPageSkeletonGate(showFullPageSkeleton);

  const handleTabChange = (newTab: string) => {
    setActiveMainTab(newTab);
    navigate(`/digital-marketing/social-media/${newTab}`);
  };

  const panelScrollClass =
    'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="relative flex min-h-full flex-1 flex-col bg-muted/40">
                <div
                  className={
                    showPageSkeleton
                      ? 'invisible pointer-events-none flex min-h-full min-h-0 flex-1 flex-col'
                      : 'flex min-h-full min-h-0 flex-1 flex-col'
                  }
                  aria-hidden={showPageSkeleton}
                >
                <div className="mb-1 flex-shrink-0">
                  <HeaderAndTab
                    activeMainTab={activeMainTab}
                    handleTabChange={handleTabChange}
                  />
                </div>

                <ModuleShellContentGate pagePath="/digital-marketing/social-media/script-generator">
                <ScriptGeneratorWorkspace
                  formHidden={formPanelHidden}
                  count={aiGeneratedScript ? 1 : 0}
                  formPanel={
                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                        <div className="flex flex-shrink-0 items-center border-b border-gray-200 bg-gray-50 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setFormPanelHidden(true)}
                            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800"
                            title={t('scriptGenerator.hideForm', 'Sembunyikan form')}
                          >
                            <PanelLeftClose className="h-4 w-4" />
                            {t('scriptGenerator.hideForm', 'Sembunyikan Form')}
                          </button>
                        </div>
                        <div className={panelScrollClass}>
                          <div className="w-full min-w-0 p-4">
                            <ScriptGeneratorForm
                              onGenerate={handleGenerate}
                              isGenerating={isGenerating}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                  promptPanel={
                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                      {formPanelHidden && (
                        <div className="flex flex-shrink-0 items-center border-b border-gray-200 bg-gray-50 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setFormPanelHidden(false)}
                            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                            title={t('scriptGenerator.showForm', 'Tampilkan form')}
                          >
                            <PanelLeftOpen className="h-4 w-4" />
                            {t('scriptGenerator.showForm', 'Tampilkan Form')}
                          </button>
                        </div>
                      )}
                      <div
                        className={
                          generatedPrompt
                            ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4'
                            : `${panelScrollClass}`
                        }
                      >
                        {generatedPrompt ? (
                          <div className="flex min-h-0 flex-1 flex-col gap-2">
                            {aiConfig && (
                              <div className="flex flex-shrink-0 flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                                <span className="text-sm text-gray-700">
                                  Text AI Provider:{' '}
                                  <span className="font-medium">{textAIProviderLabel(resolveTextAIProvider(aiConfig))}</span>
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {(['gemini', 'groq', 'fireworks'] as const).map((p) => {
                                    const selected = resolveTextAIProvider(aiConfig) === p;
                                    return (
                                      <Button
                                        key={p}
                                        type="button"
                                        size="sm"
                                        variant={selected ? 'default' : 'outline'}
                                        className="h-8 px-3"
                                        disabled={isSwitchingTextProvider}
                                        onClick={() => handleSetTextAIProvider(p)}
                                      >
                                        {textAIProviderLabel(p)}
                                      </Button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {!isTextAIConfigured(aiConfig) ? (
                              <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <span className="text-sm text-amber-800">
                                  {scriptAiPending && 'Memuat konfigurasi AI...'}
                                  {!scriptAiPending && aiConfigError && 'Gagal memuat konfigurasi. Coba refresh.'}
                                  {!scriptAiPending && !aiConfigError && !aiConfig && (
                                    <>
                                      Konfigurasi AI tidak ditemukan. Pastikan organisasi aktif benar (jika punya banyak org). Lalu buka{' '}
                                      <Link
                                        to="/digital-marketing/social-media/settings"
                                        className="font-medium text-amber-700 underline hover:text-amber-900"
                                      >
                                        Settings → Script AI Generator
                                      </Link>
                                      .
                                    </>
                                  )}
                                  {!scriptAiPending &&
                                    !aiConfigError &&
                                    aiConfig &&
                                    resolveTextAIProvider(aiConfig) === 'gemini' &&
                                    !aiConfig.api_key_configured &&
                                    'API key Gemini belum dikonfigurasi di Settings (dibutuhkan jika provider Text AI = Gemini).'}
                                </span>
                                {!scriptAiPending && (
                                  <button
                                    type="button"
                                    onClick={() => refetchAiConfig()}
                                    className="text-sm font-medium text-amber-700 underline hover:text-amber-900"
                                  >
                                    Refresh konfigurasi
                                  </button>
                                )}
                              </div>
                            ) : null}
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                              <ScriptResult
                                script={generatedPrompt}
                                onGenerateWithAI={handleGenerateWithAI}
                                isGeneratingAI={isGeneratingAI}
                                isAIConfigured={isTextAIConfigured(aiConfig)}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full min-w-0 p-4">
                            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                              <p className="text-sm text-gray-500">
                                Prompt akan muncul di sini setelah Anda mengisi form dan klik &quot;Generate Script&quot;
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    </div>
                  }
                  resultPanel={
                    <div className={panelScrollClass}>
                      <div className="w-full min-w-0 px-4 pb-4 pt-4">
                        {aiGeneratedScript ? (
                          <AIScriptResult
                            script={aiGeneratedScript}
                            formDataForPlan={lastFormDataForPlan}
                            onScriptChange={setAiGeneratedScript}
                          />
                        ) : (
                          <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                            <p className="text-sm text-gray-500">
                              {t(
                                'scriptGenerator.aiEmptyState',
                                'Hasil script dari AI akan muncul di sini setelah Anda QC prompt di panel tengah dan klik "Generate dengan AI"'
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  }
                />
                </ModuleShellContentGate>
                </div>

                {showPageSkeleton && (
                  <div
                    className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-gray-100"
                    aria-busy
                    aria-label={t('scriptGenerator.loadingAria', 'Loading script generator')}
                  >
                    <span className="sr-only">{t('scriptGenerator.loadingAria', 'Loading script generator')}</span>
                    <ScriptGeneratorPageSkeleton mode="overlay" headerActiveTabId={activeMainTab} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ScriptGeneratorPage = () => {
  return (
    <OptimizedErrorBoundary>
      <RealtimeSocialMediaProvider>
        <PICFilterProvider>
          <ScriptGeneratorContent />
        </PICFilterProvider>
      </RealtimeSocialMediaProvider>
    </OptimizedErrorBoundary>
  );
};

export default ScriptGeneratorPage;
