import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { z } from "zod";
import { clearSessionCookie, readSessionUserId } from "./auth";
import { addComment, countProjectUpvotes, createProject, deleteComment, getProfileByUserId, getUserById, listComments, listProjects, toggleProjectUpvote, updateProfile, updateProjectStatus } from "./db";

export async function createContext({ req, res }: CreateExpressContextOptions) { const userId = await readSessionUserId(req); const user = userId ? await getUserById(userId) : null; return { req, res, user }; }
type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => { if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" }); return next({ ctx: { ...ctx, user: ctx.user } }); });

export const appRouter = router({
  projects: router({
    list: publicProcedure.query(() => listProjects()),
    create: protectedProcedure.input(z.object({ title: z.string().min(3).max(160), overview: z.string().min(10).max(10000), techStack: z.array(z.string().min(1).max(80)).min(1).max(20) })).mutation(({ ctx, input }) => createProject({ ...input, authorId: ctx.user.id })),
    updateStatus: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), status: z.enum(["open", "filled"]) })).mutation(async ({ ctx, input }) => { const project = await updateProjectStatus(input.projectId, ctx.user.id, input.status); if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found or not owned by the current user" }); return project; }),
    upvoteCount: publicProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ input }) => countProjectUpvotes(input.projectId)),
  }),
  profiles: router({
    getByUserId: publicProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => getProfileByUserId(input.userId)),
    updateOwn: protectedProcedure.input(z.object({ bio: z.string().max(2000).optional(), skills: z.array(z.string().min(1).max(60)).max(40).optional(), websiteUrl: z.string().url().optional(), githubUrl: z.string().url().optional(), linkedinUrl: z.string().url().optional() })).mutation(({ ctx, input }) => updateProfile(ctx.user.id, input)),
  }),
  comments: router({
    list: publicProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ input }) => listComments(input.projectId)),
    add: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), content: z.string().min(1).max(4000) })).mutation(({ ctx, input }) => addComment({ ...input, authorId: ctx.user.id })),
    deleteOwn: protectedProcedure.input(z.object({ commentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { if (!await deleteComment(input.commentId, ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found or not owned by the current user" }); return { success: true }; }),
  }),
  upvotes: router({
    toggle: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(({ ctx, input }) => toggleProjectUpvote(input.projectId, ctx.user.id)),
    count: publicProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ input }) => countProjectUpvotes(input.projectId)),
  }),
  auth: router({ me: publicProcedure.query(({ ctx }) => ctx.user ?? null), logout: publicProcedure.mutation(({ ctx }) => { clearSessionCookie(ctx.res); return { success: true }; }) }),
});

export type AppRouter = typeof appRouter;
