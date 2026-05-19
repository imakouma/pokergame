import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { playerActionValidator } from "./schema";
import {
  applyAction,
  getPlayersInRoom,
  runCpuTurnsUntilHuman,
  startHand,
} from "./lib/game/engine";

/** テーブル全体の状態（クライアント用） */
export const getTableState = query({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const hand = room.activeHandId ? await ctx.db.get(room.activeHandId) : null;
    const revealHoleCards =
      hand != null && (hand.phase === "showdown" || hand.endedAt != null);

    const me = players.find((p) => p.userId === args.userId);

    return {
      room: {
        _id: room._id,
        name: room.name,
        status: room.status,
        potTotal: room.potTotal,
        dealerButtonSeat: room.dealerButtonSeat,
        smallBlind: room.smallBlind,
        bigBlind: room.bigBlind,
      },
      hand: hand
        ? {
            _id: hand._id,
            phase: hand.phase,
            communityCards: hand.communityCards,
            currentBetLevel: hand.currentBetLevel,
            minRaise: hand.minRaise,
            currentActorId: hand.currentActorId,
            endedAt: hand.endedAt,
          }
        : null,
      players: players
        .sort((a, b) => a.seatIndex - b.seatIndex)
        .map((p) => ({
          _id: p._id,
          userId: p.userId,
          displayName: p.displayName,
          seatIndex: p.seatIndex,
          seatStatus: p.seatStatus,
          chipCount: p.chipCount,
          currentBet: p.currentBet,
          isFolded: p.isFolded,
          isAllIn: p.isAllIn,
          isBot: p.isBot,
          lastAction: p.lastAction,
          holeCards:
            p.userId === args.userId || revealHoleCards ? p.holeCards : undefined,
          inHand: !!p.holeCards,
          showCardBacks: !revealHoleCards && p.userId !== args.userId && !!p.holeCards,
        })),
      me: me
        ? {
            _id: me._id,
            holeCards: me.holeCards,
            isMyTurn: hand?.currentActorId === me._id,
          }
        : null,
    };
  },
});

export const startGame = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    await startHand(ctx, args.roomId);
    const room = await ctx.db.get(args.roomId);
    if (room?.activeHandId) {
      await runCpuTurnsUntilHuman(ctx, room.activeHandId, "");
    }
    return { ok: true };
  },
});

export const startGameAndRunCpu = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await startHand(ctx, args.roomId);
    const room = await ctx.db.get(args.roomId);
    if (room?.activeHandId) {
      await runCpuTurnsUntilHuman(ctx, room.activeHandId, args.userId);
    }
    return { ok: true };
  },
});

export const playerAction = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    action: playerActionValidator,
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room?.activeHandId) throw new Error("進行中のハンドがありません");

    const players = await getPlayersInRoom(ctx, args.roomId);
    const me = players.find((p) => p.userId === args.userId);
    if (!me) throw new Error("プレイヤーが見つかりません");
    if (me.isBot) throw new Error("ボットの操作はできません");

    await applyAction(ctx, {
      handId: room.activeHandId,
      playerId: me._id,
      action: args.action,
      amount: args.amount,
    });

    const updatedRoom = await ctx.db.get(args.roomId);
    if (updatedRoom?.activeHandId) {
      await runCpuTurnsUntilHuman(ctx, updatedRoom.activeHandId, args.userId);
    }

    return { ok: true };
  },
});

export const nextHand = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("部屋が見つかりません");
    if (room.activeHandId) {
      const hand = await ctx.db.get(room.activeHandId);
      if (hand && !hand.endedAt) throw new Error("ハンドがまだ終了していません");
    }
    await startHand(ctx, args.roomId);
    const updated = await ctx.db.get(args.roomId);
    if (updated?.activeHandId) {
      await runCpuTurnsUntilHuman(ctx, updated.activeHandId, args.userId);
    }
    return { ok: true };
  },
});
