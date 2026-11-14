import type { QueryClient } from "@tanstack/react-query";
import type { MutableRefObject } from "react";

/** Shared runners injected into each level flow module (see executionFlow pattern). */
export type LabRunFns = {
  run: (work: () => Promise<void>, action?: string, target?: string) => Promise<void>;
  runManual: (action: string, work: () => Promise<string | null>, target?: string) => Promise<string | null>;
  labRunRef: MutableRefObject<boolean>;
  queryClient: QueryClient;
  reportStepError: (error: unknown) => void;
};