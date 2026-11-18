import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const put = vi.fn();
vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("@/shared/lib/googleDriveResumableUploadClient", () => ({
  putFileToDriveUploadUrl: (...a: unknown[]) => put(...a),
}));

import {
  driveFileIdFromLink,
  formatBytes,
  OrgDriveError,
  orgDriveErrorText,
  uploadContentPlanVideo,
} from "./orgDriveApi";

describe("orgDriveApi helpers", () => {
  it("reads Drive file ids from every link shape", () => {
    expect(driveFileIdFromLink("https://drive.google.com/file/d/ABC_123-x/view?usp=drivesdk")).toBe("ABC_123-x");
    expect(driveFileIdFromLink("https://drive.google.com/open?id=XYZ")).toBe("XYZ");
    expect(driveFileIdFromLink("")).toBeNull();
  });
  it("formats sizes", () => {
    expect(formatBytes(13_700_000)).toBe("13,1 MB");
    expect(formatBytes(2048)).toBe("2 KB");
  });
  it("explains known errors in plain words", () => {
    expect(orgDriveErrorText(new OrgDriveError("not_connected", "x"))).toContain("belum disambungkan");
    expect(orgDriveErrorText(new OrgDriveError("production_locked", "Produksi sudah di-approve"))).toBe("Produksi sudah di-approve");
  });
});

describe("uploadContentPlanVideo", () => {
  beforeEach(() => {
    invoke.mockReset();
    put.mockReset();
  });

  it("starts, sends bytes to the Google URL, then finishes", async () => {
    invoke
      .mockResolvedValueOnce({ data: { version_id: "V", version_no: 2, upload_url: "https://upload.example/session" }, error: null })
      .mockResolvedValueOnce({ data: { version_id: "V", version_no: 2, google_drive_link: "https://drive.google.com/file/d/F/view" }, error: null });
    put.mockResolvedValue("F");
    const file = new File([new Uint8Array(20_000)], "final.mp4", { type: "video/mp4" });
    const res = await uploadContentPlanVideo({ planId: "P", file });
    expect(invoke.mock.calls[0]).toEqual(["content-plan-media-upload", { body: { action: "start", plan_id: "P", file_name: "final.mp4", mime_type: "video/mp4", size_bytes: 20_000 } }]);
    expect(put).toHaveBeenCalledWith("https://upload.example/session", file, undefined);
    expect(invoke.mock.calls[1]).toEqual(["content-plan-media-upload", { body: { action: "finish", version_id: "V", file_id: "F" } }]);
    expect(res).toEqual({ versionId: "V", versionNo: 2, googleDriveLink: "https://drive.google.com/file/d/F/view", shareWarning: null });
  });

  it("surfaces the server's error code and message from a non-2xx response", async () => {
    const context = new Response(JSON.stringify({ error: "production_locked", message: "Terkunci" }), { status: 409 });
    invoke.mockResolvedValueOnce({ data: null, error: Object.assign(new Error("Edge Function returned a non-2xx status code"), { context }) });
    const file = new File([new Uint8Array(20_000)], "final.mp4", { type: "video/mp4" });
    await expect(uploadContentPlanVideo({ planId: "P", file })).rejects.toMatchObject({ code: "production_locked", message: "Terkunci" });
    expect(put).not.toHaveBeenCalled();
  });
});
