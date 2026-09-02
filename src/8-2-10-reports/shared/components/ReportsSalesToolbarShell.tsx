import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
};

/** Title + description on the left; filters/actions aligned on the same row to the right. */
export function ReportsSalesToolbarShell({ title, description, children }: Props) {
  return (
    <div className="mb-3 border-b border-border pb-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 max-w-md shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description ? <div className="mt-0.5">{description}</div> : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}
