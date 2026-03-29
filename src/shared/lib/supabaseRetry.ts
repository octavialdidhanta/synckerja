interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  retryableErrors: [
    "Failed to fetch",
    "ERR_CONNECTION_CLOSED",
    "NetworkError",
    "Network request failed",
    "Network request timeout",
    "AuthRetryableFetchError",
    "ERR_FAILED",
    "CORS",
    "520",
    "timeout",
  ],
};

export function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { message?: string; name?: string; code?: string; details?: string };
  const errorMessage = e.message || String(error) || "";
  const errorName = e.name || "";
  const errorCode = e.code || "";
  const errorDetails = e.details || "";

  if (errorMessage.includes("520") || errorCode === "520") return true;
  if (errorMessage.toLowerCase().includes("timeout")) return true;
  if (errorMessage.toLowerCase().includes("cors")) return true;

  return DEFAULT_OPTIONS.retryableErrors.some(
    (pattern) =>
      errorMessage.includes(pattern) ||
      errorName.includes(pattern) ||
      errorCode.includes(pattern) ||
      errorDetails.includes(pattern),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      if (!isRetryableError(error)) {
        throw error;
      }
      if (attempt >= opts.maxRetries) {
        throw error;
      }
      const delay = Math.min(opts.initialDelay * Math.pow(2, attempt), opts.maxDelay);
      await sleep(delay);
    }
  }

  throw lastError;
}

export async function retryableAuthOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  return withRetry(operation, {
    maxRetries: 1,
    initialDelay: 300,
    maxDelay: 1000,
    ...options,
  });
}

export async function retryableQuery<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  return withRetry(operation, {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    ...options,
  });
}
