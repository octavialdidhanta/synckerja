import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  children: ReactNode;
};

/** Title on the left; filters/actions on one row to the right, vertically centered. */
export function ReportsSalesToolbarShell({ title, children }: Props) {
  return (
    <div className="mb-2 flex min-w-0 shrink-0 flex-nowrap items-center gap-2 overflow-x-auto border-b border-border pt-1 pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <h2 className="flex h-10 shrink-0 items-center whitespace-nowrap text-lg font-semibold leading-none text-gray-900">
        {title}
      </h2>
      <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}
