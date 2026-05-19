import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** スート（♠♥♦♣） */
export const suitValidator = v.union(
  v.literal("spades"),
  v.literal("hearts"),
  v.literal("diamonds"),
  v.literal("clubs"),
);

/** ランク: 2–10, J, Q, K, A（エースは14として扱う） */
export const rankValidator = v.union(
  v.literal(2),
  v.literal(3),
  v.literal(4),
  v.literal(5),
  v.literal(6),
  v.literal(7),
  v.literal(8),
  v.literal(9),
  v.literal(10),
  v.literal(11),
  v.literal(12),
  v.literal(13),
  v.literal(14),
);

export const cardValidator = v.object({
  rank: rankValidator,
  suit: suitValidator,
});

/** テキサスホールデムの1ハンド内フェーズ */
export const gamePhaseValidator = v.union(
  v.literal("pre_flop"),
  v.literal("flop"),
  v.literal("turn"),
  v.literal("river"),
  v.literal("showdown"),
);

/** 部屋のライフサイクル */
export const roomStatusValidator = v.union(
  v.literal("recruiting"), // 募集中
  v.literal("in_progress"), // ゲーム中
  v.literal("finished"), // 終了
);

/** プレイヤーが取れるアクション（UI・バリデーション用） */
export const playerActionValidator = v.union(
  v.literal("fold"),
  v.literal("check"),
  v.literal("call"),
  v.literal("bet"),
  v.literal("raise"),
  v.literal("all_in"),
);

/** 席の状態 */
export const seatStatusValidator = v.union(
  v.literal("empty"),
  v.literal("waiting"), // 着席済み、次のハンド待ち
  v.literal("active"), // ハンド参加中
  v.literal("folded"),
  v.literal("all_in"),
  v.literal("sitting_out"),
);

export default defineSchema({
  /**
   * 部屋（テーブル）
   * 1部屋 = 最大6席のポーカーテーブル
   */
  rooms: defineTable({
    name: v.string(),
    status: roomStatusValidator,
    maxPlayers: v.number(), // 通常 2–6
    smallBlind: v.number(),
    bigBlind: v.number(),
    /** 現在のハンドのディーラーボタン席（0-based seatIndex） */
    dealerButtonSeat: v.number(),
    /** メインポット（サイドポットは別テーブルで管理） */
    potTotal: v.number(),
    /** 進行中のハンドへの参照（なければ null） */
    activeHandId: v.optional(v.id("hands")),
    /** 制限時間モード用（秒）。0 なら無制限 */
    timeLimitSeconds: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status"]),

  /**
   * プレイヤー（部屋への着席情報）
   * ユーザー1人が複数部屋に同時参加する場合はレコードを分ける
   */
  players: defineTable({
    roomId: v.id("rooms"),
    /** Convex Auth 導入後は v.id("users") に差し替え可能 */
    userId: v.string(),
    displayName: v.string(),
    seatIndex: v.number(), // 0–5（円形配置用）
    seatStatus: seatStatusValidator,
    chipCount: v.number(),
    /** 現在のベッティングラウンドでこの席がポットに出した額 */
    currentBet: v.number(),
    /** ホールカード（2枚）。未配布時は undefined */
    holeCards: v.optional(v.array(cardValidator)),
    isFolded: v.boolean(),
    isAllIn: v.boolean(),
    /** 直近のアクション（UI表示用） */
    lastAction: v.optional(playerActionValidator),
    isBot: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_seat", ["roomId", "seatIndex"])
    .index("by_room_and_user", ["roomId", "userId"]),

  /**
   * ゲーム状態（1ハンド = 1レコード）
   * ユーザー要件の GameStatus に相当
   */
  hands: defineTable({
    roomId: v.id("rooms"),
    handNumber: v.number(),
    phase: gamePhaseValidator,
    /** 場に出ているコミュニティカード（0–5枚） */
    communityCards: v.array(cardValidator),
    /** 次にアクションするプレイヤー（players テーブルの _id） */
    currentActorId: v.optional(v.id("players")),
    /** ベッティングラウンド開始時点の currentBet の最大値 */
    currentBetLevel: v.number(),
    /** ラウンド内の最低レイズ額 */
    minRaise: v.number(),
    /** 未使用のデッキ（サーバー専用・クライアントには返さない） */
    deck: v.array(cardValidator),
    /** フェーズ遷移・タイムアウト用 */
    phaseStartedAt: v.number(),
    /** ハンド終了時刻（showdown 後にセット） */
    endedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_number", ["roomId", "handNumber"]),

  /**
   * サイドポット（オールイン時）
   * 複数人が異なるスタックでオールインした場合に使用
   */
  sidePots: defineTable({
    handId: v.id("hands"),
    amount: v.number(),
    /** このポットに参加できるプレイヤーID一覧 */
    eligiblePlayerIds: v.array(v.id("players")),
  }).index("by_hand", ["handId"]),

  /**
   * アクション履歴（リプレイ・監査用）
   */
  actionLog: defineTable({
    handId: v.id("hands"),
    playerId: v.id("players"),
    phase: gamePhaseValidator,
    action: playerActionValidator,
    amount: v.number(), // bet/raise/call/all_in の実際のチップ移動額
    createdAt: v.number(),
  }).index("by_hand", ["handId"]),
});
