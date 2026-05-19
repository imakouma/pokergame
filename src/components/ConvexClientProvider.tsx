"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center text-zinc-400">
        <p>
          <code className="text-emerald-400">NEXT_PUBLIC_CONVEX_URL</code>{" "}
          が未設定です。
          <br />
          <code className="text-sm">npx convex dev</code>{" "}
          実行後に .env.local を確認してください。
          <br />
          Vercel 本番では環境変数{" "}
          <code className="text-emerald-400">NEXT_PUBLIC_CONVEX_URL</code>{" "}
          を設定して再デプロイしてください。
        </p>
      </div>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
