import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_clerkId", ["clerkId"]),

  projects: defineTable({
    userId: v.string(),
    name: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    order: v.number(),
    workspaceId: v.optional(v.string()),
  }).index("by_user", ["userId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  tasks: defineTable({
    userId: v.string(),
    text: v.string(),
    done: v.boolean(),
    projectId: v.optional(v.string()),
    priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    dueDate: v.optional(v.union(v.string(), v.null())),
    dueTime: v.optional(v.union(v.string(), v.null())),
    tags: v.array(v.string()),
    subtasks: v.array(v.object({
      id: v.string(),
      text: v.string(),
      done: v.boolean(),
    })),
    notes: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    workspaceId: v.optional(v.string()),
  }).index("by_user", ["userId"])
    .index("by_user_done", ["userId", "done"])
    .index("by_user_project", ["userId", "projectId"]),

  journal: defineTable({
    userId: v.string(),
    date: v.string(),
    content: v.string(),
    mood: v.optional(v.string()),
    taskIds: v.array(v.string()),
  }).index("by_user_date", ["userId", "date"]),

  activityLog: defineTable({
    userId: v.string(),
    taskId: v.string(),
    action: v.union(v.literal("completed"), v.literal("reopened"), v.literal("created"), v.literal("deleted")),
    timestamp: v.number(),
  }).index("by_user_time", ["userId", "timestamp"])
    .index("by_user_action", ["userId", "action"]),

  workspaces: defineTable({
    name: v.string(),
    ownerId: v.string(),
    inviteCode: v.string(),
  }).index("by_owner", ["ownerId"])
    .index("by_inviteCode", ["inviteCode"]),

  workspaceMembers: defineTable({
    workspaceId: v.string(),
    userId: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  }).index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"]),
});
