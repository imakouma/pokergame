import { Doc, Id } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";
import { createDeck, drawCards, shuffleDeck } from "../poker/deck";
import { compareEvaluated, evaluate7 } from "../poker/evaluator";
const CPU_NAMES = ["CPU Alpha", "CPU Beta", "CPU Gamma"];

export type PlayerDoc = Doc<"players">;
export type HandDoc = Doc<"hands">;
export type RoomDoc = Doc<"rooms">;

export function nextSeat(seat: number, maxPlayers: number): number {
  return (seat + 1) % maxPlayers;
}

function findOccupiedSeat(
  players: PlayerDoc[],
  startSeat: number,
  maxPlayers: number,
): number {
  let seat = startSeat;
  for (let i = 0; i < maxPlayers; i++) {
    if (players.some((p) => p.seatIndex === seat && p.chipCount > 0)) return seat;
    seat = nextSeat(seat, maxPlayers);
  }
  return startSeat;
}

export async function getPlayersInRoom(
  ctx: MutationCtx,
  targetRoomId: Id<"rooms">,
): Promise<PlayerDoc[]> {
  return await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", targetRoomId))
    .collect();
}

/** フォールドしていないプレイヤー */
export function activeInHand(players: PlayerDoc[]): PlayerDoc[] {
  return players.filter((p) => !p.isFolded && p.seatStatus === "active");
}

/** まだベットできるプレイヤー（オールイン・フォールド除く） */
export function canBet(players: PlayerDoc[]): PlayerDoc[] {
  return players.filter(
    (p) => !p.isFolded && !p.isAllIn && p.chipCount > 0 && p.seatStatus === "active",
  );
}

