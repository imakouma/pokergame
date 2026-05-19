import type { Card } from "@/lib/poker/types";

const SUIT_SYMBOL: Record<Card["suit"], string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const RANK_LABEL: Record<number, string> = {
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

export function PlayingCard({
  card,
  hidden = false,
  small = false,
}: {
  card?: Card;
  hidden?: boolean;
  small?: boolean;
}) {
  const size = small ? "h-14 w-10 text-xs" : "h-20 w-14 text-sm";

  if (hidden || !card) {
    return (
      <div
        className={`${size} flex items-center justify-center rounded-lg border-2 border-amber-700/60 bg-gradient-to-br from-emerald-900 to-emerald-950 shadow-md`}
      >
        <span className="text-amber-600/80">🂠</span>
      </div>
    );
  }

  const red = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div
      className={`${size} flex flex-col items-center justify-center rounded-lg border border-zinc-300 bg-white shadow-md ${red ? "text-red-600" : "text-zinc-900"}`}
    >
      <span className="font-bold leading-none">{rankLabel(card.rank)}</span>
      <span className="text-lg leading-none">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}
