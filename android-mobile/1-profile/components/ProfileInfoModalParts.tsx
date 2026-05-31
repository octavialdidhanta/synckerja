import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Card } from '@/mobile-app/components/ui/card';
import { cn } from '@/shared/lib/utils';
import { hasDisplayValue } from '@/mobile/1-profile/utils/myInfoDisplayUtils';

export function profileFullscreenDialogContentClass(isMobile: boolean): string {
  return cn(
    'm-0 flex w-full max-w-none flex-col gap-0 p-0',
    isMobile
      ? 'fixed left-0 right-0 top-0 max-h-none min-h-0 translate-x-0 translate-y-0 overflow-hidden rounded-none border border-brand-blue/20 bg-gradient-to-b from-brand-blue-soft/55 via-gray-100 to-gray-100 modal-above-safe-area dark:from-brand-blue/20 dark:via-background dark:to-muted/80'
      : 'left-[50%] top-[50%] max-h-[90vh] min-h-0 max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border-border bg-background sm:max-w-md',
  );
}

export function profileFullscreenDialogHeaderClass(isMobile: boolean): string {
  return cn(
    'flex-shrink-0 border-b text-left',
    isMobile
      ? 'safe-area-top flex flex-row flex-nowrap items-stretch gap-0 space-y-0 border-brand-blue/20 bg-gradient-to-r from-brand-blue-soft via-background to-brand-blue-soft/70 px-0 py-0 dark:from-brand-blue/15 dark:via-background dark:to-brand-blue/10'
      : 'border-border bg-background px-6 pb-4 pt-6',
  );
}

export function profileFullscreenScrollBodyClass(): string {
  return 'nested-scroll-touch-chain flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
}

interface InfoFieldRowProps {
  label: string;
  value: string | undefined;
}

export function InfoFieldRow({ label, value }: InfoFieldRowProps) {
  if (!hasDisplayValue(value)) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value!.trim()}</p>
    </div>
  );
}

interface InfoSectionProps {
  title: string;
  children: ReactNode;
  hasContent: boolean;
  titleExtra?: ReactNode;
}

export function InfoSection({ title, children, hasContent, titleExtra }: InfoSectionProps) {
  if (!hasContent) return null;
  return (
    <Card className="bg-gradient-card border border-border">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <h3 className="font-semibold text-foreground text-sm truncate">{title}</h3>
          {titleExtra}
        </div>
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </Card>
  );
}

export function InfoGroupHeading({ title }: { title: string }) {
  return (
    <p className="px-1 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pt-0">
      {title}
    </p>
  );
}

interface ProfileDetailModalHeaderProps {
  isMobile: boolean;
  title: string;
  icon: LucideIcon;
  closeLabel: string;
  onClose: () => void;
}

export function ProfileDetailModalHeader({
  isMobile,
  title,
  icon: Icon,
  closeLabel,
  onClose,
}: ProfileDetailModalHeaderProps) {
  return (
    <DialogHeader className={profileFullscreenDialogHeaderClass(isMobile)}>
      {isMobile ? (
        <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
          <button
            type="button"
            className="-ml-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0 text-brand-blue-deep ring-offset-background transition-colors hover:bg-brand-blue/10 hover:text-brand-blue-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <ArrowLeft className="block h-4 w-4 shrink-0 translate-y-px" aria-hidden />
          </button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
            <Icon className="block h-4 w-4 shrink-0" aria-hidden />
          </div>
          <DialogTitle className="m-0 flex min-h-0 min-w-0 flex-1 items-center truncate py-0 pr-1 text-left text-base font-semibold leading-tight tracking-tight text-brand-blue-deep">
            {title}
          </DialogTitle>
        </div>
      ) : (
        <DialogTitle className="flex items-center gap-2 pr-8 text-xl font-semibold">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
            <Icon className="h-5 w-5 shrink-0" />
          </div>
          {title}
        </DialogTitle>
      )}
    </DialogHeader>
  );
}
