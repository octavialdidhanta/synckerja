import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getAttendancePhotoDisplayUrl } from '../utils/attendancePhotoUrl';
import { cn } from '@/shared/lib/utils';

interface AttendancePhotoThumbnailProps {
  photoPath?: string | null;
  label: string;
  className?: string;
}

export const AttendancePhotoThumbnail = ({
  photoPath,
  label,
  className,
}: AttendancePhotoThumbnailProps) => {
  const { t } = useAppTranslation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!photoPath?.trim()) {
      setDisplayUrl(null);
      setLoading(false);
      setLoadFailed(false);
      return;
    }

    setLoading(true);
    setLoadFailed(false);
    setDisplayUrl(null);

    void getAttendancePhotoDisplayUrl(photoPath, { thumbnail: true }).then((signed) => {
      if (cancelled) return;
      if (!signed) {
        setLoadFailed(true);
      } else {
        setDisplayUrl(signed);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [photoPath]);

  if (!photoPath?.trim()) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  if (loading) {
    return <Skeleton className="h-10 w-10 rounded" aria-hidden />;
  }

  if (loadFailed || !displayUrl) {
    return (
      <span className="text-muted-foreground text-xs">
        {t('attendance.records.photoUnavailable', 'Photo unavailable')}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className={cn(
          'inline-flex overflow-hidden rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        aria-label={t('attendance.records.viewPhoto', 'View photo')}
      >
        <img
          src={displayUrl}
          alt={label}
          loading="lazy"
          className="h-10 w-10 object-cover"
          onError={() => setLoadFailed(true)}
        />
      </button>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <img src={displayUrl} alt={label} className="max-h-[70vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
};
