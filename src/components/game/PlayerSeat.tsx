import type { Card } from "@/lib/poker/types";
import { PlayingCard } from "./PlayingCard";

export type SeatPlayer = {
  _id: string;
  displayName: string;
  seatIndex: number;
  chipCount: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  isBot: boolean;
  lastAction?: string;
  holeCards?: Card[];
  inHand?: boolean;
  showCardBacks?: boolean;
};

export function PlayerSeat({
  player,
  isDealer,
  isCurrentActor,
  isMe,
  handRevealed = false,
}: {
  player: SeatPlayer;
  isDealer: boolean;
  isCurrentActor: boolean;
  isMe: boolean;
  handRevealed?: boolean;
}) {
  return (
    <div
      className={`flex w-28 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-all ${
        isCurrentActor
          ? "ring-2 ring-amber-400 bg-amber-400/10"
          : "bg-zinc-900/60"
      } ${player.isFolded && !handRevealed ? "opacity-40" : ""}`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
          isMe ? "bg-emerald-600" : player.isBot ? "bg-zinc-600" : "bg-blue-600"
        }`}
      >
        {player.displayName.slice(0, 2).toUpperCase()}
      </div>
      <span className="max-w-full truncate text-xs font-medium text-zinc-200">
        {player.displayName}
      </span>
      <span className="text-xs text-amber-300">{player.chipCount} chips</span>
      {player.currentBet > 0 && (
        <span className="text-[10px] text-zinc-400">Bet: {player.currentBet}</span>
      )}
      {player.lastAction && (
        <span className="text-[10px] uppercase text-emerald-400">
          {player.lastAction}
        </span>
      )}
      {isDealer && (
        <span className="rounded bg-zinc-700 px-1 text-[9px] text-zinc-300">D</span>
      )}
      {player.inHand && (
        <div className="flex gap-0.5">
          <PlayingCard
            card={player.holeCards?.[0]}
            hidden={player.showCardBacks || !player.holeCards?.[0]}
            small
          />
          <PlayingCard
            card={player.holeCards?.[1]}
            hidden={player.showCardBacks || !player.holeCards?.[1]}
            small
          />
        </div>
      )}
    </div>
  );
}
