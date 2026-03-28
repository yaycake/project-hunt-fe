import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/game/$gameId')({
  component: GamePage,
})

function GamePage() {
  const { gameId } = Route.useParams()

  return (
    <main className="flex min-h-screen flex-col p-4">
      <header className="py-3">
        <h1 className="text-lg font-semibold">Game Lobby</h1>
        <p className="text-xs text-muted-foreground font-mono">{gameId}</p>
      </header>
      {/* TODO: lobby → active game view based on game status */}
      <p className="text-muted-foreground text-sm">Game view coming soon.</p>
    </main>
  )
}
