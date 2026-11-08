import { describe, expect, it, vi } from "vitest";
import { locationSharePayload, shareOrCopy } from "./shareLocation";

describe("locationSharePayload", () => {
  it("shares the maps pin and the place name", () => {
    expect(
      locationSharePayload({
        name: "Sate Sultan PIK",
        address: "Trimaran Indah 1",
        mapsUrl: "https://www.google.com/maps/place/Sate+Sultan+PIK/@-6.11,106.75,17z",
        pageUrl: "https://order.example/sate-sultan-pik",
      }),
    ).toEqual({
      title: "Sate Sultan PIK",
      text: "Sate Sultan PIK\nTrimaran Indah 1",
      url: "https://www.google.com/maps/search/?api=1&query=-6.11%2C106.75",
    });
  });

  it("falls back to the order page when no map link is saved", () => {
    expect(
      locationSharePayload({
        name: "Sate Sultan PIK",
        pageUrl: "https://order.example/sate-sultan-pik",
      }).url,
    ).toBe("https://order.example/sate-sultan-pik");
  });
});

describe("shareOrCopy", () => {
  const payload = locationSharePayload({
    name: "Sate Sultan PIK",
    mapsUrl: "https://www.google.com/maps/place/Sate+Sultan/@-6.11,106.75,17z",
    pageUrl: "https://order.example/sate",
  });

  it("uses the device share sheet", async () => {
    const share = vi.fn(async () => undefined);
    await expect(shareOrCopy(payload, { share, copy: async () => false })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: "Sate Sultan PIK",
      text: "Sate Sultan PIK",
      url: "https://www.google.com/maps/search/?api=1&query=-6.11%2C106.75",
    });
  });

  it("stays quiet when the person closes the share sheet", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("cancelled", "AbortError");
    });
    const copy = vi.fn(async () => true);
    await expect(shareOrCopy(payload, { share, copy })).resolves.toBe("aborted");
    expect(copy).not.toHaveBeenCalled();
  });

  it("copies the link when sharing is unavailable", async () => {
    const copy = vi.fn(async () => true);
    await expect(shareOrCopy(payload, { copy })).resolves.toBe("copied");
    expect(copy).toHaveBeenCalledWith("https://www.google.com/maps/search/?api=1&query=-6.11%2C106.75");
  });

  it("tries a simpler share payload before copying", async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(new Error("unsupported"))
      .mockResolvedValueOnce(undefined);
    const copy = vi.fn(async () => true);
    await expect(shareOrCopy(payload, { share, copy })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(2);
    expect(copy).not.toHaveBeenCalled();
  });
});
