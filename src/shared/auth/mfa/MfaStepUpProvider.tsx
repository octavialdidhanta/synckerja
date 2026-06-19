import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { checkAal2 } from "./requireAal2";
import { MfaChallengeDialog } from "./MfaChallengeDialog";

type StepUpResolver = {
  resolve: (ok: boolean) => void;
};

type MfaStepUpContextValue = {
  ensureAal2: () => Promise<boolean>;
};

const MfaStepUpContext = createContext<MfaStepUpContextValue | null>(null);

export function MfaStepUpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<StepUpResolver | null>(null);

  const ensureAal2 = useCallback(async (): Promise<boolean> => {
    const already = await checkAal2();
    if (already) return true;

    return new Promise<boolean>((resolve) => {
      resolverRef.current = { resolve };
      setOpen(true);
    });
  }, []);

  const handleVerified = useCallback(async () => {
    const ok = await checkAal2();
    resolverRef.current?.resolve(ok);
    resolverRef.current = null;
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next && resolverRef.current) {
      resolverRef.current.resolve(false);
      resolverRef.current = null;
    }
    setOpen(next);
  }, []);

  const value = useMemo(() => ({ ensureAal2 }), [ensureAal2]);

  return (
    <MfaStepUpContext.Provider value={value}>
      {children}
      <MfaChallengeDialog open={open} onOpenChange={handleOpenChange} onVerified={handleVerified} />
    </MfaStepUpContext.Provider>
  );
}

export function useMfaStepUp() {
  const ctx = useContext(MfaStepUpContext);
  if (!ctx) {
    throw new Error("useMfaStepUp must be used within MfaStepUpProvider");
  }
  return ctx;
}

/** Safe variant when provider may be absent (e.g. tests). */
export function useMfaStepUpOptional(): MfaStepUpContextValue | null {
  return useContext(MfaStepUpContext);
}
