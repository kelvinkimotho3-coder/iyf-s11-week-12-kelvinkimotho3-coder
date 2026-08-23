import { describe, expect, it, vi } from "vitest";
import { clearSessionCookie } from "./auth";

describe("clearSessionCookie", () => {
  it("clears the configured session cookie name on the response", () => {
    const res = { clearCookie: vi.fn() } as any;
    clearSessionCookie(res);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    const [cookieName, options] = res.clearCookie.mock.calls[0];
    expect(cookieName).toBe(process.env.COOKIE_NAME || "tech_hub_session");
    expect(options).toMatchObject({ path: "/" });
  });
});

describe("POST /api/auth/logout route", () => {
  it("clears the cookie and returns { success: true }", async () => {
    const { authRouter } = await import("./auth");
    const logoutLayer = authRouter.stack.find((layer: any) => layer.route?.path === "/logout");
    expect(logoutLayer).toBeTruthy();
    const handler = logoutLayer!.route!.stack[0].handle;
    const res = { clearCookie: vi.fn(), json: vi.fn() } as any;
    handler({} as any, res, vi.fn());
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
