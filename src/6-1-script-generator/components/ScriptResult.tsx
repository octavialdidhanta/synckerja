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
}

export const ScriptResult: React.FC<ScriptResultProps> = ({
  script,
  onGenerateWithAI,
  isGeneratingAI = false,
  isAIConfigured = false,
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
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex justify-between items-center flex-wrap gap-2 flex-shrink-0">
        <h3 className="text-lg font-semibold">{t('scriptGenerator.promptTitle', 'Prompt untuk Generate Script')}</h3>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          {onGenerateWithAI && (
            <Button
              size="sm"
              onClick={handleGenerateWithAI}
              disabled={!canGenerateAI}
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t('scriptGenerator.generateWithAI')}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 gap-1 overflow-hidden">
        <p className="text-xs text-gray-500 flex-shrink-0">{t('scriptGenerator.promptEditHint', 'Edit prompt untuk QC sebelum kirim ke AI (opsional):')}</p>
        <div className="flex-1 min-h-0 overflow-hidden">
          <Textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="h-full min-h-0 font-mono text-sm whitespace-pre-wrap resize-none overflow-y-auto"
            placeholder="Prompt akan muncul di sini..."
          />
        </div>
      </div>
    </div>
  );
};
