export type CertificationJudgeStage = "INDIVIDUAL_FIRST_PASS" | "INDIVIDUAL_ADVERSARIAL" | "SIBLING";

export type InfrastructureFailureKind = "TRANSPORT_FAILURE" | "PROVIDER_FAILURE" | "AUTH_FAILURE" | "MALFORMED_RESPONSE";

export type CertificationTransportContext = {
  caseId: string;
  runNumber: number;
  stage: CertificationJudgeStage;
};

export const TRANSIENT_HTTP_STATUSES = [429, 500, 502, 503, 504] as const;
export const CERTIFICATION_TRANSIENT_RETRIES = 2;
export const CERTIFICATION_RETRY_DELAY_MS = 500;
export const CERTIFICATION_INTER_CALL_DELAY_MS = 250;

const TRANSIENT_STATUS_SET = new Set<number>(TRANSIENT_HTTP_STATUSES);

export class CertificationInfrastructureError extends Error {
  readonly kind: InfrastructureFailureKind;
  readonly httpStatus: number | null;
  readonly responseError: string | null;
  readonly scriptMissing: boolean;
  readonly caseId: string;
  readonly runNumber: number;
  readonly stage: CertificationJudgeStage;

  constructor(input: {
    kind: InfrastructureFailureKind;
    httpStatus: number | null;
    responseError: string | null;
    scriptMissing: boolean;
    context: CertificationTransportContext;
  }) {
    super(formatInfrastructureFailure(input));
    this.name = "CertificationInfrastructureError";
    this.kind = input.kind;
    this.httpStatus = input.httpStatus;
    this.responseError = input.responseError;
    this.scriptMissing = input.scriptMissing;
    this.caseId = input.context.caseId;
    this.runNumber = input.context.runNumber;
    this.stage = input.context.stage;
  }
}

export function formatInfrastructureFailure(input: {
  kind: InfrastructureFailureKind;
  httpStatus: number | null;
  responseError: string | null;
  scriptMissing: boolean;
  context: CertificationTransportContext;
}): string {
  const error = input.responseError ? ` error=${input.responseError}` : "";
  return `${input.kind} case=${input.context.caseId} run=${input.context.runNumber} stage=${input.context.stage} http=${input.httpStatus ?? "none"} scriptMissing=${input.scriptMissing}${error}`;
}

export function certificationStageFromPrompt(prompt: string): CertificationJudgeStage {
  const opening = prompt.slice(0, 180);
  if (opening.includes("adversarial verifier")) return "INDIVIDUAL_ADVERSARIAL";
  if (opening.includes("sibling distinctness")) return "SIBLING";
  return "INDIVIDUAL_FIRST_PASS";
}

export function isCertificationInfrastructureError(error: unknown): error is CertificationInfrastructureError {
  return error instanceof CertificationInfrastructureError;
}

type AttemptAssessment =
  | { outcome: "script"; script: string }
  | { outcome: "retry" | "fail"; failure: CertificationInfrastructureError };

function readErrorField(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") return JSON.stringify(error);
  return null;
}

function readScript(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const script = (body as { script?: unknown }).script;
  if (typeof script !== "string") return null;
  const trimmed = script.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function assessCertificationAttempt(input: {
  httpStatus: number | null;
  body: unknown;
  jsonParsed: boolean;
  context: CertificationTransportContext;
  networkError?: string | null;
}): AttemptAssessment {
  const responseError = input.networkError?.trim() || readErrorField(input.body);
  const script = input.jsonParsed ? readScript(input.body) : null;
  const scriptMissing = script === null;
  const status = input.httpStatus;
  const context = input.context;
  const failure = (kind: InfrastructureFailureKind) =>
    new CertificationInfrastructureError({
      kind,
      httpStatus: status,
      responseError,
      scriptMissing,
      context,
    });

  if (input.networkError || status === null) return { outcome: "fail", failure: failure("TRANSPORT_FAILURE") };
  if (status === 401 || status === 403) return { outcome: "fail", failure: failure("AUTH_FAILURE") };
  if (TRANSIENT_STATUS_SET.has(status)) return { outcome: "retry", failure: failure("TRANSPORT_FAILURE") };
  if (status < 200 || status >= 300) return { outcome: "fail", failure: failure("PROVIDER_FAILURE") };
  if (responseError) return { outcome: "fail", failure: failure("PROVIDER_FAILURE") };
  if (!input.jsonParsed || scriptMissing || script === null) return { outcome: "fail", failure: failure("MALFORMED_RESPONSE") };
  return { outcome: "script", script };
}

export async function certificationDelay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestCertificationScript(input: {
  prompt: string;
  context: CertificationTransportContext;
  token: string;
  url: string;
  anonKey: string;
  body: unknown;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<string> {
  if (!input.token.trim()) {
    throw new CertificationInfrastructureError({
      kind: "AUTH_FAILURE",
      httpStatus: null,
      responseError: "THINKING_LAB_ACCESS_TOKEN is required",
      scriptMissing: true,
      context: input.context,
    });
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const sleep = input.sleep ?? certificationDelay;
  const maxAttempts = 1 + CERTIFICATION_TRANSIENT_RETRIES;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(input.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.token}`,
          apikey: input.anonKey,
        },
        body: JSON.stringify(input.body),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Network request failed";
      throw new CertificationInfrastructureError({
        kind: "TRANSPORT_FAILURE",
        httpStatus: null,
        responseError: message,
        scriptMissing: true,
        context: input.context,
      });
    }
    const raw = await response.text();
    let jsonParsed = false;
    let body: unknown = null;
    if (raw.trim()) {
      try {
        body = JSON.parse(raw) as unknown;
        jsonParsed = true;
      } catch {
        jsonParsed = false;
      }
    }
    const assessment = assessCertificationAttempt({
      httpStatus: response.status,
      body,
      jsonParsed,
      context: input.context,
    });
    if (assessment.outcome === "script") return assessment.script;
    if (assessment.outcome === "retry" && attempt < maxAttempts) {
      await sleep(CERTIFICATION_RETRY_DELAY_MS * attempt);
      continue;
    }
    throw assessment.failure;
  }
  throw new CertificationInfrastructureError({
    kind: "TRANSPORT_FAILURE",
    httpStatus: null,
    responseError: "Transient request retries were exhausted",
    scriptMissing: true,
    context: input.context,
  });
}
