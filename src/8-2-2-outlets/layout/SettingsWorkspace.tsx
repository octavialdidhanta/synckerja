import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { SettingsItemNav } from "../components/SettingsItemNav";
import { SettingsPanelFooter } from "./SettingsPanelFooter";
import {
  SETTINGS_MAIN_GRID,
  SETTINGS_PANEL_BODY,
  SETTINGS_TABLE_SECTION,
} from "./settingsLayout";

export function SettingsWorkspace({ children }: { children: ReactNode }) {
  return (
    <div className={SETTINGS_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className={SETTINGS_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
              <SettingsItemNav />
              <div className={cn(SETTINGS_PANEL_BODY, "px-4 py-6")}>{children}</div>
            </div>
            <SettingsPanelFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
