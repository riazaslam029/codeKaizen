import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(255)),
  password: z.string().min(1, "Password is required").max(128, "Password is too long"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changeRoleSchema = z.object({
  role: z.enum(["ADMIN", "EXAMINER", "CANDIDATE"]),
});
