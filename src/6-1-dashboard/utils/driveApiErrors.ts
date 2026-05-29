export const DRIVE_GRANT_REQUIRED_CODE = "DRIVE_GRANT_REQUIRED";

export type DriveInvokePayload = {
  error?: string;
  code?: string;
  resourceId?: string;
};

export function isDriveGrantRequiredPayload(data: unknown): data is DriveInvokePayload & {
  code: typeof DRIVE_GRANT_REQUIRED_CODE;
} {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as DriveInvokePayload).code === DRIVE_GRANT_REQUIRED_CODE
  );
}
