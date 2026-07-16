import type { ReactNode } from 'react';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { LeadMagnetHeaderAndTab } from '../container/LeadMagnetHeaderAndTab';
import { LeadMagnetContentGate } from './LeadMagnetContentGate';
import { LEAD_MAGNET_BASE_PATH } from '../lib/leadMagnetPaths';

type LeadMagnetPageShellProps = {
  children: ReactNode;
};

/**
 * AppShell child: header ikut scroll lewat scroll container AppShell (tanpa nested scroll / fixed height).
 */
export function LeadMagnetPageShell({ children }: LeadMagnetPageShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/40">
          <div className="mb-1 flex-shrink-0">
            <LeadMagnetHeaderAndTab />
          </div>

          <ModuleShellContentGate pagePath={LEAD_MAGNET_BASE_PATH}>
            <LeadMagnetContentGate>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
            </LeadMagnetContentGate>
          </ModuleShellContentGate>
        </div>
      </div>
    </div>
  );
}
