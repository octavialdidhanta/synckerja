import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';

type ManageCommentsInlineEditComposerProps = {
  initialText: string;
  disabled?: boolean;
  isSubmitting?: boolean;
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
};

export function ManageCommentsInlineEditComposer({
  initialText,
  disabled,
  isSubmitting,
  onSubmit,
  onCancel,
}: ManageCommentsInlineEditComposerProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSubmit =
    Boolean(text.trim()) && text.trim() !== initialText.trim() && !isSubmitting && !disabled;

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        disabled={disabled || isSubmitting}
        className="min-h-[36px] resize-none rounded-2xl bg-gray-100 py-2 text-sm"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={!canSubmit}
          onClick={() => void onSubmit(text.trim())}
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            t('digitalMarketing.manageComments.saveEdit', 'Save')
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          {t('digitalMarketing.manageComments.cancelEdit', 'Cancel')}
        </Button>
      </div>
    </div>
  );
}
