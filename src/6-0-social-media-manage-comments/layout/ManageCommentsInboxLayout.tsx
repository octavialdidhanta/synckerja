import type { ReactNode } from "react";

type ManageCommentsInboxLayoutProps = {
  sidebar: ReactNode;
  main: ReactNode;
};

export function ManageCommentsInboxLayout({
  sidebar,
  main,
}: ManageCommentsInboxLayoutProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
      <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
        {sidebar}
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
        {main}
      </main>
    </div>
  );
}

ManageCommentsInboxLayout.displayName = "ManageCommentsInboxLayout";
