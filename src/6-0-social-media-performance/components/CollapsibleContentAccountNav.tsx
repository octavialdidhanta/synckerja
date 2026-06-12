import { useCallback, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { cn } from "@/shared/lib/utils";

function readCollapsedPreference(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

type CollapsibleContentAccountNavProps = {
  storageKey: string;
  sectionLabel: string;
  collapseLabel: string;
  expandLabel: string;
  settingsLabel: string;
  accounts: ReactNode;
  settingsActive?: boolean;
  onSettingsSelect?: () => void;
  className?: string;
};

export function CollapsibleContentAccountNav({
  storageKey,
  sectionLabel,
  collapseLabel,
  expandLabel,
  settingsLabel,
  accounts,
  settingsActive,
  onSettingsSelect,
  className,
}: CollapsibleContentAccountNavProps) {
  const [collapsed, setCollapsed] = useState(() => readCollapsedPreference(storageKey));

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, [storageKey]);

  return (
    <div
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-gray-50/80 transition-[width] duration-200 ease-in-out",
        collapsed ? "w-14" : "w-[180px]",
        className,
      )}
    >
      <div
        className={cn(
          collapsed ? "flex justify-center px-1 py-2" : "border-b border-gray-200/80 px-3 py-3",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
            aria-label={expandLabel}
            title={expandLabel}
          >
            <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between gap-1">
              <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {sectionLabel}
              </p>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
                aria-label={collapseLabel}
                title={collapseLabel}
              >
                <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            </div>
            <div className="space-y-1">{accounts}</div>
          </>
        )}
      </div>

      {onSettingsSelect ? (
        <div
          className={cn(
            "mt-auto border-t border-gray-200/80",
            collapsed ? "flex justify-center px-1 py-2" : "px-3 py-3",
          )}
        >
          <button
            type="button"
            title={settingsLabel}
            className={cn(
              "flex items-center rounded-md text-sm transition-colors",
              collapsed ? "h-9 w-9 justify-center p-0" : "w-full gap-2 px-2 py-1.5 text-left",
              settingsActive
                ? "bg-gray-200/80 font-medium text-gray-900"
                : "text-gray-700 hover:bg-gray-100",
            )}
            onClick={onSettingsSelect}
          >
            <Settings className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
            {!collapsed ? settingsLabel : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}
