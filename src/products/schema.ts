import { z } from "zod";

export const paletteSchema = z.object({
  foam: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  top: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bottom: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const productInputSchema = z.object({
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(180),
  nameEn: z.string().trim().max(180).nullable().optional(),
  tagline: z.string().trim().max(1000).default(""),
  price: z.coerce.number().min(0).max(1_000_000),
  likes: z.coerce.number().int().min(0).max(10_000_000).default(0),
  emoji: z.string().trim().min(1).max(32).default("🥤"),
  category: z.string().trim().min(1).max(80),
  palette: paletteSchema.default({
    foam: "#fff2f6",
    top: "#ff9ec0",
    bottom: "#f0507f",
  }),
  badge: z.string().trim().max(80).nullable().optional(),
  popular: z.boolean().default(false),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  soldOut: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(-100_000).max(100_000).default(0),
});

export type ProductInput = z.infer<typeof productInputSchema>;
