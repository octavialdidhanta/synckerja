import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import { normalizeCustomerEmail } from "./normalizeCustomerEmail";

export type CustomerIdentityKind = "phone" | "email";

export type CustomerIdentityKey = {
  kind: CustomerIdentityKind;
  /** Stable React/list id: `phone:628…` or `email:a@b.com` */
  id: string;
  phoneKey: string | null;
  emailKey: string | null;
};

/**
 * Resolve CLV identity: phone wins over email. No phone+email → null (exclude).
 */
export function resolveCustomerIdentityKey(args: {
  phone?: string | null;
  email?: string | null;
}): CustomerIdentityKey | null {
  const phoneKey = normalizeCustomerVisitPhone(args.phone);
  const emailKey = normalizeCustomerEmail(args.email);

  if (phoneKey) {
    return {
      kind: "phone",
      id: `phone:${phoneKey}`,
      phoneKey,
      emailKey,
    };
  }
  if (emailKey) {
    return {
      kind: "email",
      id: `email:${emailKey}`,
      phoneKey: null,
      emailKey,
    };
  }
  return null;
}
