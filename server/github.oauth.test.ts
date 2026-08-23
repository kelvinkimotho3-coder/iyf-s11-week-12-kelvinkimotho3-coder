import { beforeEach, describe, expect, it } from "vitest";

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => { process.env = { ...ORIGINAL_ENV, GITHUB_CLIENT_ID: "test_client_id", GITHUB_CLIENT_SECRET: "test_client_secret", AUTH_CALLBACK_URL: "http://localhost:3000/api/auth/github/callback", JWT_SECRET: "test-secret-value-not-for-production" }; });

describe("buildGithubAuthorizeUrl", () => {
  it("includes the configured client id, callback url, and provided state", async () => {
    const { buildGithubAuthorizeUrl } = await import("./auth");
    const url = buildGithubAuthorizeUrl("random-state-123");
    expect(url).toContain("https://github.com/login/oauth/authorize?");
    expect(url).toContain("client_id=test_client_id");
    expect(url).toContain("state=random-state-123");
    expect(url).toContain(encodeURIComponent(process.env.AUTH_CALLBACK_URL!));
  });
});

describe("JWT session issuance and verification", () => {
  it("signs a session token that readSessionUserId can verify back to the same userId", async () => {
    const { signSession, readSessionUserId } = await import("./auth");
    const token = await signSession(42);
    const fakeRequest = { cookies: { [process.env.COOKIE_NAME || "tech_hub_session"]: token } } as any;
    expect(typeof token).toBe("string");
    expect(await readSessionUserId(fakeRequest)).toBe(42);
  });
  it("returns null for a missing or invalid token instead of throwing", async () => {
    const { readSessionUserId } = await import("./auth");
    expect(await readSessionUserId({ cookies: {} } as any)).toBeNull();
    expect(await readSessionUserId({ cookies: { [process.env.COOKIE_NAME || "tech_hub_session"]: "not-a-real-jwt" } } as any)).toBeNull();
  });
});
