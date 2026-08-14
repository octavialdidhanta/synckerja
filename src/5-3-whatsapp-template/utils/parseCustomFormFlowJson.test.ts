import { describe, expect, it } from "vitest";
import { buildCustomFormFlowJson } from "./buildCustomFormFlowJson";
import { canParseCustomFormFlowJson, parseCustomFormFlowJson } from "./parseCustomFormFlowJson";

describe("parseCustomFormFlowJson", () => {
  it("round-trips buildCustomFormFlowJson model", () => {
    const model = {
      screenTitle: "Wedding Service",
      introText: "Tell us about your event",
      fields: [
        { name: "nama", label: "Nama", inputType: "text" as const, required: true },
        { name: "email", label: "Email", inputType: "email" as const, required: false },
      ],
    };
    const { flowJson } = buildCustomFormFlowJson(model);
    const parsed = parseCustomFormFlowJson(flowJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.model.screenTitle).toBe(model.screenTitle);
    expect(parsed.model.introText).toBe(model.introText);
    expect(parsed.model.fields).toHaveLength(2);
    expect(parsed.model.fields[0]?.name).toBe("nama");
    expect(canParseCustomFormFlowJson(flowJson)).toBe(true);
  });

  it("returns false for empty screens", () => {
    expect(parseCustomFormFlowJson({ version: "5.0", screens: [] }).ok).toBe(false);
  });

  it("returns false when no TextEntry fields", () => {
    const result = parseCustomFormFlowJson({
      version: "5.0",
      screens: [
        {
          id: "ONLY_HEADING",
          layout: { type: "SingleColumnLayout", children: [{ type: "TextHeading", text: "Hi" }] },
        },
      ],
    });
    expect(result.ok).toBe(false);
  });
});
