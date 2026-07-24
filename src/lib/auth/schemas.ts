import { z } from "zod";

// Shape-only validation. Whether the e-mail/password combination is actually
// valid is decided by the backend against the database — this schema never
// tells the client anything about whether an account exists.
export const loginRequestSchema = z.object({
  email: z.string().trim().min(1).max(320),
  senha: z.string().min(1).max(200),
  manterConectado: z.boolean().optional(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
