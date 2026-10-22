import type { MutationCtx, QueryCtx } from "./_generated/server";

type DbCtx = QueryCtx | MutationCtx;

export async function getMembership(ctx: DbCtx, workspaceId: string, userId: string) {
  return await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId)
    )
    .unique();
}

export async function requireMembership(ctx: DbCtx, workspaceId: string, userId: string) {
  const membership = await getMembership(ctx, workspaceId, userId);
  if (!membership) throw new Error("Not authorized");
  return membership;
}

export async function requireEditor(ctx: DbCtx, workspaceId: string, userId: string) {
  const membership = await requireMembership(ctx, workspaceId, userId);
  if (membership.role === "viewer") throw new Error("Read-only workspace");
  return membership;
}

export async function requireAdmin(ctx: DbCtx, workspaceId: string, userId: string) {
  const membership = await requireMembership(ctx, workspaceId, userId);
  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Not authorized");
  }
  return membership;
}
