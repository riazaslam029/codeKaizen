import { z } from "zod";

const isoDate = z.iso.datetime({ offset: true, message: "Enter a valid date and time" });

export const examSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/, "3–32 letters, digits or hyphens (e.g. WSEC-101)"),
    description: z.string().trim().max(2000).optional().default(""),
    instructions: z.string().trim().max(5000).optional().default(""),
    startsAt: isoDate,
    endsAt: isoDate,
    durationMinutes: z.coerce.number().int().min(1, "At least 1 minute").max(600, "At most 10 hours"),
    passPercentage: z.coerce.number().int().min(0).max(100),
    maxAttempts: z.coerce.number().int().min(1).max(10),
    shuffleQuestions: z.coerce.boolean(),
    shuffleOptions: z.coerce.boolean(),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    path: ["endsAt"],
    message: "The window must end after it starts",
  })
  .refine((v) => new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime() >= v.durationMinutes * 60_000, {
    path: ["durationMinutes"],
    message: "Duration is longer than the availability window",
  });

export type ExamInput = z.infer<typeof examSchema>;

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(2000),
});
