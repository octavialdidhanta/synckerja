import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PageAccessContentGate } from "@/shared/components/PageAccessContentGate";
import { cn } from "@/shared/lib/utils";

type ModuleShellContentGateProps = {
  children: ReactNode;
  /** Defaults to current `location.pathname`. */
  pagePath?: string;
  className?: string;
};

/**
 * Wraps module main content below HeaderAndTab (inside module shells).
 * Pair with {@link PageAccessGuard} `preserveAppChromeOnDeny` so sidebar/sub-sidebar stay visible.
 * Required on every page that shows HeaderAndTab with tab lock icons when access is denied.
 */
export function ModuleShellContentGate({ children, pagePath, className }: ModuleShellContentGateProps) {
  const { pathname } = useLocation();
  return (
    <PageAccessContentGate
      pagePath={pagePath ?? pathname}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
    >
      {children}
    </PageAccessContentGate>
  );
}
