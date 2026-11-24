import { describe, expect, it } from "vitest";
import { MCP_TOOLS } from "../src/mcp/registry";
import { MCP_SERVER_INSTRUCTIONS } from "../src/mcp/instructions";
import { PLAYBOOKS, playbookGetResult } from "../src/tools/playbook/playbookGet";

const toolNames = new Set<string>(MCP_TOOLS.map((t) => t.name));

/** Dotted tool names such as render.jobs.draft or footage.scenes.upsert_batch.preview. */
function mentionedTools(text: string): string[] {
  const hits = text.match(/\b[a-z][a-z_]*(?:\.[a-z][a-z_]*)+\b/g) ?? [];
  return [...new Set(hits)];
}

describe("playbook.get", () => {
  it("serves the video edit playbook with a version", () => {
    const r = playbookGetResult({ task: "video_edit" });
    expect(r.task).toBe("video_edit");
    expect(r.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(r.playbook.length).toBeGreaterThan(500);
    expect(() => playbookGetResult({ task: "nope" })).toThrow("invalid_input");
  });

  it("only names tools that exist, so a renamed or removed tool fails here before a tenant sees it", () => {
    for (const [task, p] of Object.entries(PLAYBOOKS)) {
      const unknown = mentionedTools(p.body).filter((n) => !toolNames.has(n));
      expect(unknown, `playbook ${task}`).toEqual([]);
    }
  });

  it("stays organization-neutral: no tenant names, laptop paths or brand-only rules", () => {
    for (const p of Object.values(PLAYBOOKS)) {
      expect(p.body).not.toMatch(/sate sultan|pik ?[12]\b|sate babi|hijab|[A-Z]:\\/i);
    }
  });

  it("is announced to every client in the server instructions", () => {
    expect(MCP_SERVER_INSTRUCTIONS).toContain("playbook.get");
    expect(toolNames.has("playbook.get")).toBe(true);
  });
});
