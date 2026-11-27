import { randomBytes, randomInt } from "node:crypto";

/** Fisher–Yates with a cryptographic RNG (so candidates cannot predict another's order). */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I to avoid transcription errors

/** e.g. CKZ-7KQ2-M9XD-P4TA — 60 random bits, unguessable, easy to read aloud. */
export function verificationCode(): string {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
  return `CKZ-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}
