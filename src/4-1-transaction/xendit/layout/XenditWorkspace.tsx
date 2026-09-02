import type { ReactNode } from 'react';
import { XENDIT_MAIN_GRID, XENDIT_TABLE_SECTION } from './xenditPageLayout';

type Props = {
  children: ReactNode;
};

export function XenditWorkspace({ children }: Props) {
  return (
    <div className={XENDIT_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className={XENDIT_TABLE_SECTION}>{children}</div>
      </div>
    </div>
  );
}
