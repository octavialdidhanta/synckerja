import { describe, expect, it } from "vitest";
import {
  locationPhotoError,
  locationPhotoFilePath,
  locationPhotoObjectPath,
  nextPhotoPosition,
  planLocationSections,
  storeLocationPhoto,
} from "./locationPhoto";

const ORG = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
const PHOTO = "11111111-1111-4111-8111-111111111111";

describe("location photo upload", () => {
  it("uses the catalog-media path the database check allows", () => {
    expect(locationPhotoFilePath(PHOTO, "jpg")).toBe(`unggah/${PHOTO}.jpg`);
    const objectPath = locationPhotoObjectPath(ORG, PHOTO, "png");
    expect(objectPath).toBe(`${ORG}/photos/${PHOTO}.png`);
    expect(objectPath).toMatch(new RegExp(`^${ORG}/photos/${PHOTO}\\.(jpg|jpeg|png|webp)$`));
    expect(locationPhotoError({ type: "image/jpeg", size: 20 })).toBeNull();
    expect(locationPhotoError({ type: "image/gif", size: 20 })).toBe("Pakai foto JPEG, PNG, atau WebP.");
    expect(locationPhotoError({ type: "image/webp", size: 5 * 1024 * 1024 + 1 })).toBe("Foto paling besar 5 MB.");
  });

  it("places the next photo after the highest position", () => {
    expect(nextPhotoPosition([])).toBe(0);
    expect(nextPhotoPosition([{ position: 0 }, { position: 2 }])).toBe(3);
  });

  it("uploads after the row exists and removes that row when the upload fails", async () => {
    const calls: string[] = [];
    let inserted: { file_path: string; label: string; areas: string[]; position: number } | null = null;
    await storeLocationPhoto(
      {
        insertPhoto: async (row) => {
          calls.push("insert");
          inserted = row;
        },
        uploadObject: async (path, _file, contentType) => {
          calls.push(`upload:${path}:${contentType}`);
        },
        saveStoragePath: async (_id, path) => {
          calls.push(`path:${path}`);
        },
        deletePhoto: async () => {
          calls.push("delete-row");
        },
        deleteObject: async () => {
          calls.push("delete-object");
        },
      },
      {
        organizationId: ORG,
        locationId: "22222222-2222-4222-8222-222222222222",
        label: "  Samping kiri  ",
        position: 1,
        id: PHOTO,
        file: { type: "image/jpeg", size: 12, blob: new Blob(["foto"]) },
      },
    );
    expect(inserted).toMatchObject({
      file_path: `unggah/${PHOTO}.jpg`,
      label: "Samping kiri",
      areas: [],
      position: 1,
    });
    expect(calls).toEqual([
      "insert",
      `upload:${ORG}/photos/${PHOTO}.jpg:image/jpeg`,
      `path:${ORG}/photos/${PHOTO}.jpg`,
    ]);
  });

  it("drops the new row when the file cannot be stored", async () => {
    const calls: string[] = [];
    await expect(storeLocationPhoto(
      {
        insertPhoto: async () => {
          calls.push("insert");
        },
        uploadObject: async () => {
          calls.push("upload");
          throw new Error("penuh");
        },
        saveStoragePath: async () => {
          calls.push("path");
        },
        deletePhoto: async () => {
          calls.push("delete-row");
        },
        deleteObject: async () => {
          calls.push("delete-object");
        },
      },
      {
        organizationId: ORG,
        locationId: "22222222-2222-4222-8222-222222222222",
        label: "Samping kiri",
        position: 0,
        id: PHOTO,
        file: { type: "image/png", size: 12, blob: new Blob(["foto"]) },
      },
    )).rejects.toThrow("penuh");
    expect(calls).toEqual(["insert", "upload", "delete-row"]);
  });

  it("removes the new file and the row when the path cannot be saved", async () => {
    const calls: string[] = [];
    await expect(storeLocationPhoto(
      {
        insertPhoto: async () => {
          calls.push("insert");
        },
        uploadObject: async () => {
          calls.push("upload");
        },
        saveStoragePath: async () => {
          calls.push("path");
          throw new Error("cek");
        },
        deletePhoto: async () => {
          calls.push("delete-row");
        },
        deleteObject: async () => {
          calls.push("delete-object");
        },
      },
      {
        organizationId: ORG,
        locationId: "22222222-2222-4222-8222-222222222222",
        label: "Samping kiri",
        position: 0,
        id: PHOTO,
        file: { type: "image/webp", size: 12, blob: new Blob(["foto"]) },
      },
    )).rejects.toThrow("cek");
    expect(calls).toEqual(["insert", "upload", "path", "delete-object", "delete-row"]);
  });
});

describe("location section plan", () => {
  it("updates Scene, adds Atmosphere, and leaves any other title alone", () => {
    const plan = planLocationSections(
      [
        { id: "s1", title: "Scene", position: 0 },
        { id: "s2", title: "Catatan", position: 4 },
      ],
      [
        { title: "Scene", body: "  Pagi  " },
        { title: "Atmosphere", body: "Terang" },
        { title: "Must NOT", body: "   " },
        { title: "Catatan", body: "jangan diubah" },
      ],
    );
    expect(plan.updates).toEqual([{ id: "s1", body: "Pagi" }]);
    expect(plan.inserts).toEqual([{ title: "Atmosphere", body: "Terang", position: 5 }]);
  });
});
