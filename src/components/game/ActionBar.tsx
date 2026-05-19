"use client";

import { useState } from "react";

type Props = {
  disabled: boolean;
  toCall: number;
  minRaise: number;
  chipCount: number;
  currentBet: number;
  currentBetLevel: number;
  onAction: (
    action: "fold" | "check" | "call" | "bet" | "raise" | "all_in",
    amount?: number,
  ) => void;
};

export function ActionBar({
  disabled,
  toCall,
  minRaise,
  chipCount,
  currentBet,
  currentBetLevel,
  onAction,
}: Props) {
  const minBetTotal = currentBetLevel + minRaise;
  const [raiseTotal, setRaiseTotal] = useState(minBetTotal);

  const canCheck = toCall === 0;
  const maxRaise = currentBet + chipCount;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction("fold")}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-40"
        >
          フォールド
        </button>
        {canCheck ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction("check")}
            className="rounded-lg bg-zinc-600 px-4 py-2 text-sm font-semibold hover:bg-zinc-500 disabled:opacity-40"
          >
            チェック
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction("call")}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold hover:bg-blue-600 disabled:opacity-40"
          >
            コール {toCall > 0 ? `(${toCall})` : ""}
          </button>
        )}
        <button
          type="button"
          disabled={disabled || chipCount === 0}
          onClick={() => onAction("all_in")}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold hover:bg-amber-600 disabled:opacity-40"
        >
          オールイン
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-zinc-400">レイズ合計</label>
        <input
          type="range"
          min={minBetTotal}
          max={maxRaise}
          value={Math.min(raiseTotal, maxRaise)}
          disabled={disabled || maxRaise < minBetTotal}
          onChange={(e) => setRaiseTotal(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-12 text-sm text-amber-300">{raiseTotal}</span>
        <button
          type="button"
          disabled={disabled || maxRaise < minBetTotal}
          onClick={() =>
            onAction(currentBetLevel === 0 ? "bet" : "raise", raiseTotal)
          }
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40"
        >
          {currentBetLevel === 0 ? "ベット" : "レイズ"}
        </button>
      </div>
    </div>
  );
}
