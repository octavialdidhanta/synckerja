import type { ReactNode } from 'react';
import { LeadMagnetPanelFooter } from './LeadMagnetPanelFooter';
import {
  LEAD_MAGNET_ANALYTICS_MAIN_COLUMN,
  LEAD_MAGNET_ANALYTICS_SIDEBAR_COLUMN,
  LEAD_MAGNET_FULL_COLUMN,
  LEAD_MAGNET_MAIN_GRID,
  LEAD_MAGNET_TABLE_SECTION,
} from '../lib/leadMagnetLayout';

type Props = {
  children: ReactNode;
  toolbar?: ReactNode;
  sidebar?: ReactNode;
  count?: number;
  sectionLabel?: string;
};

export function LeadMagnetWorkspace({ children, toolbar, sidebar, count, sectionLabel }: Props) {
  if (sidebar) {
    return (
      <div className={LEAD_MAGNET_MAIN_GRID}>
        <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
            {toolbar}
            <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
              <div className={LEAD_MAGNET_ANALYTICS_SIDEBAR_COLUMN}>
                <div className={LEAD_MAGNET_TABLE_SECTION}>{sidebar}</div>
              </div>
              <div className={LEAD_MAGNET_ANALYTICS_MAIN_COLUMN}>
                <div className={LEAD_MAGNET_TABLE_SECTION}>
                  <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
                    <LeadMagnetPanelFooter count={count} sectionLabel={sectionLabel} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={LEAD_MAGNET_MAIN_GRID}>
      <div className={LEAD_MAGNET_FULL_COLUMN}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
          {toolbar}
          <div className={LEAD_MAGNET_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              <LeadMagnetPanelFooter count={count} sectionLabel={sectionLabel} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
