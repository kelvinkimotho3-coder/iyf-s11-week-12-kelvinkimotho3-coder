import "dotenv/config";
import crypto from "node:crypto";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { getUserById, upsertUser } from "./db";

const SESSION_COOKIE = process.env.COOKIE_NAME || "tech_hub_session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "development-only-change-me");

export interface GithubProfile { id: number; login: string; name: string | null; email: string | null; avatar_url?: string; }

declare global { namespace Express { interface Request { userId?: number | null; } } }

export function buildGithubAuthorizeUrl(state: string) {
  const params = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID || "", redirect_uri: process.env.AUTH_CALLBACK_URL || "", scope: "read:user user:email", state });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: process.env.AUTH_CALLBACK_URL }) });
  const data = (await response.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(data.error_description || "Failed to exchange GitHub code for a token");
  return data.access_token;
}

export async function fetchGithubUser(accessToken: string): Promise<GithubProfile> {
  const response = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error("Failed to fetch GitHub user profile");
  const profile = (await response.json()) as { id: number; login: string; name: string | null; email: string | null; avatar_url?: string };
  let email = profile.email;
  if (!email) {
    const emailsResponse = await fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" } });
    if (emailsResponse.ok) {
      const emails = (await emailsResponse.json()) as Array<{ email: string; primary: boolean }>;
      const primary = emails.find(e => e.primary) ?? emails[0];
      email = primary?.email ?? null;
    }
  }
  return { id: profile.id, login: profile.login, name: profile.name ?? profile.login, email, avatar_url: profile.avatar_url };
}

export async function signSession(userId: number) {
  return new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(process.env.JWT_EXPIRES_IN || "7d").sign(JWT_SECRET);
}

export async function readSessionUserId(req: Request): Promise<number | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, JWT_SECRET); return typeof payload.userId === "number" ? payload.userId : null; } catch { return null; }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" });
}

export function clearSessionCookie(res: Response, _token?: string) { res.clearCookie(SESSION_COOKIE, { path: "/" }); }

export async function attachSession(req: Request, _res: Response, next: NextFunction) { req.userId = await readSessionUserId(req); next(); }

export const authRouter = Router();

authRouter.get("/github", (req: Request, res: Response) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) return res.status(500).send("GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.");
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 5 * 60 * 1000 });
  res.redirect(buildGithubAuthorizeUrl(state));
});

authRouter.get("/github/callback", async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const expectedState = req.cookies?.oauth_state;
    if (!code || typeof code !== "string") return res.status(400).send("Missing authorization code");
    if (!state || state !== expectedState) return res.status(400).send("Invalid OAuth state");
    const accessToken = await exchangeCodeForToken(code);
    const user = await upsertUser(await fetchGithubUser(accessToken));
    const sessionToken = await signSession(user.id);
    setSessionCookie(res, sessionToken);
    res.clearCookie("oauth_state");
    res.redirect(process.env.AUTH_SERVER_URL || "/");
  } catch (error) { console.error("GitHub OAuth callback failed:", error); res.redirect("/?login_error=1"); }
});

authRouter.get("/me", async (req: Request, res: Response) => {
  if (!req.userId) return res.json(null);
  const user = await getUserById(req.userId);
  res.json(user ?? null);
});

authRouter.post("/logout", (_req: Request, res: Response) => { clearSessionCookie(res); res.json({ success: true }); });
