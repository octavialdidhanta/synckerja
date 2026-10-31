import { z } from "zod";

export const monthPattern = /^[0-9]{4}-(?:0[1-9]|1[0-2])$/;

export const monthInput = z.object({
  month: z.string().regex(monthPattern).optional(),
}).strict();

export const emptyInput = z.object({}).strict();
