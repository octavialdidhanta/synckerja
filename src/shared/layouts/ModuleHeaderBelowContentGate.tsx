import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { cn } from "@/shared/lib/utils";

type ModuleHeaderBelowContentGateProps = {
  header: ReactNode;
  children: ReactNode;
  /** Defaults to current `location.pathname`. */
  pagePath?: string;
  className?: string;
};

/**
 * Place module HeaderAndTab in `header`; main panel in `children`.
 * Use with {@link PageAccessGuard} `preserveAppChromeOnDeny` so locks on tabs
 * block content only, not sidebar or tabs.
 */
export function ModuleHeaderBelowContentGate({
  header,
  children,
  pagePath,
  className,
}: ModuleHeaderBelowContentGateProps) {
  const { pathname } = useLocation();

  return (
    <>
      <div className="mb-1 flex-shrink-0">{header}</div>
      <ModuleShellContentGate
        pagePath={pagePath ?? pathname}
        className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
      >
        {children}
      </ModuleShellContentGate>
    </>
  );
}
