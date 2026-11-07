import { describe, expect, it } from "vitest";
import { canonicalGoogleMapsUrl, googleMapsEmbedSrc, isGoogleMapsUrl } from "./googleMapsLink";

describe("googleMapsLink", () => {
  it("accepts Google Maps hosts and rejects other links", () => {
    expect(isGoogleMapsUrl("https://maps.app.goo.gl/abc")).toBe(true);
    expect(isGoogleMapsUrl("https://www.google.com/maps?q=Sate+Sultan")).toBe(true);
    expect(isGoogleMapsUrl("http://maps.google.com/?q=1,2")).toBe(false);
    expect(isGoogleMapsUrl("https://example.com/maps")).toBe(false);
  });

  it("embeds coordinates from a place URL", () => {
    expect(
      googleMapsEmbedSrc("https://www.google.com/maps/place/Sate+Sultan/@-6.108,106.74,17z"),
    ).toBe("https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s-6.108,106.74!6i16");
  });

  it("embeds a search query and leaves short links for a new tab", () => {
    expect(googleMapsEmbedSrc("https://www.google.com/maps?q=Sate%20Sultan%20PIK")).toBe(
      "https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1sSate%20Sultan%20PIK!6i16",
    );
    expect(googleMapsEmbedSrc("https://maps.app.goo.gl/abc123")).toBeNull();
  });

  it("uses the place pin instead of the map viewport", () => {
    const shared =
      "https://www.google.com/maps/place/Sate+Sultan+PIK/@-6.1153649,106.7379257,15z/data=!3d-6.1153649!4d106.7569801";
    expect(googleMapsEmbedSrc(shared)).toBe(
      "https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s-6.1153649,106.7569801!6i16",
    );
    expect(canonicalGoogleMapsUrl(shared)).toBe(
      "https://www.google.com/maps/place/Sate+Sultan+PIK/@-6.1153649,106.7569801,17z",
    );
  });
});
