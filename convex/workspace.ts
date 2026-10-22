import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAdmin, requireMembership } from "./authz";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

async function generateUniqueInviteCode(ctx) {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", code))
      .unique();
    if (!existing) return code;
  }
  throw new Error("Could not generate invite code");
}

function normalizeName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Workspace name is required");
  if (trimmed.length > 60) throw new Error("Workspace name is too long");
  return trimmed;
}

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
      memberships.map(async (membership) => {
        const workspace = await ctx.db.get(
          membership.workspaceId as Id<"workspaces">
        );
        return workspace ? { ...workspace, role: membership.role } : null;
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

    const name = normalizeName(args.name);
    const inviteCode = await generateUniqueInviteCode(ctx);

    const workspaceId = await ctx.db.insert("workspaces", {
      name,
      ownerId: identity.subject,
      inviteCode,
    });

    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId: identity.subject,
      role: "owner",
    });

    return workspaceId;
  },
});

export const rename = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await requireAdmin(ctx, args.workspaceId, identity.subject);
    await ctx.db.patch(args.workspaceId, { name: normalizeName(args.name) });
  },
});

export const joinByCode = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const inviteCode = args.inviteCode.trim().toUpperCase();
    if (!inviteCode) throw new Error("Invite code is required");

    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
      .unique();

    if (!workspace) throw new Error("Invalid invite code");

    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", workspace._id).eq("userId", identity.subject)
      )
      .unique();

    if (existing) return workspace._id;

    await ctx.db.insert("workspaceMembers", {
      workspaceId: workspace._id,
      userId: identity.subject,
      role: "member",
    });

    return workspace._id;
  },
});

export const getMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const caller = await requireMembership(ctx, args.workspaceId, identity.subject);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) return null;

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const enriched = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", member.userId))
          .unique();
        return {
          ...member,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "",
          userImage: user?.imageUrl,
        };
      })
    );

    return {
      workspace,
      members: enriched,
      myRole: caller.role,
    };
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

    const caller = await requireAdmin(ctx, args.workspaceId, identity.subject);

    if (args.userId === identity.subject) {
      throw new Error("Use leave instead of removing yourself");
    }

    const target = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .unique();

    if (!target) return;
    if (target.role === "owner") throw new Error("Cannot remove the owner");
    if (caller.role === "admin" && target.role === "admin") {
      throw new Error("Admins cannot remove other admins");
    }

    await ctx.db.delete(target._id);
  },
});

export const leave = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const membership = await requireMembership(ctx, args.workspaceId, identity.subject);
    if (membership.role === "owner") {
      throw new Error("Owners must delete the workspace or transfer ownership");
    }

    await ctx.db.delete(membership._id);
  },
});

export const regenerateInvite = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await requireAdmin(ctx, args.workspaceId, identity.subject);
    const inviteCode = await generateUniqueInviteCode(ctx);
    await ctx.db.patch(args.workspaceId, { inviteCode });
    return inviteCode;
  },
});

export const remove = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const membership = await requireMembership(ctx, args.workspaceId, identity.subject);
    if (membership.role !== "owner") throw new Error("Only the owner can delete");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const task of tasks) {
      await ctx.db.patch(task._id, { workspaceId: undefined });
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const project of projects) {
      await ctx.db.patch(project._id, { workspaceId: undefined });
    }

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    await ctx.db.delete(args.workspaceId);
  },
});
