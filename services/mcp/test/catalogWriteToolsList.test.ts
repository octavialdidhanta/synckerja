import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { publishedToolShape } from "../src/mcp/handler";
import {
  referenceUpsertPreviewInput,
  shotlistUpsertPreviewInput,
  styleUpdatePreviewInput,
} from "../src/tools/catalog/libraryWrite";

describe("catalog write tools in tools/list", () => {
  it("publishes the write preview schemas through the MCP SDK", async () => {
    const server = new McpServer({ name: "t", version: "0" });
    const inputs = {
      "catalog.style.update.preview": styleUpdatePreviewInput,
      "catalog.reference.upsert.preview": referenceUpsertPreviewInput,
      "catalog.shotlist.upsert.preview": shotlistUpsertPreviewInput,
    };
    for (const [name, schema] of Object.entries(inputs)) {
      server.registerTool(name, { description: name, inputSchema: publishedToolShape(schema) }, async () => ({
        content: [{ type: "text" as const, text: "ok" }],
      }));
    }
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "c", version: "0" });
    await client.connect(b);
    const listed = await client.listTools();
    expect(listed.tools.map((t) => t.name).sort()).toEqual(Object.keys(inputs).sort());
    const ref = listed.tools.find((t) => t.name === "catalog.reference.upsert.preview");
    expect(ref?.inputSchema.properties).toHaveProperty("document");
  });
});
