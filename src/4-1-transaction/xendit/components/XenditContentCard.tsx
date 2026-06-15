import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { XENDIT_MAIN_INNER_SCROLL } from '@/4-1-transaction/xendit/layout/xenditPageLayout';

type XenditContentCardProps = {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  /** Body mengisi tinggi penuh; scroll ditangani anak (mis. tabel). */
  fillBody?: boolean;
};

export function XenditContentCard({
  header,
  footer,
  children,
  bodyClassName,
  fillBody = false,
}: XenditContentCardProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {header ? (
        <div className="flex-shrink-0 border-b border-border">{header}</div>
      ) : null}
      <div
        className={cn(
          fillBody
            ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
            : XENDIT_MAIN_INNER_SCROLL,
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer}
    </div>
  );
}
