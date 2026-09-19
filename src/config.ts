import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  PUBLIC_URL: z.string().url().default("http://localhost:3001"),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must have at least 8 characters"),
  JWT_SECRET: z.string().min(24, "JWT_SECRET must have at least 24 characters"),
  UPLOAD_DIR: z.string().default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(5),
});

export const env = envSchema.parse(process.env);
