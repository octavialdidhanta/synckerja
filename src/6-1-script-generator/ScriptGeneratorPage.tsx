import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { HeaderAndTab } from '@/6-1-content-calendar/container/HeaderAndTab';
import { RealtimeSocialMediaProvider } from '@/6-1-dashboard/hook/RealtimeSocialMediaProvider';
import OptimizedErrorBoundary from '@/6-1-dashboard/components/OptimizedErrorBoundary';
import { PICFilterProvider } from '@/6-1-dashboard/context/PICFilterContext';
import { ScriptGeneratorForm } from './components/ScriptGeneratorForm';
import { ScriptResult } from './components/ScriptResult';
import { AIScriptResult } from './components/AIScriptResult';
import { generateScript, ScriptGeneratorRequest } from './services/scriptGeneratorService';
import { generateScriptWithAI } from './services/scriptGeneratorAIService';
import { toast } from 'sonner';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useScriptAIConfig } from './hooks/useScriptAIConfig';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import { useScriptGeneratorFormMasterData } from './hooks/useScriptGeneratorFormMasterData';
import { useProductKnowledge } from '@/6-1-product-knowledge/hooks/useProductKnowledge';
import { useProductKnowledgeDetail } from '@/6-1-product-knowledge/hooks/useProductKnowledgeDetail';
import { useProductKnowledgeStyle } from '@/6-1-product-knowledge/hooks/useProductKnowledgeStyle';
import { useProductKnowledgeHooks } from '@/6-1-product-knowledge/hooks/useProductKnowledgeHooks';
import { useKeywords } from '@/6-1-product-knowledge/hooks/useKeywords';
import { ScriptGeneratorPageSkeleton } from './skeletons/ScriptGeneratorPageSkeleton';
import { useScriptGeneratorPageSkeletonGate } from './hooks/useScriptGeneratorPageSkeletonGate';
import { Button } from '@/shared/components/ui/button';
import {
  defaultModelForTextAIProvider,
  isTextAIConfigured,
  resolveTextAIProvider,
  textAIProviderLabel,
  type TextAIProvider,
} from '@/6-1-script-generator/utils/scriptAiTextProvider';

const SCRIPT_GENERATOR_DRAFT_KEY_PREFIX = 'synckerja-script-generator-draft';

function getDraftKey(organizationId: string): string {
  return `${SCRIPT_GENERATOR_DRAFT_KEY_PREFIX}-${organizationId}`;
}

type DraftState = {
  generatedPrompt: string | null;
  aiGeneratedScript: string | null;
  lastFormDataForPlan: { content_type_id?: string; service_id?: string; sub_service_id?: string; content_pillar_id?: string } | null;
  formPanelHidden: boolean;
};

