import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/join')({
  component: JoinPage,
})

function JoinPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Join a Game</h1>
          <p className="text-sm text-muted-foreground">
            Enter the game code or scan a QR code
          </p>
        </div>
        {/* TODO: wire up join form */}
        <p className="text-center text-muted-foreground text-sm">
          Join form coming soon.
        </p>
      </div>
    </main>
  )
}
