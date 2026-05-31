import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

/** Footer tombol aksi modal form mobile — selaras `AddNewExpenseModal`. */
export function MobileFormModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3', className)}>
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}
