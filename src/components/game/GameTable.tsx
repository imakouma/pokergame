"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { getGuestUserId } from "@/lib/guest";
import { PlayingCard } from "./PlayingCard";
import { PlayerSeat, type SeatPlayer } from "./PlayerSeat";
import { ActionBar } from "./ActionBar";
import type { Card } from "@/lib/poker/types";

const PHASE_LABEL: Record<string, string> = {
  pre_flop: "プリフロップ",
  flop: "フロップ",
  turn: "ターン",
  river: "リバー",
  showdown: "ショーダウン",
};

const SEAT_ANGLES = [180, 240, 300, 0]; // 下・左下・左上・上（4人）

export function GameTable({ roomId }: { roomId: string }) {
  const userId = getGuestUserId();
  const state = useQuery(api.game.getTableState, {
    roomId: roomId as Id<"rooms">,
    userId,
  });
  const playerAction = useMutation(api.game.playerAction);
  const startGame = useMutation(api.game.startGameAndRunCpu);
  const nextHand = useMutation(api.game.nextHand);

  if (state === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-400">
        読み込み中…
      </div>
    );
  }

  if (state === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-red-400">
        テーブルが見つかりません
      </div>
    );
  }

  const mePlayer = state.players.find(
    (p: (typeof state.players)[number]) => p.userId === userId,
  );
  const handEnded = state.hand?.endedAt != null;
  const canNextHand = handEnded;
  const canStartGame = state.room.status === "recruiting" && !state.hand;

  const handleAction = async (
    action: "fold" | "check" | "call" | "bet" | "raise" | "all_in",
    amount?: number,
  ) => {
    await playerAction({
      roomId: roomId as Id<"rooms">,
      userId,
      action,
      amount,
    });
  };

  const community = (state.hand?.communityCards ?? []) as Card[];
  const toCall = mePlayer
    ? (state.hand?.currentBetLevel ?? 0) - mePlayer.currentBet
    : 0;

  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-4">
      <header className="flex w-full max-w-3xl items-center justify-between">
        <h1 className="text-lg font-semibold text-emerald-400">{state.room.name}</h1>
        {state.hand && (
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
            {PHASE_LABEL[state.hand.phase] ?? state.hand.phase}
          </span>
        )}
      </header>

      <div className="relative mx-auto h-[min(52vh,420px)] w-full max-w-lg">
        <div className="absolute inset-8 rounded-[50%] border-4 border-emerald-800/80 bg-gradient-to-b from-emerald-950 to-emerald-900 shadow-inner" />

        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <PlayingCard key={i} card={community[i]} hidden={!community[i]} />
            ))}
          </div>
          <div className="rounded-full bg-black/50 px-4 py-1 text-sm font-bold text-amber-300">
            Pot: {state.room.potTotal}
          </div>
        </div>

        {state.players.map((player: (typeof state.players)[number]) => {
          const angle = SEAT_ANGLES[player.seatIndex] ?? 0;
          const radius = 46;
          const x = 50 + radius * Math.sin((angle * Math.PI) / 180);
          const y = 50 - radius * Math.cos((angle * Math.PI) / 180);
          const isMe = player.userId === userId;

          return (
            <div
              key={player._id}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <PlayerSeat
                player={player as SeatPlayer}
                isDealer={state.room.dealerButtonSeat === player.seatIndex}
                isCurrentActor={state.hand?.currentActorId === player._id}
                isMe={isMe}
                handRevealed={handEnded}
              />
            </div>
          );
        })}
      </div>

      {mePlayer?.holeCards && !handEnded && (
        <div className="flex gap-2">
          <PlayingCard card={mePlayer.holeCards[0] as Card} />
          <PlayingCard card={mePlayer.holeCards[1] as Card} />
        </div>
      )}

      {handEnded && (
        <p className="text-sm text-amber-300/90">ショーダウン — 全員の手札を公開中</p>
      )}

      {canStartGame && (
        <button
          type="button"
          onClick={() =>
            startGame({ roomId: roomId as Id<"rooms">, userId })
          }
          className="rounded-xl bg-emerald-600 px-8 py-3 font-semibold hover:bg-emerald-500"
        >
          ゲーム開始
        </button>
      )}

      {canNextHand && (
        <button
          type="button"
          onClick={() => nextHand({ roomId: roomId as Id<"rooms">, userId })}
          className="rounded-xl bg-amber-600 px-8 py-3 font-semibold hover:bg-amber-500"
        >
          次のハンド
        </button>
      )}

      {state.hand && !handEnded && mePlayer && (
        <ActionBar
          disabled={!state.me?.isMyTurn}
          toCall={toCall}
          minRaise={state.hand.minRaise}
          chipCount={mePlayer.chipCount}
          currentBet={mePlayer.currentBet}
          currentBetLevel={state.hand.currentBetLevel}
          onAction={handleAction}
        />
      )}

      {!state.me?.isMyTurn && state.hand && !handEnded && (
        <p className="text-sm text-zinc-500">相手の番です…</p>
      )}
    </div>
  );
}
