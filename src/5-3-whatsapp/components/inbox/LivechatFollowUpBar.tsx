import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

type LivechatFollowUpBarProps = {
  disabled?: boolean;
  onOpen: () => void;
  compact?: boolean;
};

export function LivechatFollowUpBar({ disabled, onOpen, compact }: LivechatFollowUpBarProps) {
  const { t } = useAppTranslation();
  return (
    <Button
      type="button"
      size="lg"
      className={cn(
        'w-full gap-2 font-semibold shadow-sm',
        compact ? 'min-h-[44px] text-base' : 'min-h-[48px]',
      )}
      disabled={disabled}
      onClick={onOpen}
    >
      <MessageSquarePlus className="h-5 w-5 shrink-0" aria-hidden />
      {t('whatsappInbox.followUp.button', 'Follow-up')}
    </Button>
  );
}
