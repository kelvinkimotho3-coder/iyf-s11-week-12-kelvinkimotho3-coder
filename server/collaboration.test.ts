import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => {
  const projectsStore = new Map<number, any>(), commentsStore = new Map<number, any>(), upvotesStore = new Map<string, boolean>();
  let nextProjectId = 1, nextCommentId = 1;
  return {
    getUserById: vi.fn(async (id: number) => ({ id, name: `User ${id}` })),
    getProfileByUserId: vi.fn(async (userId: number) => ({ id: userId, userId, bio: null, skills: "[]" })),
    updateProfile: vi.fn(async (userId: number, input: any) => ({ id: userId, userId, bio: input.bio ?? null, skills: JSON.stringify(input.skills ?? []) })),
    listProjects: vi.fn(async () => Array.from(projectsStore.values())),
    createProject: vi.fn(async (input: any) => { const project = { id: nextProjectId++, status: "open", ...input }; projectsStore.set(project.id, project); return project; }),
    updateProjectStatus: vi.fn(async (projectId: number, ownerId: number, status: string) => { const project = projectsStore.get(projectId); if (!project || project.authorId !== ownerId) return null; project.status = status; return project; }),
    listComments: vi.fn(async (projectId: number) => Array.from(commentsStore.values()).filter(c => c.projectId === projectId)),
    addComment: vi.fn(async (input: any) => { const comment = { id: nextCommentId++, ...input }; commentsStore.set(comment.id, comment); return comment; }),
    deleteComment: vi.fn(async (commentId: number, authorId: number) => { const comment = commentsStore.get(commentId); if (!comment || comment.authorId !== authorId) return false; commentsStore.delete(commentId); return true; }),
    countProjectUpvotes: vi.fn(async (projectId: number) => Array.from(upvotesStore.keys()).filter(key => key.startsWith(`${projectId}:`)).length),
    toggleProjectUpvote: vi.fn(async (projectId: number, userId: number) => { const key = `${projectId}:${userId}`, upvoted = !upvotesStore.get(key); if (upvoted) upvotesStore.set(key, true); else upvotesStore.delete(key); return { upvoted, count: Array.from(upvotesStore.keys()).filter(k => k.startsWith(`${projectId}:`)).length }; }),
    __reset: () => { projectsStore.clear(); commentsStore.clear(); upvotesStore.clear(); nextProjectId = 1; nextCommentId = 1; },
  };
});

vi.mock("./auth", async () => ({ ...(await vi.importActual<typeof import("./auth")>("./auth")), readSessionUserId: vi.fn(async () => null) }));
async function loadRouter() { const routersModule = await import("./routers"); (await import("./db") as any).__reset(); return routersModule; }
function makeCaller(appRouter: any, user: { id: number } | null) { return appRouter.createCaller({ req: {} as any, res: { clearCookie: vi.fn() } as any, user }); }

describe("projects router", () => {
  it("rejects invalid project input", async () => { const { appRouter } = await loadRouter(); await expect(makeCaller(appRouter, { id: 1 }).projects.create({ title: "ab", overview: "too short too", techStack: [] })).rejects.toThrow(); });
  it("rejects projects.create when there is no session", async () => { const { appRouter } = await loadRouter(); await expect(makeCaller(appRouter, null).projects.create({ title: "A valid project title", overview: "A sufficiently long overview for validation.", techStack: ["TypeScript"] })).rejects.toMatchObject({ code: "UNAUTHORIZED" }); });
  it("only lets the owner update a project's status", async () => { const { appRouter } = await loadRouter(); const owner = makeCaller(appRouter, { id: 1 }), stranger = makeCaller(appRouter, { id: 2 }); const project = await owner.projects.create({ title: "Owner-only project", overview: "A sufficiently long overview for validation.", techStack: ["TypeScript"] }); await expect(stranger.projects.updateStatus({ projectId: project.id, status: "filled" })).rejects.toMatchObject({ code: "NOT_FOUND" }); expect((await owner.projects.updateStatus({ projectId: project.id, status: "filled" })).status).toBe("filled"); });
});
describe("comments router", () => { it("only lets the author delete their own comment", async () => { const { appRouter } = await loadRouter(); const author = makeCaller(appRouter, { id: 1 }), stranger = makeCaller(appRouter, { id: 2 }); const comment = await author.comments.add({ projectId: 1, content: "Nice work!" }); await expect(stranger.comments.deleteOwn({ commentId: comment.id })).rejects.toMatchObject({ code: "NOT_FOUND" }); expect((await author.comments.deleteOwn({ commentId: comment.id })).success).toBe(true); }); });
describe("profiles router", () => { it("successfully updates the current user's own profile", async () => { const { appRouter } = await loadRouter(); const updated = await makeCaller(appRouter, { id: 1 }).profiles.updateOwn({ bio: "Backend engineer", skills: ["TypeScript", "MySQL"] }); expect(updated.bio).toBe("Backend engineer"); expect(JSON.parse(updated.skills)).toEqual(["TypeScript", "MySQL"]); }); });
describe("upvotes router", () => { it("toggling twice returns to the original state", async () => { const { appRouter } = await loadRouter(); const caller = makeCaller(appRouter, { id: 1 }); expect(await caller.upvotes.toggle({ projectId: 1 })).toEqual({ upvoted: true, count: 1 }); expect(await caller.upvotes.toggle({ projectId: 1 })).toEqual({ upvoted: false, count: 0 }); }); });
