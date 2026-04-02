import type { ReactNode } from "react";
import { RequestFormInitialLoadProvider, useRequestFormInitialLoad } from "@/9-request-form/context/RequestFormInitialLoadContext";
import { RequestFormPageSkeleton } from "@/9-request-form/components/RequestFormPageSkeleton";
import { RequestFormSubPageLayout } from "@/9-request-form/components/RequestFormSubPageLayout";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";

function RequestFormRouteInner({ children }: { children: ReactNode }) {
  const { showSkeleton, organizationId, orgLoading, listError } = useRequestFormInitialLoad();

  if (!orgLoading && !organizationId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <Alert variant="destructive">
          <AlertTitle>No organization</AlertTitle>
          <AlertDescription>Select or create an organization to use request forms.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (showSkeleton) {
    return <RequestFormPageSkeleton />;
  }

  if (listError) {
    return (
      <RequestFormSubPageLayout>
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Could not load requests</AlertTitle>
            <AlertDescription>{listError.message}</AlertDescription>
          </Alert>
        </div>
      </RequestFormSubPageLayout>
    );
  }

  return <RequestFormSubPageLayout>{children}</RequestFormSubPageLayout>;
}

/** Wraps a request-form page: org + first list fetch gate, one skeleton layer, then shared layout. */
export function RequestFormRouteBody({ children }: { children: ReactNode }) {
  return (
    <RequestFormInitialLoadProvider>
      <RequestFormRouteInner>{children}</RequestFormRouteInner>
    </RequestFormInitialLoadProvider>
  );
}
