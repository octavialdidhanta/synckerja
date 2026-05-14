import type { OmnichannelStaffRole } from "@/shared/hooks/useOrganizationOmnichannelStaff";

export type UserPresenceStatus = "online" | "offline";

export type OmnichannelUserManagementRow = {
  rosterId: string;
  employeeId: string;
  fullName: string;
  presenceStatus: UserPresenceStatus;
  phone: string;
  email: string;
  role: OmnichannelStaffRole;
};
