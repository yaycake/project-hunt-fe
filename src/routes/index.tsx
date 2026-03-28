import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-12">
      {/* Brand */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl text-primary-foreground select-none">
          🎯
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Project Hunt</h1>
          <p className="text-sm text-muted-foreground">
            Race your team to complete goals.
          </p>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          to="/create"
          className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground active:opacity-80"
        >
          Start a Game
        </Link>
        <Link
          to="/join"
          className="flex w-full items-center justify-center rounded-xl border border-border px-4 py-4 text-base font-semibold active:opacity-60"
        >
          Join a Game
        </Link>
      </div>
    </main>
  )
}
