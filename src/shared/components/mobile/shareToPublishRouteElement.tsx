import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";
import ShareToPublishWizardPageSkeleton from "@/mobile/2-share/share-to-publish/pages/ShareToPublishWizardPageSkeleton";

const ShareToPublishWizardPage = lazy(
  () => import("@/mobile/2-share/share-to-publish/pages/ShareToPublishWizardPage"),
);

function ShareToPublishSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh min-h-0 flex-1 flex-col bg-gray-100" aria-busy>
          <ShareToPublishWizardPageSkeleton />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

type BoundaryProps = { children: ReactNode };
type BoundaryState = { error: Error | null };

class ShareToPublishErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ShareToPublishErrorBoundary", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-gray-100 px-6 text-center">
          <p className="text-sm font-medium text-foreground">Something went wrong loading share.</p>
          <p className="text-xs text-muted-foreground break-words">
            {this.state.error.message || "Unknown error"}
          </p>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              this.setState({ error: null });
              window.location.href = "/";
            }}
          >
            Close
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Android share-into-app (video) → `/share/publish` (Capacitor ShareIntent). */
export function ShareToPublishRouteElement() {
  return (
    <ShareToPublishErrorBoundary>
      <ShareToPublishSuspense>
        <ShareToPublishWizardPage />
      </ShareToPublishSuspense>
    </ShareToPublishErrorBoundary>
  );
}
