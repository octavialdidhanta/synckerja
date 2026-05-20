import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useLivechatResolveActionsBridge } from './livechatResolveBridge';

/** Resolve control for desktop chat thread header (actions from Quick Action panel). */
export function LivechatResolveHeaderButton({ conversationId }: { conversationId: string }) {
  const actions = useLivechatResolveActionsBridge();
  if (!actions || actions.conversationId !== conversationId) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0">
          <Button
            type="button"
            size="sm"
            variant={actions.isResolved ? 'outline' : 'default'}
            className="min-w-[5.5rem]"
            disabled={actions.resolveButtonDisabled}
            onClick={actions.handleResolveClick}
          >
            {actions.resolveButtonLabel}
          </Button>
        </span>
      </TooltipTrigger>
      {actions.resolveButtonDisabled && actions.sessionLockedTitle ? (
        <TooltipContent side="bottom" className="max-w-[240px] text-xs">
          {actions.sessionLockedTitle}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}
