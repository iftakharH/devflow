import { query } from "./_generated/server";
import { v } from "convex/values";

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayStr = now.toISOString().split("T")[0];

    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const active = allTasks.filter((t) => !t.done);
    const completed = allTasks.filter((t) => t.done);

    const overdue = active.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate + "T00:00:00");
      d.setHours(0, 0, 0, 0);
      return d < now;
    });

    const doneToday = completed.filter((t) => {
      if (!t.completedAt) return false;
      const d = new Date(t.completedAt);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().split("T")[0] === todayStr;
    });

    let streak = 0;
    const checkDate = new Date(now);
    for (let i = 0; i < 365; i++) {
      const ds = checkDate.toISOString().split("T")[0];
      const hasDone = completed.some((t) => {
        if (!t.completedAt) return false;
        const d = new Date(t.completedAt);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split("T")[0] === ds;
      });
      if (hasDone || i === 0) {
        if (hasDone) streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else break;
    }

    return {
      active: active.length,
      completed: completed.length,
      overdue: overdue.length,
      doneToday: doneToday.length,
      streak,
      total: allTasks.length,
    };
  },
});

export const getWeeklyChart = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const completed = await ctx.db
      .query("activityLog")
      .withIndex("by_user_action", (q) =>
        q.eq("userId", userId).eq("action", "completed")
      )
      .collect();

    const days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const count = completed.filter((a) => {
        const ad = new Date(a.timestamp);
        ad.setHours(0, 0, 0, 0);
        return ad.toISOString().split("T")[0] === dateStr;
      }).length;
      days.push({
        date: dateStr,
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        count,
      });
    }

    return days;
  },
});

export const getMonthlyHeatmap = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const completed = await ctx.db
      .query("activityLog")
      .withIndex("by_user_action", (q) =>
        q.eq("userId", userId).eq("action", "completed")
      )
      .collect();

    const days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const count = completed.filter((a) => {
        const ad = new Date(a.timestamp);
        ad.setHours(0, 0, 0, 0);
        return ad.toISOString().split("T")[0] === dateStr;
      }).length;
      days.push({ date: dateStr, count });
    }

    return days;
  },
});

export const getRecentActivity = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const logs = await ctx.db
      .query("activityLog")
      .withIndex("by_user_time", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(20);

    const enriched = await Promise.all(
      logs.map(async (log) => {
        const task = await ctx.db.get(log.taskId as any);
        return {
          ...log,
          taskText: task?.text ?? "Unknown task",
        };
      })
    );

    return enriched;
  },
});
