import { z } from "zod";

export const contentUpdateSchema = z.object({
  value: z.json(),
});

export const orderInputSchema = z.object({
  customerName: z.string().trim().max(180).nullable().optional(),
  customerPhone: z.string().trim().max(50).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  source: z.string().trim().max(40).default("web"),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(240),
        name: z.string().trim().min(1).max(240),
        price: z.coerce.number().min(0).max(1_000_000),
        qty: z.coerce.number().int().min(1).max(100),
        options: z.array(z.string().trim().max(300)).max(30).default([]),
      }),
    )
    .min(1)
    .max(100),
});

export const orderStatusSchema = z.object({
  status: z.enum(["new", "confirmed", "preparing", "ready", "completed", "cancelled"]),
});
