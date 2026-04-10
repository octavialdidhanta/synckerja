import type { ReactNode } from "react";

/** Wrapper opsional untuk konten profil (spacing atas). */
export function MobileProfileShell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-col gap-4">{children}</div>;
}
