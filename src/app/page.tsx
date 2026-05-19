"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "convex/_generated/api";
import { getDisplayName, getGuestUserId, setDisplayName } from "@/lib/guest";

export default function Home() {
  const router = useRouter();
  const createRoom = useMutation(api.rooms.createSinglePlayer);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePlay = async () => {
    setLoading(true);
    try {
      const displayName = name.trim() || getDisplayName();
      if (name.trim()) setDisplayName(displayName);
      const { roomId } = await createRoom({
        userId: getGuestUserId(),
        displayName,
      });
      router.push(`/game/${roomId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-emerald-400">
          Smart Poker
        </h1>
        <p className="mt-2 text-zinc-400">
          テキサスホールデム（ノーリミット）— 1人 vs CPU 3体
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <label className="text-sm text-zinc-400">表示名</label>
        <input
          type="text"
          placeholder={getDisplayName()}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100 outline-none focus:border-emerald-600"
        />
        <button
          type="button"
          disabled={loading}
          onClick={handlePlay}
          className="rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "作成中…" : "テーブルに着席"}
        </button>
      </div>
    </main>
  );
}
