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
import { useIsMobile } from "@/mobile-app/hooks/use-mobile";
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
          "flex min-h-0 flex-col gap-0 overflow-hidden border-border bg-background p-0",
          isMobile
            ? "fixed left-0 right-0 top-0 flex min-h-0 w-full max-w-none max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none modal-above-safe-area"
            : "max-h-[min(90vh,720px)] max-w-2xl overflow-y-auto scrollbar-hide seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-2xl sm:rounded-lg",
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <DialogHeader
          className={cn(
            "flex-shrink-0 border-b text-left",
            isMobile
              ? "safe-area-top bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-left dark:from-blue-950/20 dark:to-indigo-950/20"
              : "border-border bg-background px-6 pb-4 pt-6",
          )}
        >
          {isMobile ? (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full -ml-1"
                onClick={handleClose}
                disabled={formLoading}
                aria-label={t("layout.sheetClose", "Close")}
              >
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </Button>
              <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex min-w-0 flex-1 items-center pr-2">
                  <DialogTitle className="text-lg font-semibold leading-snug">
                    {t("layout.createOrgModal.title")}
                  </DialogTitle>
                </div>
              </div>
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
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 scrollbar-hide seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <OrganizationForm
                  key={formKey}
                  formId={FORM_ID}
                  hideSubmitButton
                  onLoadingChange={setFormLoading}
                  onAcceptTermsChange={setAcceptedTerms}
                />
              </div>
            </div>
            <div className="flex-shrink-0 border-t bg-muted/30 px-4 pb-3 pt-3">
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
