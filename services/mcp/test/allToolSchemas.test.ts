import { describe, expect, it } from "vitest";
import { MCP_TOOLS } from "../src/mcp/registry";
import { publishedToolShape, publishedInputFor } from "../src/mcp/handler";

describe("every tool schema", () => {
  it("can be published to MCP clients", () => {
    for (const tool of MCP_TOOLS) {
      expect(() => publishedToolShape(publishedInputFor(tool.name)), tool.name).not.toThrow();
    }
  });
});
