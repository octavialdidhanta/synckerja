import { describe, expect, it } from "vitest";
import { buildCustomFormFlowJson } from "./buildCustomFormFlowJson";
import { normalizeMetaFlowJsonDocument } from "./normalizeMetaFlowJsonDocument";
import { parseCustomFormFlowJson } from "./parseCustomFormFlowJson";
import { validateFlowJsonSyntax } from "./validateFlowJsonSyntax";

describe("normalizeMetaFlowJsonDocument", () => {
  it("unwraps flow_json wrapper", () => {
    const { flowJson } = buildCustomFormFlowJson({
      screenTitle: "Wedding Service",
      fields: [{ name: "nama", label: "Nama", inputType: "text", required: true }],
    });
    const wrapped = { flow_json: flowJson };
    const normalized = normalizeMetaFlowJsonDocument(wrapped);
    expect(normalized?.version).toBe("7.3");
    expect(Array.isArray(normalized?.screens)).toBe(true);
    expect(parseCustomFormFlowJson(normalized).ok).toBe(true);
  });

  it("unwraps legacy flowJson key", () => {
    const { flowJson, entryScreenId } = buildCustomFormFlowJson({
      screenTitle: "Legacy",
      fields: [{ name: "nama", label: "Nama", inputType: "text", required: true }],
    });
    const legacy = { flowJson, entryScreenId };
    const normalized = normalizeMetaFlowJsonDocument(legacy);
    expect(parseCustomFormFlowJson(normalized).ok).toBe(true);
  });

  it("validateFlowJsonSyntax accepts wrapped JSON text", () => {
    const { flowJson } = buildCustomFormFlowJson({
      screenTitle: "Wrapped",
      fields: [{ name: "email", label: "Email", inputType: "email", required: false }],
    });
    const result = validateFlowJsonSyntax(JSON.stringify({ flow_json: flowJson }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.version).toBe("7.3");
    }
  });

  it("migrates legacy TextEntry components to TextInput", () => {
    const doc = {
      version: "5.0",
      screens: [
        {
          id: "CUSTOM_FORM_SCREEN",
          layout: {
            type: "SingleColumnLayout",
            children: [{ type: "TextEntry", name: "nama", label: "Nama", required: true }],
          },
        },
      ],
    };
    const normalized = normalizeMetaFlowJsonDocument(doc);
    const children = (
      (normalized?.screens as Array<{ layout?: { children?: Array<{ type?: string }> } }> | undefined)?.[0]
        ?.layout?.children ?? []
    );
    expect(children[0]?.type).toBe("TextInput");
    expect(normalized?.version).toBe("7.3");
  });
});
