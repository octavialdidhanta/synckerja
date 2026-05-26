import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';

type ToolsMobileDenyGateAreaProps = {
  pagePath: string;
  /** e.g. `content-padding-above-nav-daily-task` */
  contentPaddingClass: string;
  children?: ReactNode;
};

/**
 * Flex chain for full-height {@link AccessDeniedContentPanel} on mobile tools routes.
 */
export function ToolsMobileDenyGateArea({ pagePath, contentPaddingClass, children }: ToolsMobileDenyGateAreaProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="scrollbar-hide nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-h-full min-w-0 w-full flex-1 flex-col">
          <div
            className={cn(
              contentPaddingClass,
              'mx-auto flex min-w-0 w-full max-w-md flex-1 flex-col space-y-1 px-2 pt-2',
            )}
          >
            <ModuleShellContentGate pagePath={pagePath} className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
              {children ?? null}
            </ModuleShellContentGate>
          </div>
        </div>
      </div>
    </div>
  );
}
