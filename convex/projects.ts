import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireEditor, requireMembership } from "./authz";

export const list = query({
  args: { workspaceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    if (args.workspaceId) {
      await requireMembership(ctx, args.workspaceId, identity.subject);
      return await ctx.db
        .query("projects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
    }

    const personal = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    return personal.filter((project) => !project.workspaceId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    if (args.workspaceId) {
      await requireEditor(ctx, args.workspaceId, identity.subject);
    }

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    return await ctx.db.insert("projects", {
      userId: identity.subject,
      name: args.name,
      color: args.color,
      icon: args.icon ?? "Folder",
      order: existing.length,
      workspaceId: args.workspaceId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Project not found");

    if (project.workspaceId) {
      await requireEditor(ctx, project.workspaceId, identity.subject);
    } else if (project.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    const { id, ...updates } = args;
    const patchData: Record<string, unknown> = {};
    if (updates.name !== undefined) patchData.name = updates.name;
    if (updates.color !== undefined) patchData.color = updates.color;
    if (updates.icon !== undefined) patchData.icon = updates.icon;
    if (updates.order !== undefined) patchData.order = updates.order;

    await ctx.db.patch(args.id, patchData);
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Project not found");

    if (project.workspaceId) {
      await requireEditor(ctx, project.workspaceId, identity.subject);
    } else if (project.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    const linkedTasks = project.workspaceId
      ? await ctx.db
        .query("tasks")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", project.workspaceId))
        .collect()
      : await ctx.db
        .query("tasks")
        .withIndex("by_user_project", (q) =>
          q.eq("userId", identity.subject).eq("projectId", args.id)
        )
        .collect();

    for (const task of linkedTasks) {
      if (task.projectId === args.id) {
        await ctx.db.patch(task._id, { projectId: undefined });
      }
    }

    await ctx.db.delete(args.id);
  },
});
