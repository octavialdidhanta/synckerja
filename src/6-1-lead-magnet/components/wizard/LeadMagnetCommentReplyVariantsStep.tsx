import { useTranslation } from 'react-i18next';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import {
  COMMENT_REPLY_SLOT_COUNT,
  hasDuplicateCommentReplies,
  syncCommentReplyLegacyMirror,
  type CommentReplyTextsTuple,
} from '../../lib/commentReplyVariants';
import type { LeadMagnetCampaignForm } from '../../types/leadMagnet.types';

const COMMENT_REPLY_DEFAULT_KEYS = [
  'leadMagnet.wizard.commentReplyDefault1',
  'leadMagnet.wizard.commentReplyDefault2',
  'leadMagnet.wizard.commentReplyDefault3',
] as const;

type LeadMagnetCommentReplyVariantsStepProps = {
  enabled: boolean;
  texts: CommentReplyTextsTuple;
  onChange: (patch: Pick<LeadMagnetCampaignForm, 'comment_reply_enabled' | 'comment_reply_texts' | 'comment_reply_text'>) => void;
};

export function LeadMagnetCommentReplyVariantsStep({
  enabled,
  texts,
  onChange,
}: LeadMagnetCommentReplyVariantsStepProps) {
  const { t } = useTranslation();
  const showDuplicateWarning = enabled && hasDuplicateCommentReplies(texts);

  const setEnabled = (checked: boolean) => {
    onChange({ comment_reply_enabled: checked });
  };

  const setSlot = (index: number, value: string) => {
    const next = [...texts] as CommentReplyTextsTuple;
    next[index] = value;
    onChange({
      comment_reply_texts: next,
      comment_reply_text: syncCommentReplyLegacyMirror(next),
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="comment-reply-enabled" className="cursor-pointer text-sm font-medium">
          {t('leadMagnet.wizard.commentReplyToggle')}
        </Label>
        <Switch
          id="comment-reply-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      {enabled ? (
        <>
          <p className="text-xs text-muted-foreground">{t('leadMagnet.wizard.commentReplyUniqueHint')}</p>
          <div className="space-y-2">
            {Array.from({ length: COMMENT_REPLY_SLOT_COUNT }, (_, index) => (
              <div key={index} className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {t('leadMagnet.wizard.commentReplySlot', { n: index + 1 })}
                </Label>
                <Input
                  value={texts[index] ?? ''}
                  onChange={(e) => setSlot(index, e.target.value)}
                  placeholder={t(COMMENT_REPLY_DEFAULT_KEYS[index])}
                />
              </div>
            ))}
          </div>
          {showDuplicateWarning ? (
            <p className="text-xs text-amber-700">{t('leadMagnet.wizard.validation.commentReplyDuplicate')}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