export async function createSinglePlayerRoom(
  ctx: MutationCtx,
  args: { userId: string; displayName: string },
): Promise<Id<"rooms">> {
  const now = Date.now();
  const roomId = await ctx.db.insert("rooms", {
    name: `${args.displayName} のテーブル`,
    status: "recruiting",
    maxPlayers: 4,
    smallBlind: 10,
    bigBlind: 20,
    dealerButtonSeat: 0,
    potTotal: 0,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("players", {
    roomId,
    userId: args.userId,
    displayName: args.displayName,
    seatIndex: 0,
    seatStatus: "waiting",
    chipCount: 1000,
    currentBet: 0,
    isFolded: false,
    isAllIn: false,
    isBot: false,
    updatedAt: now,
  });

  for (let i = 0; i < 3; i++) {
    await ctx.db.insert("players", {
      roomId,
      userId: `bot-${i}`,
      displayName: CPU_NAMES[i],
      seatIndex: i + 1,
      seatStatus: "waiting",
      chipCount: 1000,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
      isBot: true,
      updatedAt: now,
    });
  }

  return roomId;
}

export async function startHand(
  ctx: MutationCtx,
  targetRoomId: Id<"rooms">,
): Promise<void> {
  const room = (await ctx.db.get(targetRoomId)) as RoomDoc | null;
  if (!room) throw new Error("部屋が見つかりません");

  const players = (await getPlayersInRoom(ctx, targetRoomId)).sort(
    (a, b) => a.seatIndex - b.seatIndex,
  );
  const seated = players.filter((p) => p.chipCount > 0);
  if (seated.length < 2) throw new Error("プレイヤーが不足しています");

  const handNumber =
    (
      await ctx.db
        .query("hands")
        .withIndex("by_room", (q) => q.eq("roomId", targetRoomId))
        .collect()
    ).length + 1;

  let deck = shuffleDeck(createDeck());
  const now = Date.now();

  for (const p of seated) {
    const { drawn, remaining } = drawCards(deck, 2);
    deck = remaining;
    await ctx.db.patch(p._id, {
      holeCards: drawn,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
      seatStatus: "active",
      lastAction: undefined,
      updatedAt: now,
    });
  }

  const dealerSeat = room.dealerButtonSeat;
  const sbSeat = findOccupiedSeat(seated, nextSeat(dealerSeat, room.maxPlayers), room.maxPlayers);
  const bbSeat = findOccupiedSeat(seated, nextSeat(sbSeat, room.maxPlayers), room.maxPlayers);

  const sbPlayer = seated.find((p) => p.seatIndex === sbSeat);
  const bbPlayer = seated.find((p) => p.seatIndex === bbSeat);
  if (!sbPlayer || !bbPlayer) throw new Error("ブラインド席が見つかりません");

  let pot = 0;
  pot += await postBlind(ctx, sbPlayer._id, room.smallBlind);
  pot += await postBlind(ctx, bbPlayer._id, room.bigBlind);

  const handId = await ctx.db.insert("hands", {
    roomId: targetRoomId,
    handNumber,
    phase: "pre_flop",
    communityCards: [],
    currentBetLevel: room.bigBlind,
    minRaise: room.bigBlind,
    deck,
    phaseStartedAt: now,
  });

  const firstActorSeat = findOccupiedSeat(
    seated,
    nextSeat(bbSeat, room.maxPlayers),
    room.maxPlayers,
  );
  const firstActor = seated.find((p) => p.seatIndex === firstActorSeat);
  if (!firstActor) throw new Error("最初のアクターが見つかりません");

  await ctx.db.patch(handId, { currentActorId: firstActor._id });
  await ctx.db.patch(targetRoomId, {
    status: "in_progress",
    activeHandId: handId,
    potTotal: pot,
    updatedAt: now,
  });
}

async function postBlind(
  ctx: MutationCtx,
  playerId: Id<"players">,
  amount: number,
): Promise<number> {
  const player = await ctx.db.get(playerId);
  if (!player) return 0;
  const pay = Math.min(amount, player.chipCount);
  const newChips = player.chipCount - pay;
  await ctx.db.patch(playerId, {
    chipCount: newChips,
    currentBet: player.currentBet + pay,
    isAllIn: newChips === 0,
    updatedAt: Date.now(),
  });
  return pay;
}

export async function applyAction(
  ctx: MutationCtx,
  args: {
    handId: Id<"hands">;
    playerId: Id<"players">;
    action: "fold" | "check" | "call" | "bet" | "raise" | "all_in";
    amount?: number;
  },
): Promise<void> {
  const hand = await ctx.db.get(args.handId);
  if (!hand || hand.endedAt) throw new Error("無効なハンドです");

  const player = await ctx.db.get(args.playerId);
  if (!player) throw new Error("プレイヤーが見つかりません");
  if (hand.currentActorId !== args.playerId) {
    throw new Error("あなたの番ではありません");
  }

  const room = await ctx.db.get(hand.roomId);
  if (!room) throw new Error("部屋が見つかりません");

  const players = await getPlayersInRoom(ctx, hand.roomId);
  const toCall = hand.currentBetLevel - player.currentBet;
  let chipsMoved = 0;

  switch (args.action) {
    case "fold":
      await ctx.db.patch(args.playerId, {
        isFolded: true,
        seatStatus: "folded",
        lastAction: "fold",
        updatedAt: Date.now(),
      });
      break;
    case "check":
      if (toCall > 0) throw new Error("チェックできません");
      await ctx.db.patch(args.playerId, { lastAction: "check", updatedAt: Date.now() });
      break;
    case "call": {
      const pay = Math.min(toCall, player.chipCount);
      chipsMoved = pay;
      await moveChipsToPot(ctx, args.playerId, pay, "call");
      break;
    }
    case "bet":
    case "raise": {
      const raiseTotal = args.amount ?? 0;
      if (raiseTotal <= hand.currentBetLevel) {
        throw new Error("レイズ額が不十分です");
      }
      const add = raiseTotal - player.currentBet;
      if (add > player.chipCount) throw new Error("チップが足りません");
      chipsMoved = add;
      await moveChipsToPot(ctx, args.playerId, add, args.action);
      await ctx.db.patch(args.handId, {
        currentBetLevel: raiseTotal,
        minRaise: Math.max(hand.minRaise, raiseTotal - hand.currentBetLevel),
      });
      break;
    }
    case "all_in": {
      chipsMoved = player.chipCount;
      await moveChipsToPot(ctx, args.playerId, chipsMoved, "all_in");
      const updated = await ctx.db.get(args.playerId);
      if (updated && updated.currentBet > hand.currentBetLevel) {
        await ctx.db.patch(args.handId, {
          currentBetLevel: updated.currentBet,
        });
      }
      break;
    }
  }

  await ctx.db.insert("actionLog", {
    handId: args.handId,
    playerId: args.playerId,
    phase: hand.phase,
    action: args.action,
    amount: chipsMoved,
    createdAt: Date.now(),
  });

  if (chipsMoved > 0) {
    await ctx.db.patch(room._id, {
      potTotal: room.potTotal + chipsMoved,
      updatedAt: Date.now(),
    });
  }

  const stillActive = activeInHand(await getPlayersInRoom(ctx, hand.roomId));
  if (stillActive.length === 1) {
    await ctx.db.patch(args.handId, {
      phase: "showdown",
      endedAt: Date.now(),
      currentActorId: undefined,
    });
    await awardPot(ctx, hand.roomId, args.handId, stillActive[0]._id);
    return;
  }

  const updatedHand = await ctx.db.get(args.handId);
  if (!updatedHand) return;

  if (isBettingRoundComplete(await getPlayersInRoom(ctx, hand.roomId), updatedHand)) {
    await advancePhase(ctx, args.handId);
    return;
  }

  const next = findNextActor(
    await getPlayersInRoom(ctx, hand.roomId),
    player.seatIndex,
    room.maxPlayers,
  );
  if (next) {
    await ctx.db.patch(args.handId, { currentActorId: next._id });
  }
}

async function moveChipsToPot(
  ctx: MutationCtx,
  playerId: Id<"players">,
  amount: number,
  action: "call" | "bet" | "raise" | "all_in",
): Promise<void> {
  const player = await ctx.db.get(playerId);
  if (!player) return;
  const pay = Math.min(amount, player.chipCount);
  const newChips = player.chipCount - pay;
  await ctx.db.patch(playerId, {
    chipCount: newChips,
    currentBet: player.currentBet + pay,
    isAllIn: newChips === 0,
    lastAction: action,
    updatedAt: Date.now(),
  });
}

function findNextActor(
  players: PlayerDoc[],
  fromSeat: number,
  maxPlayers: number,
): PlayerDoc | null {
  let seat = nextSeat(fromSeat, maxPlayers);
  for (let i = 0; i < maxPlayers; i++) {
    const p = players.find((pl) => pl.seatIndex === seat);
    if (p && !p.isFolded && !p.isAllIn && p.chipCount > 0) return p;
    seat = nextSeat(seat, maxPlayers);
  }
  return null;
}

export function isBettingRoundComplete(
  players: PlayerDoc[],
  hand: HandDoc,
): boolean {
  const contenders = canBet(players);
  if (contenders.length === 0) return true;
  if (contenders.length === 1) {
    const others = activeInHand(players).filter((p) => p._id !== contenders[0]._id);
    return others.every(
      (p) => p.currentBet >= hand.currentBetLevel || p.isAllIn,
    );
  }
  return contenders.every((p) => p.currentBet === hand.currentBetLevel);
}

export async function advancePhase(
  ctx: MutationCtx,
  handId: Id<"hands">,
): Promise<void> {
  const hand = await ctx.db.get(handId);
  if (!hand) return;

  const room = await ctx.db.get(hand.roomId);
  if (!room) return;

  const players = await getPlayersInRoom(ctx, hand.roomId);
  const now = Date.now();

  for (const p of players) {
    await ctx.db.patch(p._id, { currentBet: 0, updatedAt: now });
  }

  const phaseOrder = ["pre_flop", "flop", "turn", "river", "showdown"] as const;
  const idx = phaseOrder.indexOf(hand.phase);
  const nextPhase = phaseOrder[idx + 1];

  if (!nextPhase) return;

  if (nextPhase === "showdown") {
    await resolveShowdown(ctx, handId);
    return;
  }

  let deck = [...hand.deck];
  let community = [...hand.communityCards];
  const drawCount = nextPhase === "flop" ? 3 : 1;
  community = [...community, ...deck.slice(0, drawCount)];
  deck = deck.slice(drawCount);

  const active = activeInHand(players);
  const firstActor = active.sort((a, b) => a.seatIndex - b.seatIndex)[0];

  await ctx.db.patch(handId, {
    phase: nextPhase,
    communityCards: community,
    deck,
    currentBetLevel: 0,
    minRaise: room.bigBlind,
    currentActorId: firstActor?._id,
    phaseStartedAt: now,
  });
}

async function resolveShowdown(ctx: MutationCtx, handId: Id<"hands">): Promise<void> {
  const hand = await ctx.db.get(handId);
  if (!hand) return;

  const players = activeInHand(await getPlayersInRoom(ctx, hand.roomId));
  let bestPlayer = players[0];
  let bestEval = evaluate7([
    ...(bestPlayer.holeCards ?? []),
    ...hand.communityCards,
  ]);

  for (let i = 1; i < players.length; i++) {
    const ev = evaluate7([...(players[i].holeCards ?? []), ...hand.communityCards]);
    if (compareEvaluated(ev, bestEval) > 0) {
      bestEval = ev;
      bestPlayer = players[i];
    }
  }

  await ctx.db.patch(handId, {
    phase: "showdown",
    endedAt: Date.now(),
    currentActorId: undefined,
  });
  await awardPot(ctx, hand.roomId, handId, bestPlayer._id);
}

async function awardPot(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  handId: Id<"hands">,
  winnerId: Id<"players">,
): Promise<void> {
  const room = await ctx.db.get(roomId);
  const winner = await ctx.db.get(winnerId);
  if (!room || !winner) return;

  await ctx.db.patch(winnerId, {
    chipCount: winner.chipCount + room.potTotal,
    updatedAt: Date.now(),
  });

  const roomPlayers = await getPlayersInRoom(ctx, roomId);
  const nextDealer = nextSeat(room.dealerButtonSeat, room.maxPlayers);

  await ctx.db.patch(roomId, {
    potTotal: 0,
    dealerButtonSeat: nextDealer,
    updatedAt: Date.now(),
  });

  for (const p of roomPlayers) {
    await ctx.db.patch(p._id, {
      currentBet: 0,
      seatStatus: p.chipCount > 0 ? "waiting" : "sitting_out",
      updatedAt: Date.now(),
    });
  }
}

export function pickCpuAction(
  player: PlayerDoc,
  hand: HandDoc,
): { action: "fold" | "check" | "call" | "bet" | "raise" | "all_in"; amount?: number } {
  const toCall = hand.currentBetLevel - player.currentBet;
  const r = Math.random();

  if (toCall === 0) {
    if (r < 0.15 && player.chipCount > hand.minRaise) {
      const bet = hand.currentBetLevel + hand.minRaise;
      return { action: "bet", amount: bet };
    }
    return { action: "check" };
  }

  if (r < 0.12) return { action: "fold" };
  if (toCall >= player.chipCount) return { action: "all_in" };
  if (r < 0.08 && player.chipCount > toCall + hand.minRaise) {
    return { action: "raise", amount: hand.currentBetLevel + hand.minRaise };
  }
  return { action: "call" };
}

export async function runCpuTurnsUntilHuman(
  ctx: MutationCtx,
  handId: Id<"hands">,
  humanUserId: string,
): Promise<void> {
  let safety = 0;
  while (safety++ < 40) {
    const hand = await ctx.db.get(handId);
    if (!hand || hand.endedAt || !hand.currentActorId) break;

    const actor = await ctx.db.get(hand.currentActorId);
    if (!actor || !actor.isBot) break;

    const action = pickCpuAction(actor, hand);
    await applyAction(ctx, {
      handId,
      playerId: actor._id,
      action: action.action,
      amount: action.amount,
    });

    const room = await ctx.db.get(hand.roomId);
    if (!room?.activeHandId) break;
  }
}
