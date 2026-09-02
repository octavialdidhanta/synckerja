import type { ReactNode } from 'react';
import { TemplateFollowupsPanelFooter } from './TemplateFollowupsPanelFooter';
import {
  TEMPLATE_FOLLOWUPS_FULL_COLUMN,
  TEMPLATE_FOLLOWUPS_MAIN_GRID,
  TEMPLATE_FOLLOWUPS_TABLE_SECTION,
} from './templateFollowupsLayout';

type Props = {
  children: ReactNode;
  toolbar?: ReactNode;
  count?: number;
};

export function TemplateFollowupsWorkspace({ children, toolbar, count }: Props) {
  return (
    <div className={TEMPLATE_FOLLOWUPS_MAIN_GRID}>
      <div className={TEMPLATE_FOLLOWUPS_FULL_COLUMN}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
          {toolbar}
          <div className={TEMPLATE_FOLLOWUPS_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              <TemplateFollowupsPanelFooter count={count} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
