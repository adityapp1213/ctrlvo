import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertMemoryImage = mutation({
  args: {
    chatId: v.id("chats"),
    userId: v.string(),
    sessionId: v.string(),
    title: v.string(),
    imageData: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("visual_memories")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        imageData: args.imageData,
        updatedAt: args.updatedAt,
      });
      return { memoryId: existing._id };
    }

    const memoryId = await ctx.db.insert("visual_memories", {
      chatId: args.chatId,
      userId: args.userId,
      sessionId: args.sessionId,
      title: args.title,
      imageData: args.imageData,
      updatedAt: args.updatedAt,
    });
    return { memoryId };
  },
});

export const getMemoryForChat = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("visual_memories")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .first();
    if (!doc) return null;
    return doc;
  },
});

