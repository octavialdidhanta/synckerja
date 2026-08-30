export const POS_CHECKOUT_WALK_IN_CLIENT = "Walk-in";
export const POS_CHECKOUT_PHONE_EXISTS = "pos_checkout_phone_exists";

export type PosCheckoutLeadRow = {
  id: string;
  client: string;
  phone_number: string | null;
  source: string | null;
  ticket_id: string;
  updated_at: string | null;
  created_at: string | null;
};

export type EnsurePosCheckoutLeadInput = {
  organizationId: string;
  phone?: string | null;
  clientName?: string | null;
  userId?: string | null;
};

export type EnsurePosCheckoutLeadResult = {
  leadId: string;
  boundByPhone: boolean;
  created: boolean;
};

export type PosCheckoutLeadWritePlan =
  | {
      action: "insert_walkin";
      client: string;
      boundByPhone: false;
    }
  | {
      action: "reuse";
      leadId: string;
      phoneKey: string;
      clientPatch: string | null;
      boundByPhone: true;
    }
  | {
      action: "insert_with_phone";
      phoneKey: string;
      client: string;
      boundByPhone: true;
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
