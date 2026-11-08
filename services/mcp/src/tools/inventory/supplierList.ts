import { z } from "zod";

export const supplierListInput = z.object({
  search: z.string().trim().max(80).optional(),
}).strict();

export type SupplierRow = { id: string; name: string; phone: string | null; city: string | null };
