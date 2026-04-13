import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Building2 } from "lucide-react";
import OrganizationForm from "@/0-onboarding/components/OrganizationForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/utils";

const FORM_ID = "create-organization-modal-form";

type CreateOrganizationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Desktop: centered dialog with close (X). Mobile: fullscreen per
 * synckerja-reference/.cursor/rules/modal-android-fullscreen.mdc
 */
export function CreateOrganizationModal({ open, onOpenChange }: CreateOrganizationModalProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [formKey, setFormKey] = useState(0);
  const [formLoading, setFormLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (open) {
      setFormKey((k) => k + 1);
      setAcceptedTerms(false);
      setFormLoading(false);
    }
  }, [open]);

  const handleClose = () => {
    if (!formLoading) onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && formLoading) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "flex min-h-0 flex-col gap-0 overflow-hidden border-border p-0",
          isMobile
            ? "fixed left-0 right-0 top-0 flex min-h-0 max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-brand-blue/20 bg-gradient-to-b from-brand-blue-soft/55 via-gray-100 to-gray-100 modal-above-safe-area dark:from-brand-blue/20 dark:via-background dark:to-muted/80"
            : "max-h-[min(90vh,720px)] max-w-2xl overflow-y-auto bg-background scrollbar-hide seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-2xl sm:rounded-lg",
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <DialogHeader
          className={cn(
            "flex-shrink-0 border-b text-left",
            isMobile
              ? "safe-area-top flex flex-row flex-nowrap items-stretch gap-0 space-y-0 border-brand-blue/20 bg-gradient-to-r from-brand-blue-soft via-background to-brand-blue-soft/70 px-0 py-0 text-left dark:from-brand-blue/15 dark:via-background dark:to-brand-blue/10"
              : "border-border bg-background px-6 pb-4 pt-6",
          )}
        >
          {isMobile ? (
            <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0 text-foreground ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 -ml-0.5"
                onClick={handleClose}
                disabled={formLoading}
                aria-label={t("layout.sheetClose", "Close")}
              >
                <ArrowLeft className="block h-4 w-4 shrink-0 translate-y-px" aria-hidden />
              </button>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                <Building2 className="block h-4 w-4 shrink-0" aria-hidden />
              </div>
              <DialogTitle className="m-0 flex min-h-0 min-w-0 flex-1 items-center py-0 pr-1 text-left text-base font-semibold leading-tight tracking-tight text-brand-blue-deep">
                {t("layout.createOrgModal.title")}
              </DialogTitle>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-1 pr-8">
                  <DialogTitle className="text-xl font-bold text-brand-blue">
                    {t("layout.createOrgModal.title")}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {t("layout.createOrgModal.subtitle")}
                  </DialogDescription>
                </div>
              </div>
            </>
          )}
        </DialogHeader>

        {isMobile ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain scrollbar-hide seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="mx-auto w-full max-w-md px-2 pb-4 pt-2">
                  <div className="space-y-1">
                    <OrganizationForm
                      key={formKey}
                      formId={FORM_ID}
                      hideSubmitButton
                      compactMobileSections
                      onLoadingChange={setFormLoading}
                      onAcceptTermsChange={setAcceptedTerms}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 border-t border-brand-blue/15 bg-brand-blue-soft/25 px-4 pb-3 pt-3 dark:border-brand-blue/25 dark:bg-brand-blue/10">
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={formLoading}
                >
                  {t("common.cancel", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  form={FORM_ID}
                  size="sm"
                  disabled={formLoading || !acceptedTerms}
                  className="min-w-[120px] items-center justify-center gap-1.5"
                >
                  {formLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>{t("onboarding.org.submitting", "Submitting...")}</span>
                    </>
                  ) : (
                    t("onboarding.org.submit", "Create organization")
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="px-6 pb-6 pt-4">
            <OrganizationForm
              key={formKey}
              onLoadingChange={setFormLoading}
              onAcceptTermsChange={setAcceptedTerms}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
