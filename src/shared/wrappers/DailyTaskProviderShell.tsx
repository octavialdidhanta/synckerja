import { lazy, Suspense, type ReactNode } from "react";

const DailyTaskProvider = lazy(() =>
  import("@/8-2-DailyTask/context/DailyTaskContext").then((m) => ({
    default: m.DailyTaskProvider,
  })),
);

export function DailyTaskProviderShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DailyTaskProvider>{children}</DailyTaskProvider>
    </Suspense>
  );
}
