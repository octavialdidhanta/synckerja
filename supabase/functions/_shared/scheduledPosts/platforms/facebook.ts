import { buildScheduleStubError } from "./stubErrors.ts";

export function executeFacebookScheduledPostStub(): never {
  throw new Error(buildScheduleStubError("manual_only", "Facebook", "manual_only"));
}
