import { z } from "zod";

export const clientSessionId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

const response = z.union([
  z.object({ optionIds: z.array(z.string().regex(/^[a-h]$/)).max(8) }),
  z.object({ text: z.string().max(20_000, "Answer is too long (20,000 characters max)") }),
]);

export const saveAnswersSchema = z.object({
  clientSessionId: clientSessionId.optional(),
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        response: response.nullable(),
        flagged: z.boolean().default(false),
        revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
      }),
    )
    .min(1)
    .max(200),
});

/** Events the browser may report. Reported as indicators only — never as proof of misconduct. */
export const clientEventSchema = z.object({
  type: z.enum(["NETWORK_LOSS", "RECONNECTED", "SYNC_FAILED"]),
  details: z
    .object({
      offlineSeconds: z.number().min(0).max(86_400).optional(),
      failures: z.number().int().min(0).max(10_000).optional(),
      message: z.string().max(300).optional(),
    })
    .default({}),
});

export const scratchpadSchema = z.object({
  pages: z
    .array(
      z.object({
        id: z.string().max(40),
        title: z.string().max(60),
        notes: z.string().max(50_000),
        strokes: z
          .array(
            z.object({
              points: z.array(z.tuple([z.number(), z.number()])).max(5000),
              width: z.number().min(0.5).max(40),
              erase: z.boolean().optional(),
            }),
          )
          .max(2000),
      }),
    )
    .min(1)
    .max(10),
});

export const preferencesSchema = z.object({
  fontSize: z.enum(["sm", "md", "lg", "xl"]),
  showNavigator: z.boolean(),
  layout: z.enum(["split", "focus"]),
  theme: z.enum(["light", "dark", "contrast"]),
});
