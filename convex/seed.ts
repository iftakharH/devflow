import { mutation } from "./_generated/server";

export const seedDefaultProjects = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    if (existing.length > 0) return;

    const defaults = [
      { name: "General", color: "#a1a1aa", icon: "Folder", order: 0 },
      { name: "Work", color: "#f97316", icon: "Code2", order: 1 },
      { name: "Learning", color: "#3b82f6", icon: "BookOpen", order: 2 },
      { name: "Side Project", color: "#a855f7", icon: "Terminal", order: 3 },
    ];

    for (const p of defaults) {
      await ctx.db.insert("projects", {
        userId: identity.subject,
        ...p,
      });
    }
  },
});
