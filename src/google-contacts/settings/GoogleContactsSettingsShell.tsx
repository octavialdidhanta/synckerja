import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { omnichannelSettingsPath } from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";
import {
  OMNICHANNEL_SETTINGS_CARD_HEADER_BASE,
  OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS,
  OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsCardHeader";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { GoogleContactsSettingsPanel } from "@/google-contacts/settings/GoogleContactsSettingsPanel";
import { GOOGLE_CONTACTS_OMNICHANNEL_SETTINGS_PATH } from "@/google-contacts/settings/googleContactsSettingsPaths";

export function GoogleContactsSettingsShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();

  useEffect(() => {
    if (gatePending || !organizationId) return;
    if (!canManage) {
      toast.message(
        t(
          "omnichannel.settings.googleContacts.adminOnlyToast",
          "Hanya owner atau admin omnichannel yang dapat mengatur Google Contacts.",
        ),
      );
      navigate(omnichannelSettingsPath("user-management"), { replace: true });
    }
  }, [canManage, gatePending, navigate, organizationId, t]);

  if (gatePending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={OMNICHANNEL_SETTINGS_CARD_HEADER_BASE}>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
        </div>
        <div className="space-y-3 px-4 pb-4 pt-4">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!canManage) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`${OMNICHANNEL_SETTINGS_CARD_HEADER_BASE} shrink-0`}>
        <h2 className={OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS}>
          {t("omnichannel.settings.googleContacts.pageTitle", "Google Contacts")}
        </h2>
        <p className={OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS}>
          {t(
            "omnichannel.settings.googleContacts.intro",
            "Hubungkan akun Google organisasi agar lead Omnichannel dengan nomor telepon tersimpan otomatis ke Google Contacts / WhatsApp.",
          )}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <GoogleContactsSettingsPanel
          organizationId={organizationId}
          enabled={canManage && !gatePending}
          oauthReturnPath={GOOGLE_CONTACTS_OMNICHANNEL_SETTINGS_PATH}
        />
      </div>
    </div>
  );
}
