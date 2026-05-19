import type { Card, EvaluatedHand, HandRank } from "./types";
import { HAND_RANK_VALUE } from "./types";

/** 5枚のランク配列からストレートの最高ランクを返す（なければ 0） */
export function detectStraightHigh(ranks: number[]): number {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.length < 5) return 0;

  const hasWheel =
    unique.includes(14) &&
    unique.includes(5) &&
    unique.includes(4) &&
    unique.includes(3) &&
    unique.includes(2);
  if (hasWheel) return 5;

  for (let i = 0; i <= unique.length - 5; i++) {
    let isStraight = true;
    for (let j = 1; j < 5; j++) {
      if (unique[i] - j !== unique[i + j]) {
        isStraight = false;
        break;
      }
    }
    if (isStraight) return unique[i];
  }
  return 0;
}

function rankGroups(ranks: number[]): { rank: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const r of ranks) {
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
}

/** 5枚から最良の役を評価 */
export function evaluate5(cards: Card[]): EvaluatedHand {
  if (cards.length !== 5) {
    throw new Error("evaluate5 にはちょうど5枚必要です");
  }

  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const isFlush = new Set(cards.map((c) => c.suit)).size === 1;
  const straightHigh = detectStraightHigh(ranks);
  const groups = rankGroups(ranks);

  if (isFlush && straightHigh > 0) {
    if (straightHigh === 14) {
      return { rank: "royal_flush", tiebreak: [] };
    }
    return { rank: "straight_flush", tiebreak: [straightHigh] };
  }

  if (groups[0].count === 4) {
    const quad = groups[0].rank;
    const kicker = groups[1].rank;
    return { rank: "four_of_a_kind", tiebreak: [quad, kicker] };
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    return {
      rank: "full_house",
      tiebreak: [groups[0].rank, groups[1].rank],
    };
  }

  if (isFlush) {
    return { rank: "flush", tiebreak: ranks };
  }

  if (straightHigh > 0) {
    return { rank: "straight", tiebreak: [straightHigh] };
  }

  if (groups[0].count === 3) {
    const kickers = groups
      .filter((g) => g.count === 1)
      .map((g) => g.rank)
      .sort((a, b) => b - a);
    return { rank: "three_of_a_kind", tiebreak: [groups[0].rank, ...kickers] };
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    const [highPair, lowPair] =
      groups[0].rank > groups[1].rank
        ? [groups[0].rank, groups[1].rank]
        : [groups[1].rank, groups[0].rank];
    const kicker = groups.find((g) => g.count === 1)!.rank;
    return { rank: "two_pair", tiebreak: [highPair, lowPair, kicker] };
  }

  if (groups[0].count === 2) {
    const pair = groups[0].rank;
    const kickers = groups
      .filter((g) => g.count === 1)
      .map((g) => g.rank)
      .sort((a, b) => b - a);
    return { rank: "one_pair", tiebreak: [pair, ...kickers] };
  }

  return { rank: "high_card", tiebreak: ranks };
}

function combinations7choose5(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  const n = cards.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            result.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
          }
        }
      }
    }
  }
  return result;
}

/** 7枚（ホール2 + コミュニティ5）から最良の5枚を選んで評価 */
export function evaluate7(cards: Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error("evaluate7 には5〜7枚必要です");
  }
  if (cards.length === 5) return evaluate5(cards);

  let best: EvaluatedHand | null = null;
  for (const combo of combinations7choose5(cards)) {
    const hand = evaluate5(combo);
    if (!best || compareEvaluated(hand, best) > 0) {
      best = hand;
    }
  }
  return best!;
}

export function compareEvaluated(a: EvaluatedHand, b: EvaluatedHand): number {
  const catDiff = HAND_RANK_VALUE[a.rank] - HAND_RANK_VALUE[b.rank];
  if (catDiff !== 0) return catDiff;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function handRankLabel(rank: HandRank): string {
  const labels: Record<HandRank, string> = {
    high_card: "ハイカード",
    one_pair: "ワンペア",
    two_pair: "ツーペア",
    three_of_a_kind: "スリーカード",
    straight: "ストレート",
    flush: "フラッシュ",
    full_house: "フルハウス",
    four_of_a_kind: "フォーカード",
    straight_flush: "ストレートフラッシュ",
    royal_flush: "ロイヤルフラッシュ",
  };
  return labels[rank];
}
