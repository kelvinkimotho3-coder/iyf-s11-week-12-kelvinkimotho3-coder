import "dotenv/config";
import { and, desc, eq } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { comments, profiles, projectUpvotes, projects, users } from "../drizzle/schema";
import type { GithubProfile } from "./auth";

const schema = { users, profiles, projects, comments, projectUpvotes };

let pool: mysql.Pool | null = null;
let dbInstance: MySql2Database<typeof schema> | null = null;

export async function getDb(): Promise<MySql2Database<typeof schema>> {
  if (dbInstance) return dbInstance;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const newPool = mysql.createPool(process.env.DATABASE_URL);
  const newDb = drizzle(newPool, { schema, mode: "default" });
  pool = newPool;
  dbInstance = newDb;
  return newDb;
}

export async function upsertUser(githubProfile: GithubProfile) {
  const db = await getDb();
  const providerAccountId = `github:${githubProfile.id}`;
  const name = githubProfile.name ?? githubProfile.login;
  const email = githubProfile.email ?? null;
  await db.insert(users).values({ providerAccountId, provider: "github", name, email, lastSignedIn: new Date() }).onDuplicateKeyUpdate({ set: { name, email, lastSignedIn: new Date() } });
  const [user] = await db.select().from(users).where(eq(users.providerAccountId, providerAccountId)).limit(1);
  return user;
}

export async function getUserById(id: number) {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing) return existing;
  await db.insert(profiles).values({ userId, skills: "[]" });
  const [created] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return created;
}

export interface ProfileUpdateInput { bio?: string; skills?: string[]; websiteUrl?: string; githubUrl?: string; linkedinUrl?: string; }

export async function updateProfile(userId: number, input: ProfileUpdateInput) {
  const db = await getDb();
  await getProfileByUserId(userId);
  await db.update(profiles).set({ ...(input.bio !== undefined && { bio: input.bio }), ...(input.skills !== undefined && { skills: JSON.stringify(input.skills) }), ...(input.websiteUrl !== undefined && { websiteUrl: input.websiteUrl }), ...(input.githubUrl !== undefined && { githubUrl: input.githubUrl }), ...(input.linkedinUrl !== undefined && { linkedinUrl: input.linkedinUrl }) }).where(eq(profiles.userId, userId));
  return getProfileByUserId(userId);
}

export async function listProjects() {
  const db = await getDb();
  return db.select({ id: projects.id, authorId: projects.authorId, authorName: users.name, title: projects.title, overview: projects.overview, techStack: projects.techStack, status: projects.status, createdAt: projects.createdAt, updatedAt: projects.updatedAt }).from(projects).leftJoin(users, eq(projects.authorId, users.id)).orderBy(desc(projects.createdAt));
}

export interface CreateProjectInput { authorId: number; title: string; overview: string; techStack: string[]; }

export async function createProject(input: CreateProjectInput) {
  const db = await getDb();
  const [result] = await db.insert(projects).values({ authorId: input.authorId, title: input.title, overview: input.overview, techStack: JSON.stringify(input.techStack) });
  const insertId = (result as unknown as { insertId: number }).insertId;
  const [project] = await db.select().from(projects).where(eq(projects.id, insertId)).limit(1);
  return project;
}

export async function updateProjectStatus(projectId: number, ownerId: number, status: "open" | "filled") {
  const db = await getDb();
  const [existing] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.authorId, ownerId))).limit(1);
  if (!existing) return null;
  await db.update(projects).set({ status }).where(eq(projects.id, projectId));
  const [updated] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return updated;
}

export async function listComments(projectId: number) {
  const db = await getDb();
  return db.select({ id: comments.id, projectId: comments.projectId, authorId: comments.authorId, authorName: users.name, content: comments.content, createdAt: comments.createdAt, updatedAt: comments.updatedAt }).from(comments).leftJoin(users, eq(comments.authorId, users.id)).where(eq(comments.projectId, projectId)).orderBy(desc(comments.createdAt));
}

export interface AddCommentInput { projectId: number; authorId: number; content: string; }

export async function addComment(input: AddCommentInput) {
  const db = await getDb();
  const [result] = await db.insert(comments).values(input);
  const insertId = (result as unknown as { insertId: number }).insertId;
  const [comment] = await db.select().from(comments).where(eq(comments.id, insertId)).limit(1);
  return comment;
}

export async function deleteComment(commentId: number, authorId: number) {
  const db = await getDb();
  const [result] = await db.delete(comments).where(and(eq(comments.id, commentId), eq(comments.authorId, authorId)));
  const affectedRows = (result as unknown as { affectedRows: number }).affectedRows;
  return affectedRows > 0;
}

export async function countProjectUpvotes(projectId: number) {
  const db = await getDb();
  const rows = await db.select().from(projectUpvotes).where(eq(projectUpvotes.projectId, projectId));
  return rows.length;
}

export async function toggleProjectUpvote(projectId: number, userId: number) {
  const db = await getDb();
  const [existing] = await db.select().from(projectUpvotes).where(and(eq(projectUpvotes.projectId, projectId), eq(projectUpvotes.userId, userId))).limit(1);
  if (existing) await db.delete(projectUpvotes).where(eq(projectUpvotes.id, existing.id));
  else await db.insert(projectUpvotes).values({ projectId, userId });
  const count = await countProjectUpvotes(projectId);
  return { upvoted: !existing, count };
}
