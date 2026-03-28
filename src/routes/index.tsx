import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Project Hunt</h1>
        <p className="text-muted-foreground">
          Gamified scavenger hunts. Race your team to complete goals.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          to="/join"
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground text-center"
        >
          Join a Game
        </Link>
        <Link
          to="/login"
          className="w-full rounded-md border border-border px-4 py-3 text-sm font-semibold text-center"
        >
          Sign In
        </Link>
      </div>
    </main>
  )
}
