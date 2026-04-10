import { useEffect, useState, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Separator } from "@/shared/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { PROFILE_QUERY_KEY, useProfile, useUpdateProfile, type ProfileRow } from "@/shared/hooks/useProfile";
import { resolveUiLanguage } from "@/shared/i18n/resolveUiLanguage";
import { setAppLanguage, type SupportedLanguage } from "@/shared/i18n";
import { ProfilePhotoUpload } from "./ProfilePhotoUpload";

export type ProfileFormState = {
  full_name: string;
  phone: string;
  bio: string;
  job_title: string;
  location: string;
  website: string;
  profile_photo_url: string | null;
  preferred_locale: SupportedLanguage;
};

export type ProfileSettingsProps = {
  onFieldFocus?: () => void;
  onFieldBlur?: () => void;
  saveButtonRef?: RefObject<HTMLButtonElement | null>;
};

export function ProfileSettings({
  onFieldFocus,
  onFieldBlur,
  saveButtonRef,
}: ProfileSettingsProps = {}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, error, refetch } = useProfile();
  const updateProfile = useUpdateProfile();

  const [formData, setFormData] = useState<ProfileFormState>({
    full_name: "",
    phone: "",
    bio: "",
    job_title: "",
    location: "",
    website: "",
    profile_photo_url: null,
    preferred_locale: "id",
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const locale: SupportedLanguage =
      profile.preferred_locale === "en" || profile.preferred_locale === "id"
        ? profile.preferred_locale
        : resolveUiLanguage(i18n.language);
    setFormData({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
      job_title: profile.job_title ?? "",
      location: profile.location ?? "",
      website: profile.website ?? "",
      profile_photo_url: profile.profile_photo_url ?? null,
      preferred_locale: locale,
    });
    setHasChanges(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid resetting the form when only i18n.language changes (e.g. user picked a new language before Save)
  }, [profile]);

  const handleInputChange = (field: keyof ProfileFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleLocaleChange = (value: SupportedLanguage) => {
    setFormData((prev) => ({ ...prev, preferred_locale: value }));
    setAppLanguage(value);
    setHasChanges(true);
  };

  const handlePhotoUpdate = (photoUrl: string | null) => {
    setFormData((prev) => ({ ...prev, profile_photo_url: photoUrl }));
    setHasChanges(true);
    queryClient.setQueryData<ProfileRow | null>([PROFILE_QUERY_KEY], (prev) =>
      prev ? { ...prev, profile_photo_url: photoUrl } : prev,
    );
  };

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        full_name: formData.full_name,
        phone: formData.phone,
        bio: formData.bio,
        job_title: formData.job_title,
        location: formData.location,
        website: formData.website,
        profile_photo_url: formData.profile_photo_url,
        preferred_locale: formData.preferred_locale,
      });
      setHasChanges(false);
      toast.success(t("settings.profile.toast.updateSuccess"));
    } catch {
      toast.error(t("settings.profile.toast.updateError"));
    }
  };

  const handleReset = () => {
    if (!profile) return;
    const locale: SupportedLanguage =
      profile.preferred_locale === "en" || profile.preferred_locale === "id"
        ? profile.preferred_locale
        : resolveUiLanguage(i18n.language);
    setFormData({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
      job_title: profile.job_title ?? "",
      location: profile.location ?? "",
      website: profile.website ?? "",
      profile_photo_url: profile.profile_photo_url ?? null,
      preferred_locale: locale,
    });
    setAppLanguage(locale);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-destructive">{t("settings.profile.loadError")}</p>
          <div className="mt-4 flex justify-center">
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              {t("settings.profile.retry")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>{t("settings.profile.language.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="settings-language">{t("settings.profile.language.label")}</Label>
            <Select value={formData.preferred_locale} onValueChange={(v) => handleLocaleChange(v as SupportedLanguage)}>
              <SelectTrigger
                id="settings-language"
                className="w-full"
                onFocus={() => onFieldFocus?.()}
                onBlur={() => onFieldBlur?.()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id">{t("settings.profile.language.optionId")}</SelectItem>
                <SelectItem value="en">{t("settings.profile.language.optionEn")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>{t("settings.profile.photo.title")}</CardTitle>
          <CardDescription>{t("settings.profile.photo.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex w-full justify-center px-2 sm:px-6">
          <ProfilePhotoUpload
            currentPhotoUrl={formData.profile_photo_url}
            fullName={formData.full_name || t("settings.profile.photo.fallbackName")}
            email={profile?.email}
            onPhotoUpdate={handlePhotoUpdate}
          />
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>{t("settings.profile.personal.title")}</CardTitle>
          <CardDescription>{t("settings.profile.personal.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">{t("settings.profile.form.fullNameLabel")}</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleInputChange("full_name", e.target.value)}
                placeholder={t("settings.profile.form.fullNamePlaceholder")}
                onFocus={() => onFieldFocus?.()}
                onBlur={() => onFieldBlur?.()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("settings.profile.form.phoneLabel")}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder={t("settings.profile.form.phonePlaceholder")}
                onFocus={() => onFieldFocus?.()}
                onBlur={() => onFieldBlur?.()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_title">{t("settings.profile.form.jobTitleLabel")}</Label>
              <Input
                id="job_title"
                value={formData.job_title}
                onChange={(e) => handleInputChange("job_title", e.target.value)}
                placeholder={t("settings.profile.form.jobTitlePlaceholder")}
                onFocus={() => onFieldFocus?.()}
                onBlur={() => onFieldBlur?.()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">{t("settings.profile.form.locationLabel")}</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                placeholder={t("settings.profile.form.locationPlaceholder")}
                onFocus={() => onFieldFocus?.()}
                onBlur={() => onFieldBlur?.()}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="website">{t("settings.profile.form.websiteLabel")}</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
                placeholder={t("settings.profile.form.websitePlaceholder")}
                onFocus={() => onFieldFocus?.()}
                onBlur={() => onFieldBlur?.()}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">{t("settings.profile.form.bioLabel")}</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleInputChange("bio", e.target.value)}
              placeholder={t("settings.profile.form.bioPlaceholder")}
              rows={4}
              onFocus={() => onFieldFocus?.()}
              onBlur={() => onFieldBlur?.()}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {hasChanges ? t("settings.profile.status.changesPending") : t("settings.profile.status.noChanges")}
            </p>
            <div className="flex flex-wrap gap-2 sm:space-x-3">
              {hasChanges ? (
                <Button type="button" variant="outline" onClick={handleReset} disabled={updateProfile.isPending}>
                  {t("settings.profile.actions.reset")}
                </Button>
              ) : null}
              <Button
                ref={saveButtonRef}
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasChanges || updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("settings.profile.actions.saving")}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t("settings.profile.actions.save")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
