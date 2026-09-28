export type Resolution = "RESOLVED" | "UNRESOLVED";

export type TriState = boolean | "unresolved";

export type IndividualAdmission = "GENERATE_VALID" | "GENERATE_REJECT" | "UNRESOLVED" | "STALE";

export type AuditVerdict = "AUDIT_PASS" | "AUDIT_FAIL" | "UNRESOLVED" | "STALE";

export const LAB_WORKSPACE = "thinking_lab";

export const LAB_SET_SCHEMA = "thinking-lab/v1";
