import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  providerAccountId: varchar("providerAccountId", { length: 128 }).notNull().unique(),
  provider: varchar("provider", { length: 32 }).notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  bio: text("bio"),
  skills: text("skills").notNull(),
  websiteUrl: varchar("websiteUrl", { length: 512 }),
  githubUrl: varchar("githubUrl", { length: 512 }),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  authorId: int("authorId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  overview: text("overview").notNull(),
  techStack: text("techStack").notNull(),
  status: mysqlEnum("status", ["open", "filled"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  authorId: int("authorId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectUpvotes = mysqlTable(
  "project_upvotes",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    userId: int("userId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    projectUserUnique: unique("project_user_unique").on(table.projectId, table.userId),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Comment = typeof comments.$inferSelect;
