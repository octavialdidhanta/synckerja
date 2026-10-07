import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bold, List, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useToast } from '@/shared/components/ui/use-toast';
import {
  isDescriptionEmpty,
  isSafeDescriptionHref,
  linkifyDescriptionElement,
  linkifyPlainTextToHtml,
  sanitizeTaskStepDescriptionHtml,
  toEditorHtml,
} from '@/8-2-DailyTask/lib/taskStepDescription';
import {
  handleDescriptionListKeyDown,
  normalizeDescriptionLists,
  removeUnorderedListAtSelection,
} from '@/8-2-DailyTask/lib/taskStepDescriptionLists';
import { uploadTaskStepDescriptionImage } from '@/8-2-DailyTask/services/taskStepDescriptionImageService';

type TaskStepDescriptionEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  stepId?: string | null;
  organizationId: string;
  placeholder?: string;
  minHeight?: string;
  /** Stretch the writing area to the parent height so existing notes stay on screen. */
  fill?: boolean;
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
  fill = false,
}: TaskStepDescriptionEditorProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const lastSyncedValue = useRef<string>('');
  const listEditFromKeyDown = useRef(false);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    normalizeDescriptionLists(el);
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
    normalizeDescriptionLists(el);
    linkifyDescriptionElement(el);
    lastSyncedValue.current = sanitizeTaskStepDescriptionHtml(el.innerHTML);
  }, [value]);

  const runFormatBlock = useCallback(
    (tag: 'p' | 'h1' | 'h2' | 'h3') => {
      if (disabled) return;
      editorRef.current?.focus();
      document.execCommand('formatBlock', false, tag);
      emitChange();
    },
    [disabled, emitChange],
  );

  const runCommand = useCallback(
    (command: string) => {
      if (disabled) return;
      editorRef.current?.focus();
      document.execCommand(command, false);
      emitChange();
    },
    [disabled, emitChange],
  );

  const toggleBulletList = useCallback(() => {
    if (disabled) return;
    const root = editorRef.current;
    root?.focus();
    if (root && removeUnorderedListAtSelection(root)) {
      emitChange();
      return;
    }
    runCommand('insertUnorderedList');
  }, [disabled, emitChange, runCommand]);

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const root = editorRef.current;
      if (!root) return;
      if (!handleDescriptionListKeyDown(event, root)) return;
      if (event.key === 'Backspace') listEditFromKeyDown.current = true;
      emitChange();
      queueMicrotask(() => {
        listEditFromKeyDown.current = false;
      });
    },
    [emitChange],
  );

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType !== 'deleteContentBackward') return;
      if (listEditFromKeyDown.current) {
        event.preventDefault();
        return;
      }
      if (
        !handleDescriptionListKeyDown(
          {
            key: 'Backspace',
            shiftKey: false,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            preventDefault() {},
          },
          el,
        )
      ) {
        return;
      }
      event.preventDefault();
      emitChange();
    };
    el.addEventListener('beforeinput', onBeforeInput);
    return () => el.removeEventListener('beforeinput', onBeforeInput);
  }, [emitChange]);

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
      const hasHtml = Boolean(event.clipboardData?.types.includes('text/html'));
      if (plain && (hasHtml || /https?:\/\//i.test(plain))) {
        event.preventDefault();
        const html = plain
          .split(/\n{2,}/)
          .map((paragraph) => `<p>${linkifyPlainTextToHtml(paragraph)}</p>`)
          .join('');
        insertHtmlAtSelection(html || '<p><br></p>');
        emitChange();
      }
    },
    [disabled, emitChange, handlePasteImage],
  );

  const showPlaceholder = isDescriptionEmpty(value) && uploadingCount === 0;

  return (
    <div className={cn('space-y-1.5', fill && 'flex min-h-0 flex-1 flex-col')}>
      <div
        className={cn(
          'overflow-hidden border border-input bg-background',
          fill ? 'flex min-h-0 flex-1 flex-col rounded-none border-x-0' : 'rounded-md',
        )}
      >
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
            className="h-7 min-w-7 px-1.5 text-[10px] font-bold"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runFormatBlock('h1')}
            title={t('dailyTask.stepDescription.heading1', 'Heading 1')}
          >
            H1
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 min-w-7 px-1.5 text-[10px] font-bold"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runFormatBlock('h2')}
            title={t('dailyTask.stepDescription.heading2', 'Heading 2')}
          >
            H2
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 min-w-7 px-1.5 text-[10px] font-bold"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runFormatBlock('h3')}
            title={t('dailyTask.stepDescription.heading3', 'Heading 3')}
          >
            H3
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleBulletList}
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
        <div className={cn('relative', fill && 'min-h-0 flex-1')}>
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
            onKeyDown={handleEditorKeyDown}
            onPaste={(e) => void handlePaste(e)}
            onMouseDown={(event) => {
              if (disabled || event.button !== 0) return;
              const el = editorRef.current;
              if (!el || !/https?:\/\//i.test(el.innerText)) return;
              linkifyDescriptionElement(el);
              const hit = document.elementFromPoint(event.clientX, event.clientY);
              const anchor = hit instanceof Element ? hit.closest('a') : null;
              if (!anchor || !el.contains(anchor)) return;
              const href = anchor.getAttribute('href') ?? '';
              if (!isSafeDescriptionHref(href)) return;
              event.preventDefault();
              event.stopPropagation();
              window.open(href, '_blank', 'noopener,noreferrer');
            }}
            onBlur={() => {
              const el = editorRef.current;
              if (el) linkifyDescriptionElement(el);
              emitChange();
            }}
            className={cn(
              minHeight,
              fill ? 'h-full max-h-none min-h-[280px]' : 'max-h-[280px]',
              'task-step-desc-editor scrollbar-hide seamless-scroll nested-scroll-touch-chain w-full overflow-y-auto overflow-x-hidden text-sm outline-none',
              fill ? 'px-2 py-3' : 'p-3',
              '[&_p]:mb-2 [&_p:last-child]:mb-0',
              '[&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:leading-snug',
              '[&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:leading-snug',
              '[&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:leading-snug',
              fill
                ? '[&_img]:my-3 [&_img]:w-full [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border'
                : '[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          />
        </div>
      </div>
      <p className={cn('text-[11px] text-muted-foreground', fill && 'px-4 sm:px-6')}>
        {t(
          'dailyTask.stepDescription.pasteHint',
          'Paste images between paragraphs (Ctrl+V). Max 5 MB per image.',
        )}
      </p>
    </div>
  );
}
