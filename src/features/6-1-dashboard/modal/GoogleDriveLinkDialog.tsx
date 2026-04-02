import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

export type GoogleDriveLinkDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  googleDriveLink: string;
  onSave: (link: string) => void;
  socialMediaPlanId: string;
  planTitle?: string;
  onApprove?: () => void;
  onRevision?: () => void;

  // Optional metadata (used for better UX; not required for save logic)
  status?: "draft" | "approved" | "revision" | "completed";
  contentTitle?: string;
  contentType?: string;
  postDate?: string;
  serviceName?: string | null;
  picProductionName?: string | null;
  productionApproved?: boolean;
  productionStatus?: string | null;
  revisionBaselineLink?: string | null;
  onResubmitForReview?: () => void | Promise<void>;
  onCarouselChange?: () => void;
  onCarouselFirstUploadSuccess?: (planId: string) => void;
  onCarouselAllRemoved?: (planId: string) => void;
};

/**
 * Minimal shim implementation to unblock `/tools/daily-task`.
 * The full reference version is much larger and depends on additional components/hooks.
 * This shim preserves the essential contract: show link editor + call `onSave`/`onApprove`/`onRevision`.
 */
export default function GoogleDriveLinkDialog({
  isOpen,
  onClose,
  googleDriveLink,
  onSave,
  socialMediaPlanId: _socialMediaPlanId,
  planTitle,
  onApprove,
  onRevision,
  productionApproved = false,
  productionStatus,
}: GoogleDriveLinkDialogProps) {
  const [draftLink, setDraftLink] = useState(googleDriveLink);

  useEffect(() => {
    if (isOpen) setDraftLink(googleDriveLink);
  }, [isOpen, googleDriveLink]);

  const saveDisabled = useMemo(() => productionApproved, [productionApproved]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>Google Drive Link</span>
            {productionStatus ? (
              <span
                className={cn(
                  "text-xs rounded-md px-2 py-1",
                  productionApproved ? "bg-brand-blue/10 text-brand-blue" : "bg-muted/60 text-foreground"
                )}
              >
                {productionStatus}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {planTitle ? (
          <div className="mb-3 text-sm text-muted-foreground">
            {planTitle}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Google Drive URL</label>
            <Input
              value={draftLink}
              onChange={(e) => setDraftLink(e.target.value)}
              disabled={saveDisabled}
              placeholder="Paste Google Drive link..."
            />
          </div>

          <Textarea
            value={draftLink}
            onChange={(e) => setDraftLink(e.target.value)}
            disabled={saveDisabled}
            className="min-h-[90px]"
          />

          <div className="flex items-center justify-between gap-2 pt-2">
            {googleDriveLink ? (
              <a
                className="text-sm text-brand-blue hover:underline"
                href={googleDriveLink}
                target="_blank"
                rel="noreferrer"
              >
                Open current link
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">No link provided.</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-4">
          {onRevision ? (
            <Button
              type="button"
              variant="outline"
              className="border-brand-red text-brand-red hover:bg-brand-red/10"
              onClick={() => onRevision()}
              disabled={!onRevision || productionApproved}
            >
              Request Revision
            </Button>
          ) : null}
          {onApprove ? (
            <Button
              type="button"
              variant="outline"
              className="border-brand-blue text-brand-blue hover:bg-brand-blue/10"
              onClick={() => onApprove()}
              disabled={!onApprove || productionApproved}
            >
              Approve
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => onSave(draftLink)}
            disabled={saveDisabled}
            className="bg-brand-blue hover:bg-brand-blue/90 text-white"
          >
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

