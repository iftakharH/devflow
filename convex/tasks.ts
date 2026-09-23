import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const create = mutation({
  args: {
    text: v.string(),
    projectId: v.optional(v.string()),
    priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    dueDate: v.optional(v.union(v.string(), v.null())),
    dueTime: v.optional(v.union(v.string(), v.null())),
    tags: v.array(v.string()),
    subtasks: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      done: v.boolean(),
    }))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const taskId = await ctx.db.insert("tasks", {
      userId: identity.subject,
      text: args.text,
      done: false,
      projectId: args.projectId,
      priority: args.priority,
      dueDate: args.dueDate ?? undefined,
      dueTime: args.dueTime ?? undefined,
      tags: args.tags,
      subtasks: args.subtasks ?? [],
      notes: args.notes ?? "",
    });

    await ctx.db.insert("activityLog", {
      userId: identity.subject,
      taskId,
      action: "created",
      timestamp: Date.now(),
    });

    return taskId;
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    text: v.optional(v.string()),
    done: v.optional(v.boolean()),
    projectId: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    dueDate: v.optional(v.union(v.string(), v.null())),
    dueTime: v.optional(v.union(v.string(), v.null())),
    tags: v.optional(v.array(v.string())),
    subtasks: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      done: v.boolean(),
    }))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== identity.subject) throw new Error("Not authorized");

    const { id, ...updates } = args;
    const patchData: Record<string, unknown> = {};

    if (updates.text !== undefined) patchData.text = updates.text;
    if (updates.projectId !== undefined) patchData.projectId = updates.projectId;
    if (updates.priority !== undefined) patchData.priority = updates.priority;
    if (updates.dueDate !== undefined) patchData.dueDate = updates.dueDate === null ? null : updates.dueDate;
    if (updates.dueTime !== undefined) patchData.dueTime = updates.dueTime === null ? null : updates.dueTime;
    if (updates.tags !== undefined) patchData.tags = updates.tags;
    if (updates.subtasks !== undefined) patchData.subtasks = updates.subtasks;
    if (updates.notes !== undefined) patchData.notes = updates.notes;

    if (updates.done !== undefined) {
      patchData.done = updates.done;
      patchData.completedAt = updates.done ? Date.now() : undefined;

      await ctx.db.insert("activityLog", {
        userId: identity.subject,
        taskId: args.id,
        action: updates.done ? "completed" : "reopened",
        timestamp: Date.now(),
      });
    }

    await ctx.db.patch(args.id, patchData);
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== identity.subject) throw new Error("Not authorized");

    await ctx.db.insert("activityLog", {
      userId: identity.subject,
      taskId: args.id,
      action: "deleted",
      timestamp: Date.now(),
    });

    await ctx.db.delete(args.id);
  },
});
