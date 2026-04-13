import { lazy, Suspense, type ReactNode } from "react";

const ShareReceiptValidationPage = lazy(() => import("@/mobile/2-share/ShareReceiptValidationPage"));

function ShareReceiptSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-background" aria-busy>
          <span className="sr-only">Loading</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/** Android share-into-app → `/share/receipt-validation` (Capacitor ShareIntent). */
export function ShareReceiptValidationRouteElement() {
  return (
    <ShareReceiptSuspense>
      <ShareReceiptValidationPage />
    </ShareReceiptSuspense>
  );
}
