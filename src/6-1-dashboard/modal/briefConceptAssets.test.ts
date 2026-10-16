import { describe, expect, it } from "vitest";
import {
  locationFrameForContentType,
  mergeBriefConceptVisuals,
  parseBriefConcept,
  serializeBriefConcept,
} from "@/6-1-dashboard/modal/briefConceptAssets";

const org = "11111111-1111-4111-8111-111111111111";
const plan = "22222222-2222-4222-8222-222222222222";

describe("location frames", () => {
  it("follows the selected content type", () => {
    expect(locationFrameForContentType("Reel")).toBe("9:16");
    expect(locationFrameForContentType("Story")).toBe("9:16");
    expect(locationFrameForContentType("Youtube")).toBe("16:9");
    expect(locationFrameForContentType("Post")).toBeNull();
    expect(locationFrameForContentType("Post", "4:5")).toBe("4:5");
    expect(locationFrameForContentType("Carousel", "1:1")).toBe("1:1");
  });

  it("keeps a location image when the concept is saved again", () => {
    const locationPath = `${org}/brief/${plan}/location_park-location.jpg`;
    const stored = serializeBriefConcept({
      postAspect: "1:1",
      locations: [{ handle: "@location_park", description: "A park", locationPath, visualRevision: 4 }],
      characters: [],
      properties: [],
    });
    const incoming = serializeBriefConcept({
      locations: [{ handle: "@location_park", description: "A serene public park." }],
      characters: [],
      properties: [],
    });
    const merged = parseBriefConcept(mergeBriefConceptVisuals(stored, incoming));
    expect(merged?.postAspect).toBe("1:1");
    expect(merged?.locations[0]?.locationPath).toBe(locationPath);
    expect(merged?.locations[0]?.description).toBe("A serene public park.");
  });

  it("keeps a property image when the concept is saved again", () => {
    const propertyPath = `${org}/brief/${plan}/property_bill-property.jpg`;
    const stored = serializeBriefConcept({
      locations: [],
      characters: [],
      properties: [{ handle: "@property_bill", description: "A bill", propertyPath, visualRevision: 2 }],
    });
    const incoming = serializeBriefConcept({
      locations: [],
      characters: [],
      properties: [{ handle: "@property_bill", description: "An unpaid paper bill." }],
    });
    const merged = parseBriefConcept(mergeBriefConceptVisuals(stored, incoming));
    expect(merged?.properties[0]?.propertyPath).toBe(propertyPath);
    expect(merged?.properties[0]?.description).toBe("An unpaid paper bill.");
  });
});
