import type { ReactNode } from 'react';
import { OmnichannelContactPanelFooter } from './OmnichannelContactPanelFooter';
import {
  OMNICHANNEL_CONTACT_FULL_COLUMN,
  OMNICHANNEL_CONTACT_MAIN_GRID,
  OMNICHANNEL_CONTACT_TABLE_SECTION,
} from './omnichannelContactLayout';

type Props = {
  children: ReactNode;
  toolbar?: ReactNode;
  count?: number;
};

export function OmnichannelContactWorkspace({ children, toolbar, count }: Props) {
  return (
    <div className={OMNICHANNEL_CONTACT_MAIN_GRID}>
      <div className={OMNICHANNEL_CONTACT_FULL_COLUMN}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
          {toolbar}
          <div className={OMNICHANNEL_CONTACT_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              <OmnichannelContactPanelFooter count={count} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
