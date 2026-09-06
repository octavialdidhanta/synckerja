import { createContext, useContext, type ReactNode } from "react";

const PosAuthFunnelShellContext = createContext(false);

/** True when already inside {@link PosAuthFunnelLayout} (brand + viewport mounted). */
export function usePosAuthFunnelShell(): boolean {
  return useContext(PosAuthFunnelShellContext);
}

export function PosAuthFunnelShellProvider({ children }: { children: ReactNode }) {
  return (
    <PosAuthFunnelShellContext.Provider value={true}>{children}</PosAuthFunnelShellContext.Provider>
  );
}
