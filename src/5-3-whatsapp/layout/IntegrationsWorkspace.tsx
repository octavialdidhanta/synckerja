import type { ReactNode } from 'react';
import { IntegrationsPanelFooter } from './IntegrationsPanelFooter';
import {
  INTEGRATIONS_COLUMNS_DEFAULT,
  INTEGRATIONS_FULL_COLUMN,
  INTEGRATIONS_MAIN_GRID,
  INTEGRATIONS_TABLE_SECTION,
} from './integrationsLayout';

type Props = {
  left: ReactNode;
  children: ReactNode;
  count?: number;
  sectionLabel: string;
  columnsClassName?: string;
};

export function IntegrationsWorkspace({
  left,
  children,
  count,
  sectionLabel,
  columnsClassName,
}: Props) {
  return (
    <div className={INTEGRATIONS_MAIN_GRID}>
      <div className={INTEGRATIONS_FULL_COLUMN}>
        <div className={columnsClassName ?? INTEGRATIONS_COLUMNS_DEFAULT}>
          <div className={INTEGRATIONS_TABLE_SECTION}>{left}</div>
          <div className={INTEGRATIONS_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              <IntegrationsPanelFooter count={count} sectionLabel={sectionLabel} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
