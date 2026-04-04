import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useScriptAIConfig } from '@/6-1-script-generator/hooks/useScriptAIConfig';
import { generateScriptWithAI } from '@/6-1-script-generator/services/scriptGeneratorAIService';
import { buildProductKnowledgePrompt, type AudienceMode } from '../utils/buildProductKnowledgePrompt';
import { parseProductKnowledgeAiTable, type ProductKnowledgeAiRow } from '../utils/parseProductKnowledgeAiTable';
import { ProductKnowledgeAiResultTable } from './ProductKnowledgeAiResultTable';
import type { ProductKnowledge } from '../hooks/useProductKnowledge';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { Sparkles, FileText, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';

interface ProductKnowledgeGeneratePanelProps {
  productKnowledgeData: ProductKnowledge[];
  onAddAsNewRow: (aiRow: ProductKnowledgeAiRow) => void;
  /** Controlled state from parent (e.g. when opening modal from table row) */
  industri?: string;
  setIndustri?: (v: string) => void;
  promptModalOpen?: boolean;
  setPromptModalOpen?: (v: boolean) => void;
  editedPrompt?: string;
  setEditedPrompt?: (v: string) => void;
  defaultRowIdForAdd?: string | null;
  setDefaultRowIdForAdd?: (v: string | null) => void;
}

export const ProductKnowledgeGeneratePanel: React.FC<ProductKnowledgeGeneratePanelProps> = ({
  productKnowledgeData,
  onAddAsNewRow,
  industri: industriProp,
  setIndustri: setIndustriProp,
  promptModalOpen: promptModalOpenProp,
  setPromptModalOpen: setPromptModalOpenProp,
  editedPrompt: editedPromptProp,
  setEditedPrompt: setEditedPromptProp,
  defaultRowIdForAdd,
  setDefaultRowIdForAdd,
}) => {
  const { t } = useAppTranslation();
  const [industriInternal, setIndustriInternal] = useState('');
  const [segmenKonsumen, setSegmenKonsumen] = useState('');
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('B2B');
  const [promptModalOpenInternal, setPromptModalOpenInternal] = useState(false);
  const [editedPromptInternal, setEditedPromptInternal] = useState('');
  const industri = industriProp ?? industriInternal;
  const setIndustri = setIndustriProp ?? setIndustriInternal;
  const promptModalOpen = promptModalOpenProp ?? promptModalOpenInternal;
  const setPromptModalOpen = setPromptModalOpenProp ?? setPromptModalOpenInternal;
  const editedPrompt = editedPromptProp ?? editedPromptInternal;
  const setEditedPrompt = setEditedPromptProp ?? setEditedPromptInternal;
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiResultRows, setAiResultRows] = useState<ProductKnowledgeAiRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [showRawResponse, setShowRawResponse] = useState(false);

  const { data: aiConfig, isLoading: aiConfigLoading, isError: aiConfigError, refetch: refetchAiConfig } = useScriptAIConfig();

  const canGeneratePrompt = productKnowledgeData.some(
    (row) => row.feature_name?.trim() && row.feature_description?.trim()
  );
  const canGenerateAI = Boolean(
    (audienceMode === 'B2B' ? industri.trim() : segmenKonsumen.trim()) &&
    aiConfig?.is_active &&
    aiConfig?.api_key_configured
  );

  const handleGeneratePromptNoAI = () => {
    if (!canGeneratePrompt) {
      toast.error(t('productKnowledge.generate.fillFeatureFirst', 'Isi minimal Feature dan Feature Description di satu baris.'));
      return;
    }
    const contextValue = audienceMode === 'B2B' ? industri : segmenKonsumen;
    const prompt = buildProductKnowledgePrompt(audienceMode, contextValue, productKnowledgeData, defaultRowIdForAdd ?? undefined);
    setEditedPrompt(prompt);
    setDefaultRowIdForAdd?.(null);
    setPromptModalOpen(true);
    setParseError(null);
    setRawResponse(null);
    setAiResultRows([]);
  };

  const handleGenerateWithAI = async () => {
    if (!editedPrompt.trim()) {
      toast.error(t('productKnowledge.generate.promptEmpty', 'Prompt kosong.'));
      return;
    }
    const requiredFilled = audienceMode === 'B2B' ? industri.trim() : segmenKonsumen.trim();
    if (!requiredFilled) {
      toast.error(
        audienceMode === 'B2B'
          ? t('productKnowledge.generate.fillIndustri', 'Isi field Industri.')
          : t('productKnowledge.generate.fillSegmenKonsumen', 'Isi field Segmen konsumen.')
      );
      return;
    }
    if (!aiConfig?.is_active || !aiConfig?.api_key_configured) {
      toast.error(t('scriptGenerator.settings.configNotFound', 'Script AI belum dikonfigurasi. Buka Settings > Script AI Generator.'));
      return;
    }

    setIsGeneratingAI(true);
    setParseError(null);
    setRawResponse(null);
    setAiResultRows([]);

    try {
      const promptToSend =
        audienceMode === 'B2B'
          ? editedPrompt.replace(/\[ISI INDUSTRI\]/g, industri.trim() || '(tidak disebutkan)')
          : editedPrompt.replace(/\[SEGMEN KONSUMEN\]/g, segmenKonsumen.trim() || '(tidak disebutkan)');
      const result = await generateScriptWithAI(promptToSend);
      if (result.success && result.script) {
        setRawResponse(result.script);
        const rows = parseProductKnowledgeAiTable(result.script);
        if (rows.length >= 1) {
          setAiResultRows(rows);
          setParseError(null);
          toast.success(t('productKnowledge.generate.aiSuccess', 'Hasil AI berhasil di-parse. Pilih baris lalu "Add to Product Knowledge".'));
        } else {
          setParseError(
            t('productKnowledge.generate.parseError', 'Hasil AI tidak dalam format tabel yang diharapkan. Silakan edit prompt dan coba lagi.')
          );
          setAiResultRows([]);
        }
      } else {
        setParseError(result.error || t('productKnowledge.generate.aiFailed', 'Gagal generate dengan AI.'));
      }
    } catch (err) {
      console.error('Generate with AI error:', err);
      setParseError(err instanceof Error ? err.message : 'Unknown error');
      toast.error(t('productKnowledge.generate.aiFailed', 'Gagal generate dengan AI.'));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const hasGenerateResult = aiResultRows.length > 0 || parseError;

  const handleCloseSection = () => {
    setAiResultRows([]);
    setParseError(null);
    setRawResponse(null);
    setShowRawResponse(false);
  };

  return (
    <>
      {hasGenerateResult && (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-4 pb-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {t('productKnowledge.generate.title', 'Generate Analisis Masalah dengan AI')}
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCloseSection}
          className="flex-shrink-0 gap-1.5 text-gray-500 hover:text-gray-700"
          aria-label={t('common.close', 'Tutup')}
        >
          <X className="h-4 w-4" />
          {t('common.close', 'Tutup')}
        </Button>
      </div>

      <div className="p-4 pt-4 flex flex-col gap-4">

        {(!aiConfig?.is_active || !aiConfig?.api_key_configured) && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-amber-800">
              {aiConfigLoading && t('productKnowledge.generate.loadingConfig', 'Memuat konfigurasi AI...')}
              {!aiConfigLoading && aiConfigError && t('productKnowledge.generate.configError', 'Gagal memuat konfigurasi. Coba refresh.')}
              {!aiConfigLoading && !aiConfigError && !aiConfig && (
                <>
                  {t('productKnowledge.generate.configNotFound', 'Konfigurasi AI tidak ditemukan.')}{' '}
                  <Link to="/digital-marketing/social-media/settings" className="text-amber-700 hover:text-amber-900 font-medium underline">
                    Settings → Script AI Configuration
                  </Link>
                </>
              )}
              {!aiConfigLoading && !aiConfigError && aiConfig && !aiConfig.api_key_configured && t('productKnowledge.generate.apiKeyNotSet', 'API key belum dikonfigurasi di Settings.')}
              {!aiConfigLoading && !aiConfigError && aiConfig && !aiConfig.is_active && t('productKnowledge.generate.aiDisabled', 'Enable AI dimatikan di Settings.')}
            </span>
            {!aiConfigLoading && (
              <button
                type="button"
                onClick={() => refetchAiConfig()}
                className="text-sm text-amber-700 hover:text-amber-900 font-medium underline"
              >
                {t('productKnowledge.generate.refreshConfig', 'Refresh konfigurasi')}
              </button>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pk-generate-industri">
              {t('productKnowledge.generate.industri', 'Industri')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pk-generate-industri"
              value={industri}
              onChange={(e) => setIndustri(e.target.value)}
              placeholder={t('productKnowledge.generate.industriPlaceholder', 'Contoh: Event Organizer, F&B, Retail')}
              className="w-full"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGeneratePromptNoAI}
              disabled={!canGeneratePrompt}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {t('productKnowledge.generate.generatePromptNoAI', 'Generate prompt (tanpa AI)')}
            </Button>
          </div>
        </div>
      </div>

      {aiResultRows.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 px-4 pb-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">
            {t('productKnowledge.generate.resultTitle', 'Hasil Generate AI (3 opsi)')}
          </h4>
          <ProductKnowledgeAiResultTable
            rows={aiResultRows}
            onAddAsNewRow={onAddAsNewRow}
          />
        </div>
      )}

      {parseError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg mx-4 mb-4">
          <p className="text-sm text-red-800">{parseError}</p>
          {rawResponse && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowRawResponse((v) => !v)}
                className="text-xs text-red-700 hover:underline flex items-center gap-1"
              >
                {showRawResponse ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showRawResponse ? t('common.hide', 'Sembunyikan') : t('productKnowledge.generate.showRawResponse', 'Tampilkan respons mentah')}
              </button>
              {showRawResponse && (
                <pre className="mt-2 p-2 bg-white border border-red-200 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                  {rawResponse}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

    </div>
      )}

      <Dialog open={promptModalOpen} onOpenChange={(open) => setPromptModalOpen(!!open)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('productKnowledge.generate.promptModalTitle', 'Prompt untuk Generate dengan AI')}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500">
            {t('productKnowledge.generate.promptModalHint', 'Edit prompt jika perlu, lalu klik "Generate dengan AI".')}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-medium text-gray-700">
              {t('productKnowledge.generate.audienceModeLabel', 'Target:')}
            </span>
            <div className="flex rounded-md border border-gray-200 p-0.5 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setAudienceMode('B2B');
                  const prompt = buildProductKnowledgePrompt('B2B', industri, productKnowledgeData, defaultRowIdForAdd ?? undefined);
                  setEditedPrompt(prompt);
                }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                  audienceMode === 'B2B'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {t('productKnowledge.generate.audienceModeB2B', 'B2B')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAudienceMode('B2C');
                  const prompt = buildProductKnowledgePrompt('B2C', segmenKonsumen, productKnowledgeData, defaultRowIdForAdd ?? undefined);
                  setEditedPrompt(prompt);
                }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                  audienceMode === 'B2C'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {t('productKnowledge.generate.audienceModeB2C', 'B2C')}
              </button>
            </div>
          </div>
          <div className="space-y-2 flex-shrink-0">
            {audienceMode === 'B2B' ? (
              <>
                <Label htmlFor="pk-modal-industri">
                  {t('productKnowledge.generate.industri', 'Industri')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pk-modal-industri"
                  value={industri}
                  onChange={(e) => setIndustri(e.target.value)}
                  placeholder={t('productKnowledge.generate.industriPlaceholder', 'Contoh: Event Organizer, F&B, Retail')}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  {t('productKnowledge.generate.industriRequiredForAI', 'Isi Industri agar tombol Generate dengan AI aktif.')}
                </p>
              </>
            ) : (
              <>
                <Label htmlFor="pk-modal-segmen">
                  {t('productKnowledge.generate.segmenKonsumen', 'Segmen konsumen')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pk-modal-segmen"
                  value={segmenKonsumen}
                  onChange={(e) => setSegmenKonsumen(e.target.value)}
                  placeholder={t('productKnowledge.generate.segmenKonsumenPlaceholder', 'Contoh: young professionals, orang tua dengan anak')}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  {t('productKnowledge.generate.segmenKonsumenRequiredForAI', 'Isi Segmen konsumen agar tombol Generate dengan AI aktif.')}
                </p>
              </>
            )}
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="flex-1 min-h-[300px] font-mono text-sm whitespace-pre-wrap resize-none"
              placeholder="Prompt akan muncul di sini..."
            />
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setPromptModalOpen(false)}>
              {t('common.close', 'Tutup')}
            </Button>
            <Button
              onClick={handleGenerateWithAI}
              disabled={
                !(audienceMode === 'B2B' ? industri.trim() : segmenKonsumen.trim()) ||
                !aiConfig?.is_active ||
                !aiConfig?.api_key_configured ||
                !editedPrompt.trim() ||
                isGeneratingAI
              }
              className="gap-2"
            >
              {isGeneratingAI ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('productKnowledge.generate.generating', 'Generate...')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('productKnowledge.generate.generateWithAI', 'Generate dengan AI')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
