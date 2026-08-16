import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { generateScript, type ScriptGeneratorRequest } from '../services/scriptGeneratorService';
import { generateScriptWithAI } from '../services/scriptGeneratorAIService';
import { useScriptAIConfig } from './useScriptAIConfig';
import {
  defaultModelForTextAIProvider,
  isTextAIConfigured,
  resolveTextAIProvider,
  textAIProviderLabel,
  type TextAIProvider,
} from '../utils/scriptAiTextProvider';

const SCRIPT_GENERATOR_DRAFT_KEY_PREFIX = 'synckerja-script-generator-draft';

export type ScriptGeneratorFormDataForPlan = {
  content_type_id?: string;
  service_id?: string;
  sub_service_id?: string;
  content_pillar_id?: string;
};

type DraftState = {
  generatedPrompt: string | null;
  aiGeneratedScript: string | null;
  lastFormDataForPlan: ScriptGeneratorFormDataForPlan | null;
  formPanelHidden: boolean;
};

function getDraftKey(organizationId: string): string {
  return `${SCRIPT_GENERATOR_DRAFT_KEY_PREFIX}-${organizationId}`;
}

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
      lastFormDataForPlan:
        parsed.lastFormDataForPlan && typeof parsed.lastFormDataForPlan === 'object'
          ? parsed.lastFormDataForPlan
          : null,
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

export function useScriptGeneratorSession() {
  const { t } = useAppTranslation();
  const { organizationId } = useOrgBootstrapPending();
  const draftAppliedRef = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [aiGeneratedScript, setAiGeneratedScript] = useState<string | null>(null);
  const [isSwitchingTextProvider, setIsSwitchingTextProvider] = useState(false);
  const [lastFormDataForPlan, setLastFormDataForPlan] = useState<ScriptGeneratorFormDataForPlan | null>(null);
  const [formPanelHidden, setFormPanelHidden] = useState(false);
  const {
    data: aiConfig,
    isPending: scriptAiPending,
    isError: aiConfigError,
    refetch: refetchAiConfig,
  } = useScriptAIConfig();

  const draftForPaint = organizationId && !draftAppliedRef.current ? loadDraft(organizationId) : null;
  const effectiveGeneratedPrompt = draftForPaint !== null ? draftForPaint.generatedPrompt : generatedPrompt;
  const effectiveAiGeneratedScript = draftForPaint !== null ? draftForPaint.aiGeneratedScript : aiGeneratedScript;
  const effectiveLastFormDataForPlan = draftForPaint !== null ? draftForPaint.lastFormDataForPlan : lastFormDataForPlan;
  const effectiveFormPanelHidden = draftForPaint !== null ? draftForPaint.formPanelHidden : formPanelHidden;

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

  useEffect(() => {
    if (!organizationId) return;
    saveDraft(
      {
        generatedPrompt,
        aiGeneratedScript,
        lastFormDataForPlan,
        formPanelHidden,
      },
      organizationId,
    );
  }, [organizationId, generatedPrompt, aiGeneratedScript, lastFormDataForPlan, formPanelHidden]);

  const handleGenerate = useCallback(async (data: ScriptGeneratorRequest): Promise<boolean> => {
    setIsGenerating(true);
    setGeneratedPrompt(null);
    setAiGeneratedScript(null);
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
        return true;
      }
      toast.error(result.error || 'Gagal generate prompt');
      return false;
    } catch (error) {
      console.error('Error generating script:', error);
      toast.error('Terjadi error saat generate prompt');
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleGenerateWithAI = useCallback(
    async (prompt: string): Promise<boolean> => {
      if (!prompt.trim()) {
        toast.error('Prompt kosong');
        return false;
      }
      if (!isTextAIConfigured(aiConfig)) {
        toast.error(
          t(
            'scriptGenerator.settings.configNotFound',
            'Script AI belum dikonfigurasi. Buka Settings > Script AI Generator.',
          ),
        );
        return false;
      }

      setIsGeneratingAI(true);
      setAiGeneratedScript(null);

      try {
        const result = await generateScriptWithAI(prompt);
        if (result.success && result.script) {
          setAiGeneratedScript(result.script);
          setFormPanelHidden(true);
          toast.success('Script berhasil di-generate oleh AI!');
          return true;
        }
        const msg = result.error || 'Gagal generate script dengan AI';
        const currentProvider = resolveTextAIProvider(aiConfig);
        const shouldOfferSwitch =
          currentProvider === 'groq' &&
          (msg.includes('Prompt terlalu besar untuk Groq') ||
            msg.toLowerCase().includes('tpm') ||
            msg.toLowerCase().includes('tokens per minute') ||
            msg.includes('Request terlalu besar'));
        toast.error(msg);
        return shouldOfferSwitch ? false : false;
      } catch (error) {
        console.error('Error generating script with AI:', error);
        toast.error('Terjadi error saat generate script dengan AI');
        return false;
      } finally {
        setIsGeneratingAI(false);
      }
    },
    [aiConfig, t],
  );

  const handleSetTextAIProvider = useCallback(
    async (next: TextAIProvider) => {
      if (!organizationId || !aiConfig) return;
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
    },
    [aiConfig, organizationId, refetchAiConfig],
  );

  return {
    organizationId,
    aiConfig,
    scriptAiPending,
    aiConfigError,
    refetchAiConfig,
    isGenerating,
    isGeneratingAI,
    isSwitchingTextProvider,
    generatedPrompt: effectiveGeneratedPrompt,
    aiGeneratedScript: effectiveAiGeneratedScript,
    lastFormDataForPlan: effectiveLastFormDataForPlan,
    formPanelHidden: effectiveFormPanelHidden,
    setFormPanelHidden,
    setAiGeneratedScript,
    handleGenerate,
    handleGenerateWithAI,
    handleSetTextAIProvider,
  };
}
