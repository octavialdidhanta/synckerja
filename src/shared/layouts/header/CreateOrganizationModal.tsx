import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import OrganizationForm from "@/0-onboarding/components/OrganizationForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

type CreateOrganizationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateOrganizationModal({ open, onOpenChange }: CreateOrganizationModalProps) {
  const { t } = useTranslation();
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (open) {
      setFormKey((k) => k + 1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl overflow-x-hidden overflow-y-auto seamless-scroll border-border bg-background p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border bg-background px-6 pb-4 pt-6 text-left">
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
        </DialogHeader>
        <div className="px-6 pb-6 pt-4">
          <OrganizationForm key={formKey} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
