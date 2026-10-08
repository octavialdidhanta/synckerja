import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HeaderAndTabActionsHostContext = createContext<HTMLElement | null>(null);

/** Host for controls rendered beside the Digital Marketing title. */
export function useHeaderAndTabActionsHost() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const slot = <div ref={setHost} className="flex items-center gap-2" />;
  return { host, slot };
}

export function HeaderAndTabActionsProvider({
  host,
  children,
}: {
  host: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <HeaderAndTabActionsHostContext.Provider value={host}>
      {children}
    </HeaderAndTabActionsHostContext.Provider>
  );
}

export function HeaderAndTabActionsPortal({ children }: { children: ReactNode }) {
  const host = useContext(HeaderAndTabActionsHostContext);
  if (!host) return null;
  return createPortal(children, host);
}
