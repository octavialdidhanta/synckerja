import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Copy, Download, Check, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface ScriptResultProps {
  script: string;
  onGenerateWithAI?: (prompt: string) => Promise<void>;
  isGeneratingAI?: boolean;
  isAIConfigured?: boolean;
  /** Mobile: title di atas, aksi Copy / Download / Generate satu baris. */
  layout?: 'desktop' | 'mobile';
}

export const ScriptResult: React.FC<ScriptResultProps> = ({
  script,
  onGenerateWithAI,
  isGeneratingAI = false,
  isAIConfigured = false,
  layout = 'desktop',
}) => {
  const { t } = useAppTranslation();
  const [copied, setCopied] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(script);

  useEffect(() => {
    setEditedPrompt(script);
  }, [script]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedPrompt);
      setCopied(true);
      toast.success('Prompt berhasil disalin ke clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Gagal menyalin prompt');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([editedPrompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-prompt-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Prompt berhasil diunduh');
  };

  const handleGenerateWithAI = () => {
    if (onGenerateWithAI && editedPrompt.trim()) {
      onGenerateWithAI(editedPrompt);
    }
  };

  const canGenerateAI = isAIConfigured && editedPrompt.trim().length > 0 && !isGeneratingAI;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div
        className={
          layout === 'mobile'
            ? 'flex shrink-0 flex-col gap-2'
            : 'flex flex-shrink-0 flex-wrap items-center justify-between gap-2'
        }
      >
        <h3 className={layout === 'mobile' ? 'text-base font-semibold' : 'text-lg font-semibold'}>
          {t('scriptGenerator.promptTitle', 'Prompt untuk Generate Script')}
        </h3>
        <div
          className={
            layout === 'mobile'
              ? 'flex min-w-0 flex-nowrap items-center gap-1.5'
              : 'flex flex-wrap gap-2'
          }
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className={layout === 'mobile' ? 'h-8 shrink-0 px-2' : undefined}
          >
            {copied ? (
              <>
                <Check className={`h-4 w-4 ${layout === 'mobile' ? 'mr-1' : 'mr-2'}`} />
                {layout === 'mobile' ? 'Copied' : 'Copied!'}
              </>
            ) : (
              <>
                <Copy className={`h-4 w-4 ${layout === 'mobile' ? 'mr-1' : 'mr-2'}`} />
                Copy
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className={layout === 'mobile' ? 'h-8 shrink-0 px-2' : undefined}
          >
            <Download className={`h-4 w-4 ${layout === 'mobile' ? 'mr-1' : 'mr-2'}`} />
            Download
          </Button>
          {onGenerateWithAI && (
            <Button
              size="sm"
              onClick={handleGenerateWithAI}
              disabled={!canGenerateAI}
              className={layout === 'mobile' ? 'h-8 min-w-0 flex-1 px-2' : undefined}
              title={
                !isAIConfigured
                  ? t('scriptGenerator.settings.configNotFound', 'Script AI belum dikonfigurasi. Buka Settings > Script AI Generator.')
                  : !editedPrompt.trim()
                  ? 'Prompt kosong'
                  : undefined
              }
            >
              {isGeneratingAI ? (
                <>
                  <Loader2 className={`h-4 w-4 shrink-0 animate-spin ${layout === 'mobile' ? 'mr-1' : 'mr-2'}`} />
                  <span className="truncate">{layout === 'mobile' ? 'Generate' : 'Generating...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className={`h-4 w-4 shrink-0 ${layout === 'mobile' ? 'mr-1' : 'mr-2'}`} />
                  <span className="truncate">
                    {t('scriptGenerator.generateWithAI')}
                  </span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        <p className="flex-shrink-0 text-xs text-gray-500">{t('scriptGenerator.promptEditHint', 'Edit prompt untuk QC sebelum kirim ke AI (opsional):')}</p>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <Textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="absolute inset-0 h-full min-h-0 w-full resize-none overflow-y-auto whitespace-pre-wrap font-mono text-sm [field-sizing:fixed]"
            placeholder="Prompt akan muncul di sini..."
          />
        </div>
      </div>
    </div>
  );
};