function loadDraft(organizationId: string | null | undefined): DraftState | null {
  if (!organizationId || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(getDraftKey(organizationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftState;
    if (!parsed || (typeof parsed.generatedPrompt !== 'string' && parsed.generatedPrompt !== null)) return null;
    if (typeof parsed.aiGeneratedScript !== 'string' && parsed.aiGeneratedScript !== null) return null;
    return {
      generatedPrompt: parsed.generatedPrompt ?? null,
      aiGeneratedScript: parsed.aiGeneratedScript ?? null,
      lastFormDataForPlan: parsed.lastFormDataForPlan && typeof parsed.lastFormDataForPlan === 'object' ? parsed.lastFormDataForPlan : null,
      formPanelHidden: !!parsed.formPanelHidden,
    };
  } catch {
    return null;
  }
}

function saveDraft(state: DraftState, organizationId: string | null | undefined) {
  if (!organizationId || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(getDraftKey(organizationId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

const ScriptGeneratorContent: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const draftAppliedRef = useRef(false);
  const [activeMainTab, setActiveMainTab] = useState('script-generator');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [aiGeneratedScript, setAiGeneratedScript] = useState<string | null>(null);
  const [isSwitchingTextProvider, setIsSwitchingTextProvider] = useState(false);
  const [lastFormDataForPlan, setLastFormDataForPlan] = useState<{
    content_type_id?: string;
    service_id?: string;
    sub_service_id?: string;
    content_pillar_id?: string;
  } | null>(null);
  const [formPanelHidden, setFormPanelHidden] = useState(false);
  const { isPending: masterPending } = useScriptGeneratorFormMasterData();
  const { isPending: productKnowledgePending } = useProductKnowledge();
  const { isPending: productKnowledgeDetailPending } = useProductKnowledgeDetail();
  const { isPending: stylePending } = useProductKnowledgeStyle();
  const { isPending: hooksPending } = useProductKnowledgeHooks();
  const { isPending: keywordsPending } = useKeywords();
  const {
    data: aiConfig,
    isPending: scriptAiPending,
    isError: aiConfigError,
    refetch: refetchAiConfig,
  } = useScriptAIConfig();

  const hasOrg = Boolean(organizationId);
  const rawPagePending =
    orgLoading ||
    (hasOrg &&
      (masterPending ||
        productKnowledgePending ||
        productKnowledgeDetailPending ||
        stylePending ||
        hooksPending ||
        keywordsPending ||
        scriptAiPending));

  const showPageSkeleton = useScriptGeneratorPageSkeletonGate(rawPagePending);
  // Use draft synchronously for first paint when org is ready but effect hasn't run yet (removes refresh flicker)
  const draftForPaint = organizationId && !draftAppliedRef.current ? loadDraft(organizationId) : null;
  const effectiveGeneratedPrompt = draftForPaint !== null ? draftForPaint.generatedPrompt : generatedPrompt;
  const effectiveAiGeneratedScript = draftForPaint !== null ? draftForPaint.aiGeneratedScript : aiGeneratedScript;
  const effectiveLastFormDataForPlan = draftForPaint !== null ? draftForPaint.lastFormDataForPlan : lastFormDataForPlan;
  const effectiveFormPanelHidden = draftForPaint !== null ? draftForPaint.formPanelHidden : formPanelHidden;

  // Saat organisasi berubah (termasuk pertama kali load): muat draft untuk org tersebut; isolasi data per org
  useEffect(() => {
    if (!organizationId) {
      draftAppliedRef.current = false;
      setGeneratedPrompt(null);
      setAiGeneratedScript(null);
      setLastFormDataForPlan(null);
      setFormPanelHidden(false);
      return;
    }
    const draft = loadDraft(organizationId);
    setGeneratedPrompt(draft?.generatedPrompt ?? null);
    setAiGeneratedScript(draft?.aiGeneratedScript ?? null);
    setLastFormDataForPlan(draft?.lastFormDataForPlan ?? null);
    setFormPanelHidden(draft?.formPanelHidden ?? false);
    draftAppliedRef.current = true;
  }, [organizationId]);

  // Simpan draft ke sessionStorage per organisasi (hanya bila org aktif)
  useEffect(() => {
    if (!organizationId) return;
    saveDraft(
      {
        generatedPrompt,
        aiGeneratedScript,
        lastFormDataForPlan,
        formPanelHidden,
      },
      organizationId
    );
  }, [organizationId, generatedPrompt, aiGeneratedScript, lastFormDataForPlan, formPanelHidden]);

  const handleTabChange = (newTab: string) => {
    setActiveMainTab(newTab);
    navigate(`/digital-marketing/social-media/${newTab}`);
  };

  const handleGenerate = async (data: ScriptGeneratorRequest) => {
    setIsGenerating(true);
    setGeneratedPrompt(null);
    setAiGeneratedScript(null);
    // Store form data for Save to Plan auto-fill
    setLastFormDataForPlan({
      content_type_id: data.content_type_id,
      service_id: data.service_id,
      sub_service_id: data.sub_service_id,
      content_pillar_id: data.content_pillar_id,
    });

    try {
      const result = await generateScript(data);

      if (result.success && result.script) {
        setGeneratedPrompt(result.script);
        toast.success('Prompt berhasil di-generate!');
      } else {
        toast.error(result.error || 'Gagal generate prompt');
      }
    } catch (error) {
      console.error('Error generating script:', error);
      toast.error('Terjadi error saat generate prompt');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateWithAI = async (prompt: string) => {
    if (!prompt.trim()) {
      toast.error('Prompt kosong');
      return;
    }
    const isConfigured = isTextAIConfigured(aiConfig);
    if (!isConfigured) {
      toast.error(
        t('scriptGenerator.settings.configNotFound', 'Script AI belum dikonfigurasi. Buka Settings > Script AI Generator.')
      );
      return;
    }

    setIsGeneratingAI(true);
    setAiGeneratedScript(null);

    try {
      const result = await generateScriptWithAI(prompt);

      if (result.success && result.script) {
        setAiGeneratedScript(result.script);
        setFormPanelHidden(true);
        toast.success('Script berhasil di-generate oleh AI!');
      } else {
        const msg = result.error || 'Gagal generate script dengan AI';
        const currentProvider = resolveTextAIProvider(aiConfig);
        const shouldOfferSwitch =
          currentProvider === 'groq' &&
          (msg.includes('Prompt terlalu besar untuk Groq') ||
            msg.toLowerCase().includes('tpm') ||
            msg.toLowerCase().includes('tokens per minute') ||
            msg.includes('Request terlalu besar'));

        if (shouldOfferSwitch) {
          toast.error(msg);
          return;
        }
        toast.error(msg);
      }
    } catch (error) {
      console.error('Error generating script with AI:', error);
      toast.error('Terjadi error saat generate script dengan AI');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSetTextAIProvider = async (next: TextAIProvider) => {
    if (!organizationId) return;
    if (!aiConfig) return;
    setIsSwitchingTextProvider(true);
    try {
      const { error } = await supabase
        .from('organization_script_ai_config')
        .update({
          text_ai_provider: next,
          is_active: true,
          model: defaultModelForTextAIProvider(next),
        })
        .eq('organization_id', organizationId);
      if (error) throw error;
      await refetchAiConfig();
      toast.success(`Text AI Provider diubah ke ${textAIProviderLabel(next)}.`);
    } catch (e) {
      console.error('switch text ai provider:', e);
      toast.error('Gagal mengubah provider. Coba lagi.');
    } finally {
      setIsSwitchingTextProvider(false);
    }
  };

  const panelScrollClass =
    'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
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
                  <HeaderAndTab
                    activeMainTab={activeMainTab}
                    handleTabChange={handleTabChange}
                  />
                </div>

                {/* Desktop: tinggi pita tetap + isi panel scroll di dalam; mobile: stack + scroll halaman */}
                <div
                  className={`grid w-full min-w-0 flex-1 grid-cols-1 gap-2 min-h-[calc(100vh-120px)] items-stretch lg:max-h-[calc(100vh-120px)] lg:overflow-hidden lg:grid-rows-1 lg:[grid-template-rows:minmax(0,1fr)] ${
                    effectiveFormPanelHidden
                      ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]'
                      : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.33fr)]'
                  }`}
                >
                  {!effectiveFormPanelHidden && (
                    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:h-full">
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:h-full">
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
                  )}

                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:h-full">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:h-full">
                      {effectiveFormPanelHidden && (
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
                          effectiveGeneratedPrompt
                            ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4'
                            : `${panelScrollClass}`
                        }
                      >
                        {effectiveGeneratedPrompt ? (
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
                            {(() => {
                              const isConfigured = isTextAIConfigured(aiConfig);
                              return !isConfigured;
                            })() ? (
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
                                script={effectiveGeneratedPrompt}
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

                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:h-full">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:h-full">
                      <div className={panelScrollClass}>
                        <div className="w-full min-w-0 px-4 pb-4 pt-4">
                          {effectiveAiGeneratedScript ? (
                            <AIScriptResult
                              script={effectiveAiGeneratedScript}
                              formDataForPlan={effectiveLastFormDataForPlan}
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
                    </div>
                  </div>
                </div>

                <div
                  className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                  aria-hidden
                />
                </div>

                {showPageSkeleton && (
                  <div
                    className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-gray-100"
                    aria-busy
                    aria-label="Memuat script generator"
                  >
                    <span className="sr-only">Memuat script generator</span>
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

// Main export with providers
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
