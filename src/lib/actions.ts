import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import type { ActionResult } from "./action-types";
import { ApiError } from "./http";

/** Runs a server-action body and converts thrown ApiError/ZodError into a typed ActionResult. */
export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ApiError) return { ok: false, error: err.message };
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        fieldErrors[key] ??= issue.message;
      }
      return { ok: false, error: err.issues[0]?.message ?? "Invalid input", fieldErrors };
    }
    console.error("[action] unhandled error", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
