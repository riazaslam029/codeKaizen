import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(255));
const name = z.string().trim().min(2, "Name must be at least 2 characters").max(120);
export const password = z.string().min(8, "Password must be at least 8 characters").max(128);
export const role = z.enum(["ADMIN", "EXAMINER", "CANDIDATE"]);

export const createUserSchema = z.object({ name, email, role, password });
export const updateUserSchema = z.object({
  name,
  email,
  /** Optional password reset; empty string = keep current. */
  password: z.union([z.literal(""), password]).optional(),
});
export const createCandidateSchema = z.object({ name, email, password });

export type CreateUserInput = z.infer<typeof createUserSchema>;
