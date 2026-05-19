import { GameTable } from "@/components/game/GameTable";

export default async function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <GameTable roomId={roomId} />
    </main>
  );
}
