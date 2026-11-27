import type { AttemptService } from "@/services/attempts/attempt.service";

/** Exactly what GET /api/attempts/[id] returns (type-only import: no server code reaches the client). */
export type AttemptState = Awaited<ReturnType<typeof AttemptService.getState>>;
