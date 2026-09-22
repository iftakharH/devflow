import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const entries = await ctx.db
      .query("journal")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    return entries;
  },
});

export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("journal")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", args.date)
      )
      .unique();
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const all = await ctx.db
      .query("journal")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    const q = args.query.toLowerCase();
    return all.filter(
      (e) =>
        e.content.toLowerCase().includes(q) ||
        e.date.includes(q)
    );
  },
});

export const create = mutation({
  args: {
    date: v.string(),
    content: v.string(),
    mood: v.optional(v.string()),
    taskIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("journal")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", args.date)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        mood: args.mood,
        taskIds: args.taskIds ?? existing.taskIds,
      });
      return existing._id;
    }

    return await ctx.db.insert("journal", {
      userId: identity.subject,
      date: args.date,
      content: args.content,
      mood: args.mood,
      taskIds: args.taskIds ?? [],
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("journal"),
    content: v.optional(v.string()),
    mood: v.optional(v.string()),
    taskIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== identity.subject) throw new Error("Not authorized");

    const { id, ...updates } = args;
    const patchData: Record<string, unknown> = {};
    if (updates.content !== undefined) patchData.content = updates.content;
    if (updates.mood !== undefined) patchData.mood = updates.mood;
    if (updates.taskIds !== undefined) patchData.taskIds = updates.taskIds;

    await ctx.db.patch(args.id, patchData);
  },
});

export const remove = mutation({
  args: { id: v.id("journal") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== identity.subject) throw new Error("Not authorized");

    await ctx.db.delete(args.id);
  },
});
