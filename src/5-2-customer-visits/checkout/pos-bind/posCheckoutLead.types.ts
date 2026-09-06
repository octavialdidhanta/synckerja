export type PosCheckoutLeadRow = {
  id: string;
  client: string;
  phone_number: string | null;
  email: string | null;
  source: string | null;
  ticket_id: string;
  updated_at: string | null;
  created_at: string | null;
};

export const POS_CHECKOUT_WALK_IN_CLIENT = "Walk-in";
export const POS_CHECKOUT_PHONE_EXISTS = "pos_checkout_phone_exists";

export type EnsurePosCheckoutLeadInput = {
  organizationId: string;
  phone?: string | null;
  email?: string | null;
  clientName?: string | null;
  userId?: string | null;
};

export type EnsurePosCheckoutLeadResult = {
  leadId: string;
  boundByPhone: boolean;
  boundByEmail: boolean;
  created: boolean;
};

export type PosCheckoutLeadWritePlan =
  | {
      action: "insert_walkin";
      client: string;
      emailKey: string | null;
      boundByPhone: false;
      boundByEmail: false;
    }
  | {
      action: "reuse";
      leadId: string;
      phoneKey: string;
      emailKey: string | null;
      clientPatch: string | null;
      boundByPhone: true;
      boundByEmail: false;
    }
  | {
      action: "reuse_email";
      leadId: string;
      emailKey: string;
      phoneKey: string | null;
      clientPatch: string | null;
      boundByPhone: false;
      boundByEmail: true;
    }
  | {
      action: "bridge_merge";
      phoneLeadId: string;
      emailLeadId: string;
      phoneKey: string;
      emailKey: string;
      boundByPhone: true;
      boundByEmail: true;
    }
  | {
      action: "insert_with_phone";
      phoneKey: string;
      emailKey: string | null;
      client: string;
      boundByPhone: true;
      boundByEmail: false;
    };

export type PosReceiptRematchPlan =
  | {
      action: "rebind";
      winnerLeadId: string;
      personalName: string | null;
      writePhoneOnCurrent: false;
    }
  | {
      action: "update_current";
      phoneKey: string;
      personalName: string | null;
      writePhoneOnCurrent: true;
    };

export type PosReceiptEmailRematchPlan =
  | {
      action: "rebind";
      winnerLeadId: string;
      personalName: string | null;
      writeEmailOnCurrent: false;
    }
  | {
      action: "update_current";
      emailKey: string;
      personalName: string | null;
      writeEmailOnCurrent: true;
    };

export type RecordPosPaidCustomerVisitInput = {
  organizationId: string;
  leadId: string;
  salesActivityId: string;
  phoneKey: string;
  lookupRaw?: string | null;
  createdBy?: string | null;
};

export type RecordPosPaidCustomerVisitResult = {
  visitId: string;
  reused: boolean;
};

export type RematchPosReceiptLeadInput = {
  organizationId: string;
  salesActivityId: string;
  currentLeadId: string;
  phoneKey: string;
  clientName?: string | null;
  createdBy?: string | null;
};

export type RematchPosReceiptLeadResult = {
  leadId: string;
  rebound: boolean;
  visitId: string | null;
};

export type RematchPosReceiptLeadByEmailInput = {
  organizationId: string;
  salesActivityId: string;
  currentLeadId: string;
  email: string;
  clientName?: string | null;
  createdBy?: string | null;
};
