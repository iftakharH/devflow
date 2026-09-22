import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const generateInviteCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const ws = await ctx.db.get(m.workspaceId as any);
        return ws ? { ...ws, role: m.role } : null;
      })
    );

    return workspaces.filter(Boolean);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const inviteCode = generateInviteCode();
    const wsId = await ctx.db.insert("workspaces", {
      name: args.name,
      ownerId: identity.subject,
      inviteCode,
    });

    await ctx.db.insert("workspaceMembers", {
      workspaceId: wsId,
      userId: identity.subject,
      role: "owner",
    });

    return wsId;
  },
});

export const joinByCode = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const ws = await ctx.db
      .query("workspaces")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (!ws) throw new Error("Invalid invite code");

    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", ws._id).eq("userId", identity.subject)
      )
      .unique();

    if (existing) return ws._id;

    await ctx.db.insert("workspaceMembers", {
      workspaceId: ws._id,
      userId: identity.subject,
      role: "member",
    });

    return ws._id;
  },
});

export const getMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", m.userId))
          .unique();
        return {
          ...m,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "",
          userImage: user?.imageUrl,
        };
      })
    );
  },
});

export const removeMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const callerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", identity.subject)
      )
      .unique();

    if (!callerMembership || (callerMembership.role !== "owner" && callerMembership.role !== "admin")) {
      throw new Error("Not authorized");
    }

    const target = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .unique();

    if (target && target.role !== "owner") {
      await ctx.db.delete(target._id);
    }
  },
});
