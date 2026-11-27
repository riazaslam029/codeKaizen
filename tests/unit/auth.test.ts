import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/session";
import { homeForRole, SESSION_TTL_SECONDS, verifySessionToken } from "@/lib/auth/token";

const key = new TextEncoder().encode(process.env.AUTH_SECRET!);
const otherKey = new TextEncoder().encode("a-completely-different-secret-of-sufficient-length");

describe("password hashing (bcrypt)", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const h = await hashPassword("Correct-Horse-1");
    expect(h).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPassword("Correct-Horse-1", h)).toBe(true);
    expect(await verifyPassword("correct-horse-1", h)).toBe(false);
  });
  it("salts: the same password hashes differently each time", async () => {
    expect(await hashPassword("same-password")).not.toBe(await hashPassword("same-password"));
  });
  it("dummy hash is a real bcrypt hash (constant-time path for unknown emails)", async () => {
    const d = await getDummyHash();
    expect(d).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPassword("anything", d)).toBe(false);
  });
});

describe("session tokens (jose HS256)", () => {
  it("round-trips a signed session", async () => {
    const t = await signSession({ userId: "11111111-1111-4111-8111-111111111111", role: "EXAMINER" });
    const s = await verifySessionToken(t, key);
    expect(s).toMatchObject({ userId: "11111111-1111-4111-8111-111111111111", role: "EXAMINER" });
    expect(s!.expiresAt - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(SESSION_TTL_SECONDS);
  });
  it("rejects a token signed with another key", async () => {
    const t = await signSession({ userId: "u", role: "ADMIN" });
    expect(await verifySessionToken(t, otherKey)).toBeNull();
  });
  it("rejects a tampered payload (role escalation attempt)", async () => {
    const t = await signSession({ userId: "u", role: "CANDIDATE" });
    const [h, , sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ role: "ADMIN", sub: "u", iss: "codekaizen", aud: "codekaizen-web", exp: 9999999999 })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forged}.${sig}`, key)).toBeNull();
  });
  it("rejects expired tokens", async () => {
    const t = await new SignJWT({ role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setSubject("u").setIssuer("codekaizen").setAudience("codekaizen-web").setIssuedAt(1).setExpirationTime(2).sign(key);
    expect(await verifySessionToken(t, key)).toBeNull();
  });
  it("rejects wrong issuer / audience", async () => {
    const t = await new SignJWT({ role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setSubject("u").setIssuer("evil").setAudience("codekaizen-web").setExpirationTime("1h").sign(key);
    expect(await verifySessionToken(t, key)).toBeNull();
  });
  it("rejects unknown roles and missing subject", async () => {
    const badRole = await new SignJWT({ role: "ROOT" }).setProtectedHeader({ alg: "HS256" }).setSubject("u").setIssuer("codekaizen").setAudience("codekaizen-web").setExpirationTime("1h").sign(key);
    const noSub = await new SignJWT({ role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setIssuer("codekaizen").setAudience("codekaizen-web").setExpirationTime("1h").sign(key);
    expect(await verifySessionToken(badRole, key)).toBeNull();
    expect(await verifySessionToken(noSub, key)).toBeNull();
  });
  it("rejects alg=none and garbage", async () => {
    const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sub":"u","role":"ADMIN"}').toString("base64url")}.`;
    expect(await verifySessionToken(none, key)).toBeNull();
    expect(await verifySessionToken("not-a-jwt", key)).toBeNull();
    expect(await verifySessionToken(undefined, key)).toBeNull();
  });
  it("routes each role to its own area", () => {
    expect(homeForRole("ADMIN")).toBe("/admin");
    expect(homeForRole("EXAMINER")).toBe("/examiner");
    expect(homeForRole("CANDIDATE")).toBe("/candidate");
  });
});
