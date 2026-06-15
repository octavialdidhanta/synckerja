import { readBrickEnv, simulateBrickCloseVaPayment } from "../brickApi.ts";
import { brickJson } from "../brickAuth.ts";

export async function handleBrickSimulateVa(
  body: Record<string, unknown>,
): Promise<Response> {
  const vaId = String(body.vaId ?? "").trim();
  const simulateAction = String(body.simulateAction ?? "COMPLETED").trim().toUpperCase();

  if (!vaId) {
    return brickJson({ error: "vaId is required (CL_xxx for PAID, PAY_xxx for COMPLETED)" }, 400);
  }
  if (simulateAction !== "PAID" && simulateAction !== "COMPLETED") {
    return brickJson({ error: "simulateAction must be PAID or COMPLETED" }, 400);
  }

  const env = readBrickEnv();
  if (!env) {
    return brickJson({
      error: "Brick is not configured. Set BRICK_CLIENT_ID and BRICK_CLIENT_SECRET.",
    }, 503);
  }

  try {
    const result = await simulateBrickCloseVaPayment(
      env,
      vaId,
      simulateAction as "PAID" | "COMPLETED",
    );
    return brickJson({ ok: true, vaId, simulateAction, result }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Simulate failed";
    return brickJson({ error: message }, 502);
  }
}
