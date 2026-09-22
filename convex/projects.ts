import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

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
    if (!project || project.userId !== identity.subject) throw new Error("Not authorized");

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
    if (!project || project.userId !== identity.subject) throw new Error("Not authorized");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_project", (q) =>
        q.eq("userId", identity.subject).eq("projectId", args.id)
      )
      .collect();

    for (const task of tasks) {
      await ctx.db.patch(task._id, { projectId: undefined });
    }

    await ctx.db.delete(args.id);
  },
});
