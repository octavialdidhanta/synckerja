import { useCallback, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  filterMentionCandidates,
  getActiveMentionQuery,
  insertMention,
} from '../lib/commentMentionUtils';
import type { MentionableEmployee } from '../types';

interface TaskStepCommentComposerProps {
  placeholder?: string;
  submitLabel?: string;
  initialValue?: string;
  employees: MentionableEmployee[];
  disabled?: boolean;
  isSubmitting?: boolean;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
}

export function TaskStepCommentComposer({
  placeholder,
  submitLabel,
  initialValue = '',
  employees,
  disabled,
  isSubmitting,
  autoFocus,
  onSubmit,
  onCancel,
}: TaskStepCommentComposerProps) {
  const { t } = useAppTranslation();
  const [text, setText] = useState(initialValue);
  const [caret, setCaret] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeMention = getActiveMentionQuery(text, caret);
  const mentionCandidates = activeMention
    ? filterMentionCandidates(employees, activeMention.query)
    : [];

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || isSubmitting) return;
    await onSubmit(trimmed);
    setText('');
    setCaret(0);
  }, [text, disabled, isSubmitting, onSubmit]);

  const pickMention = (employee: MentionableEmployee) => {
    const { nextText, nextCaret } = insertMention(text, caret, employee);
    setText(nextText);
    setCaret(nextCaret);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={text}
          disabled={disabled || isSubmitting}
          autoFocus={autoFocus}
          rows={3}
          className="min-h-[72px] resize-none text-xs"
          placeholder={placeholder ?? t('dailyTask.stepComments.composerPlaceholder', 'Write a comment… Use @ to mention')}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />
        {mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-0 z-30 mb-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-white shadow-md">
            {mentionCandidates.map((emp) => (
              <button
                key={emp.profileId}
                type="button"
                className="flex w-full flex-col px-2 py-1.5 text-left text-xs hover:bg-muted/60"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(emp);
                }}
              >
                <span className="font-medium text-gray-900">{emp.fullName}</span>
                {emp.email && <span className="text-[10px] text-gray-500">{emp.email}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            {t('common.cancel', 'Cancel')}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || isSubmitting || !text.trim()}
          onClick={() => void handleSubmit()}
        >
          {submitLabel ?? t('dailyTask.stepComments.post', 'Post')}
        </Button>
      </div>
    </div>
  );
}
