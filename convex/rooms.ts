import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createSinglePlayerRoom } from "./lib/game/engine";

export const createSinglePlayer = mutation({
  args: {
    userId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const roomId = await createSinglePlayerRoom(ctx, args);
    return { roomId };
  },
});

export const getRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roomId);
  },
});
