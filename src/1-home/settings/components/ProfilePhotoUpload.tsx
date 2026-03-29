import { useCallback, useId, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { publicUrlToObjectPath, PROFILE_PHOTO_BUCKET, resolveProfilePhotoDisplayUrl } from "@/shared/lib/profilePhotoStorage";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { initialsFromNameOrEmail } from "@/shared/lib/userDisplayUtils";
import { useTranslation } from "react-i18next";

type ProfilePhotoUploadProps = {
  currentPhotoUrl?: string | null;
  fullName: string;
  email?: string;
  onPhotoUpdate: (photoUrl: string | null) => void;
};

export function ProfilePhotoUpload({ currentPhotoUrl, fullName, email, onPhotoUpdate }: ProfilePhotoUploadProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const uploadPhoto = useCallback(
    async (file: File) => {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user?.id) {
        toast.error(t("settings.profile.photo.toast.authError"));
        return;
      }

      setUploading(true);
      try {
        if (!file.type.startsWith("image/")) {
          throw new Error(t("settings.profile.photo.toast.invalidType"));
        }
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          throw new Error(t("settings.profile.photo.toast.fileTooLarge"));
        }

        const fileExt = file.name.split(".").pop() || "jpg";
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const oldPath = publicUrlToObjectPath(currentPhotoUrl ?? null);
        if (oldPath) {
          await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([oldPath]);
        }

        const { data, error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

        if (error) throw error;

        const publicUrl = resolveProfilePhotoDisplayUrl(data.path);
        if (!publicUrl) throw new Error(t("settings.profile.photo.toast.uploadError"));
        onPhotoUpdate(publicUrl);
        toast.success(t("settings.profile.photo.toast.uploadSuccess"));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("settings.profile.photo.toast.uploadError");
        toast.error(message);
      } finally {
        setUploading(false);
      }
    },
    [currentPhotoUrl, onPhotoUpdate, t],
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void uploadPhoto(file);
      event.target.value = "";
    },
    [uploadPhoto],
  );

  const deletePhoto = useCallback(async () => {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user?.id || !currentPhotoUrl) return;

    setDeleting(true);
    try {
      const path = publicUrlToObjectPath(currentPhotoUrl);
      if (path) {
        const { error: storageError } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([path]);
        if (storageError) throw storageError;
      }
      onPhotoUpdate(null);
      toast.success(t("settings.profile.photo.toast.deleteSuccess"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("settings.profile.photo.toast.deleteError");
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }, [currentPhotoUrl, onPhotoUpdate, t]);

  const displayPhotoUrl = resolveProfilePhotoDisplayUrl(currentPhotoUrl ?? null);
  const initials = initialsFromNameOrEmail(fullName || "User", email);

  return (
    <div className="relative flex w-full flex-col items-center">
      <div className="group relative shrink-0">
        <Avatar className="h-32 w-32 cursor-pointer shadow-md ring-1 ring-border">
          <AvatarImage src={displayPhotoUrl ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className="bg-muted text-2xl font-bold text-muted-foreground">{initials}</AvatarFallback>
        </Avatar>

        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-all duration-300 group-hover:bg-black/50">
          <div className="flex items-center space-x-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading || deleting}
              className="hidden"
              id={inputId}
            />
            <label htmlFor={inputId}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading || deleting}
                className="h-10 w-10 cursor-pointer bg-background/90 p-0 shadow-lg hover:bg-background"
                asChild
              >
                <span className="flex items-center justify-center">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </span>
              </Button>
            </label>

            {displayPhotoUrl ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void deletePhoto()}
                disabled={uploading || deleting}
                className="h-10 w-10 bg-background/90 p-0 text-destructive shadow-lg hover:bg-background hover:text-destructive"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-sm text-muted-foreground">{t("settings.profile.photo.supportedFormats")}</p>
    </div>
  );
}
