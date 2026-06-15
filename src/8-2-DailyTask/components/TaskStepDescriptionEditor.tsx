import { useCallback, useEffect, useRef, useState } from 'react';
import { Bold, List, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useToast } from '@/shared/components/ui/use-toast';
import {
  isDescriptionEmpty,
  sanitizeTaskStepDescriptionHtml,
  toEditorHtml,
} from '@/8-2-DailyTask/lib/taskStepDescription';
import { uploadTaskStepDescriptionImage } from '@/8-2-DailyTask/services/taskStepDescriptionImageService';

type TaskStepDescriptionEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  stepId?: string | null;
  organizationId: string;
  placeholder?: string;
  minHeight?: string;
};

function insertHtmlAtSelection(html: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const template = document.createElement('template');
  template.innerHTML = html;
  const frag = template.content;
  const lastNode = frag.lastChild;
  range.insertNode(frag);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function TaskStepDescriptionEditor({
  value,
  onChange,
  disabled = false,
  stepId,
  organizationId,
  placeholder,
  minHeight = 'min-h-[180px]',
}: TaskStepDescriptionEditorProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const lastSyncedValue = useRef<string>('');

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = sanitizeTaskStepDescriptionHtml(el.innerHTML);
    lastSyncedValue.current = html;
    onChange(html);
  }, [onChange]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const next = toEditorHtml(value);
    if (next === lastSyncedValue.current && el.innerHTML === next) return;
    if (document.activeElement === el) return;
    el.innerHTML = next;
    lastSyncedValue.current = next;
  }, [value]);

  const runCommand = useCallback(
    (command: string) => {
      if (disabled) return;
      editorRef.current?.focus();
      document.execCommand(command, false);
      emitChange();
    },
    [disabled, emitChange],
  );

  const handlePasteImage = useCallback(
    async (file: File | Blob) => {
      if (disabled || !organizationId) return;
      setUploadingCount((c) => c + 1);
      try {
        const { publicUrl } = await uploadTaskStepDescriptionImage({
          file,
          stepId,
          organizationId,
        });
        editorRef.current?.focus();
        insertHtmlAtSelection(
          `<p><img src="${publicUrl}" alt="" class="task-step-desc-image" loading="lazy" /></p>`,
        );
        emitChange();
      } catch (e) {
        toast({
          title: t('dailyTask.stepDescription.uploadFailed', 'Failed to upload image'),
          description: e instanceof Error ? e.message : String(e),
          variant: 'destructive',
        });
        throw e;
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1));
      }
    },
    [disabled, organizationId, stepId, emitChange, toast, t],
  );

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const blob = item.getAsFile();
            if (blob) {
              try {
                await handlePasteImage(blob);
              } catch {
                // caller may toast
              }
            }
            return;
          }
        }
      }

      const plain = event.clipboardData?.getData('text/plain');
      if (plain && event.clipboardData?.types.includes('text/html')) {
        event.preventDefault();
        const escaped = plain
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const html = escaped
          .split(/\n{2,}/)
          .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
        insertHtmlAtSelection(html || '<p><br></p>');
        emitChange();
      }
    },
    [disabled, emitChange, handlePasteImage],
  );

  const showPlaceholder = isDescriptionEmpty(value) && uploadingCount === 0;

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-md border border-input bg-background">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1 py-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCommand('bold')}
            title={t('dailyTask.stepDescription.bold', 'Bold')}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCommand('insertUnorderedList')}
            title={t('dailyTask.stepDescription.bulletList', 'Bullet list')}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          {uploadingCount > 0 ? (
            <span className="ml-auto flex items-center gap-1 px-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('dailyTask.stepDescription.uploading', 'Uploading image…')}
            </span>
          ) : null}
        </div>
        <div className="relative">
          {showPlaceholder ? (
            <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
              {placeholder ??
                t(
                  'dailyTask.stepDescription.placeholder',
                  'Add more details about this step… Paste images between paragraphs (Ctrl+V).',
                )}
            </span>
          ) : null}
          <div
            ref={editorRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            spellCheck
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            onInput={emitChange}
            onPaste={(e) => void handlePaste(e)}
            onBlur={emitChange}
            className={cn(
              minHeight,
              'scrollbar-hide seamless-scroll nested-scroll-touch-chain max-h-[280px] w-full overflow-y-auto overflow-x-hidden p-3 text-sm outline-none',
              '[&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-6 [&_ul]:pl-6',
              '[&_p]:mb-2 [&_p:last-child]:mb-0',
              '[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t(
          'dailyTask.stepDescription.pasteHint',
          'Paste images between paragraphs (Ctrl+V). Max 5 MB per image.',
        )}
      </p>
    </div>
  );
}
