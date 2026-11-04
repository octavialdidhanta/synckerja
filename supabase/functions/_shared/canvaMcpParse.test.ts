import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseMcpRpcBody, readCanvaToolJson, toolNamesFromListResult } from "./canvaMcpParse.ts";

Deno.test("parseMcpRpcBody reads a JSON result", () => {
  const parsed = parseMcpRpcBody(
    JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "create-design" }] } }),
    2,
  );
  assertEquals(parsed.ok, true);
  if (parsed.ok) {
    assertEquals(toolNamesFromListResult(parsed.result), ["create-design"]);
  }
});

Deno.test("parseMcpRpcBody reads an SSE data line and ignores another id", () => {
  const raw = [
    "event: message",
    'data: {"jsonrpc":"2.0","id":1,"result":{"ignored":true}}',
    "",
    'data: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"export-design"}]}}',
    "",
  ].join("\n");
  const parsed = parseMcpRpcBody(raw, 2);
  assertEquals(parsed.ok, true);
  if (parsed.ok) {
    assertEquals(toolNamesFromListResult(parsed.result), ["export-design"]);
  }
});

Deno.test("readCanvaToolJson unwraps the job from MCP content", () => {
  const job = readCanvaToolJson({
    content: [{
      type: "text",
      text: JSON.stringify({
        job_id: "job-1",
        status: "pending",
        polling_policy: { wait_seconds: 15 },
      }),
    }],
  });
  assertEquals(job.job_id, "job-1");
  assertEquals(job.status, "pending");
});

Deno.test("readCanvaToolJson turns an MCP tool error into a failed job", () => {
  const job = readCanvaToolJson({
    isError: true,
    content: [{ type: "text", text: "Unknown format" }],
  });
  assertEquals(job.status, "failed");
});

Deno.test("parseMcpRpcBody returns the JSON-RPC error message", () => {
  const parsed = parseMcpRpcBody(
    JSON.stringify({ jsonrpc: "2.0", id: 2, error: { code: -32601, message: "Method not found" } }),
    2,
  );
  assertEquals(parsed, { ok: false, message: "Method not found" });
});
