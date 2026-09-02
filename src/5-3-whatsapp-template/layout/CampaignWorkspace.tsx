import type { ReactNode } from 'react';
import { CampaignPanelFooter } from './CampaignPanelFooter';
import {
  CAMPAIGN_CREATE_FORM_COLUMN,
  CAMPAIGN_CREATE_PREVIEW_COLUMN,
  CAMPAIGN_FULL_COLUMN,
  CAMPAIGN_MAIN_GRID,
  CAMPAIGN_TABLE_SECTION,
} from './campaignLayout';

type Props = {
  children: ReactNode;
  toolbar?: ReactNode;
  aside?: ReactNode;
  count?: number;
  sectionLabel: string;
};

export function CampaignWorkspace({ children, toolbar, aside, count, sectionLabel }: Props) {
  if (aside) {
    return (
      <div className={CAMPAIGN_MAIN_GRID}>
        <div className={CAMPAIGN_CREATE_FORM_COLUMN}>
          <div className={CAMPAIGN_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              <CampaignPanelFooter count={count} sectionLabel={sectionLabel} />
            </div>
          </div>
        </div>
        <div className={CAMPAIGN_CREATE_PREVIEW_COLUMN}>
          <div className={CAMPAIGN_TABLE_SECTION}>{aside}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={CAMPAIGN_MAIN_GRID}>
      <div className={CAMPAIGN_FULL_COLUMN}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
          {toolbar}
          <div className={CAMPAIGN_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              <CampaignPanelFooter count={count} sectionLabel={sectionLabel} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
