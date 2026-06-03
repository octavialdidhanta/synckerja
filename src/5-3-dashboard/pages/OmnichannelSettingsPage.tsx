import { HeaderAndTab } from "@/5-3-dashboard/components/layout/HeaderAndTab";
import { OmnichannelSettingsWorkspace } from "@/5-3-dashboard/omnichannel-settings/components/layout/OmnichannelSettingsWorkspace";

/**
 * `/omnichannel/settings/:section` — dedicated omnichannel configuration area (not Social Media Management).
 * Shell follows seamless scroll baseline used under `AppShellLayout` (see CRM / recipient-list pages).
 */
export function OmnichannelSettingsPage() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-2 pb-2 sm:px-4">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="relative flex min-h-full w-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <OmnichannelSettingsWorkspace />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
