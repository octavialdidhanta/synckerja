import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Loader2, FileText } from 'lucide-react';
import { useProductKnowledgeStyle, type ProductKnowledgeStyle } from '@/6-1-product-knowledge/hooks/useProductKnowledgeStyle';

interface RevisiModalProps {
  open: boolean;
  onClose: () => void;
  originalText: string;
  sectionLabel?: string;
  onConfirm: (instruction: string) => Promise<void>;
  isRevising?: boolean;
}

export const RevisiModal: React.FC<RevisiModalProps> = ({
  open,
  onClose,
  originalText,
  sectionLabel,
  onConfirm,
  isRevising = false,
}) => {
  const { t } = useAppTranslation();
  const [instruction, setInstruction] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const modalContentRef = useRef<HTMLDivElement>(null);

  const { data: styles = [], isLoading: stylesLoading } = useProductKnowledgeStyle();

  useEffect(() => {
    if (open) {
      setInstruction('');
      setSelectedStyleId('');
    }
  }, [open]);

  // Saat memilih style, isi otomatis kolom Instruksi revisi dengan kalimat teknik komunikasi + timing
  useEffect(() => {
    if (!open) return;
    if (selectedStyleId) {
      setInstruction(t('scriptGenerator.revisi.defaultInstructionWithStyle', 'Pada baris ini pastikan menggunakan teknik komunikasi dari style yang dipilih, pastikan juga kalimat harus sesuai timing saat di ucapkan.'));
    } else {
      setInstruction('');
    }
  }, [open, selectedStyleId, t]);

  const selectedStyle: ProductKnowledgeStyle | undefined = selectedStyleId
    ? styles.find((s) => s.id === selectedStyleId)
    : undefined;

  const buildInstruction = (): string => {
    const trimmed = instruction.trim();
    if (!selectedStyle) return trimmed;
    const parts: string[] = [];
    if (trimmed) parts.push(trimmed);
    parts.push('');
    parts.push(t('scriptGenerator.revisi.applyStylePrefix', 'Gunakan style dari Product Knowledge:'));
    parts.push(`${t('scriptGenerator.revisi.styleName', 'Nama')}: ${selectedStyle.name}`);
    if (selectedStyle.description) {
      parts.push(`${t('scriptGenerator.revisi.styleDescription', 'Deskripsi')}: ${selectedStyle.description}`);
    }
    if (selectedStyle.structure) {
      parts.push(`${t('scriptGenerator.revisi.styleStructure', 'Struktur')}: ${selectedStyle.structure}`);
    }
    return parts.join('\n');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalInstruction = buildInstruction().trim();
    if (!finalInstruction) return;
    try {
      await onConfirm(finalInstruction);
      onClose();
    } catch {
      // Parent handles error (toast); modal stays open for retry
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        ref={modalContentRef}
        className="!flex flex-col overflow-hidden rounded-lg"
        style={{
          zIndex: 999999,
          width: 'min(42rem, 90vh, 96vw)',
          height: 'min(42rem, 90vh, 96vw)',
          maxWidth: '96vw',
          maxHeight: '90vh',
        }}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {t('scriptGenerator.revisi.modalTitle', 'Revisi bagian ini')}
            {sectionLabel ? ` - ${sectionLabel}` : ''}
          </DialogTitle>
          <DialogDescription>
            {t('scriptGenerator.revisi.modalDescription', 'Ketik instruksi revisi. AI akan merevisi hanya bagian yang dipilih.')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll space-y-4 pr-1">
          <div className="revisi-modal-style-wrapper w-full space-y-2" role="group" aria-labelledby="revisi-style-label">
            <label id="revisi-style-label" className="text-sm font-medium">
              {t('scriptGenerator.revisi.styleLabel', 'Style (opsional)')}
            </label>
            <Select
              value={selectedStyleId || 'none'}
              onValueChange={(v) => setSelectedStyleId(v === 'none' ? '' : v)}
              disabled={stylesLoading || isRevising}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('scriptGenerator.revisi.stylePlaceholder', 'Pilih style dari Product Knowledge')} />
              </SelectTrigger>
              <SelectContent
                className="w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] max-h-[min(50vh, 300px)] z-[9999999] p-0 [&_[data-radix-select-viewport]]:p-0 overflow-hidden"
                position="popper"
                sideOffset={4}
                align="start"
                collisionPadding={12}
                collisionBoundary={modalContentRef.current ?? undefined}
              >
                <SelectItem value="none" className="py-2.5 border-b border-border/60 rounded-none">
                  {t('scriptGenerator.revisi.styleNone', 'Tidak pakai style')}
                </SelectItem>
                <SelectSeparator className="my-0 h-px bg-border shrink-0" />
                {styles.map((style, index) => (
                  <React.Fragment key={style.id}>
                    <SelectItem
                      value={style.id}
                      className={`min-w-0 py-2.5 border-b border-border/60 rounded-none ${index === styles.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <span className="whitespace-normal break-words block text-left w-full pr-2">{style.name}</span>
                    </SelectItem>
                    {index < styles.length - 1 && (
                      <SelectSeparator className="my-0 h-px bg-border shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
            {selectedStyle && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <FileText className="h-4 w-4 shrink-0" />
                  {t('scriptGenerator.revisi.styleDetailTitle', 'Detail style')}
                </div>
                <p className="font-medium text-foreground">{selectedStyle.name}</p>
                {selectedStyle.description && (
                  <p className="text-muted-foreground whitespace-pre-wrap">{selectedStyle.description}</p>
                )}
                {selectedStyle.structure && (
                  <>
                    <p className="font-medium text-foreground mt-2">{t('scriptGenerator.revisi.styleStructure', 'Struktur')}:</p>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-background/50 p-2 rounded border overflow-x-auto max-h-[120px] overflow-y-auto">
                      {selectedStyle.structure}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('scriptGenerator.revisi.instructionLabel', 'Instruksi revisi')}
            </label>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t('scriptGenerator.revisi.instructionPlaceholder', 'Contoh: buat lebih singkat, tambah contoh, ubah tone jadi lebih formal')}
              className="min-h-[80px]"
              disabled={isRevising}
              required={!selectedStyle}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('scriptGenerator.revisi.originalPreview', 'Teks yang akan direvisi')}
            </label>
            <pre className="text-xs p-3 rounded-md border bg-muted/50 max-h-[120px] overflow-y-auto whitespace-pre-wrap">
              {originalText || '-'}
            </pre>
          </div>
          </div>

          <DialogFooter className="flex-shrink-0 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isRevising}>
              {t('common.cancel', 'Batal')}
            </Button>
            <Button type="submit" disabled={isRevising || (!instruction.trim() && !selectedStyle)}>
              {isRevising ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('scriptGenerator.revisi.revising', 'Merevisi...')}
                </>
              ) : (
                t('scriptGenerator.revisi.button', 'Revisi')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
