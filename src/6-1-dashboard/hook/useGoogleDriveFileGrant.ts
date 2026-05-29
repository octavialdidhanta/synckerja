import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { openGoogleDrivePicker } from "@/shared/lib/googleDrivePicker";

export function useGoogleDriveFileGrant(): {
  granting: boolean;
  grantDriveResource: (
    resourceId: string,
    options: { isFolder: boolean; onGranted?: () => void },
  ) => Promise<boolean>;
} {
  const { t } = useAppTranslation();
  const [granting, setGranting] = useState(false);

  const grantDriveResource = useCallback(
    async (
      resourceId: string,
      options: { isFolder: boolean; onGranted?: () => void },
    ): Promise<boolean> => {
      if (!resourceId?.trim()) return false;
      setGranting(true);
      try {
        const picked = await openGoogleDrivePicker({
          preselectIds: [resourceId.trim()],
          selectFolder: options.isFolder,
        });
        if (picked.length === 0) {
          return false;
        }
        toast.success(
          t(
            "googleDrivePreview.grantSuccess",
            "Akses Google Drive untuk file ini telah diizinkan.",
          ),
        );
        options.onGranted?.();
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("not configured")) {
          toast.error(
            t(
              "googleDrivePreview.grantPickerNotConfigured",
              "Google Picker belum dikonfigurasi. Hubungi admin (API key / App ID).",
            ),
          );
        } else if (msg.includes("not connected")) {
          toast.error(
            t(
              "googleDrivePreview.grantConnectFirst",
              "Hubungkan Google terlebih dahulu di baris Preview.",
            ),
          );
        } else {
          toast.error(
            t("googleDrivePreview.grantFailed", "Tidak bisa membuka pemilih Google Drive."),
          );
        }
        return false;
      } finally {
        setGranting(false);
      }
    },
    [t],
  );

  return { granting, grantDriveResource };
}
