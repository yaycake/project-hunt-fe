import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { z } from 'zod'
import { createGame } from '@/lib/mock'

const createSearchSchema = z.object({
  username: z.string().optional(),
})

export const Route = createFileRoute('/create')({
  validateSearch: createSearchSchema,
  component: CreateGamePage,
})

function CreateGamePage() {
  const navigate = useNavigate()
  const { username: usernameFromSearch } = useSearch({ from: '/create' })
  const [gameName, setGameName] = useState('')
  const [username, setUsername] = useState(usernameFromSearch ?? '')

  useEffect(() => {
    if (usernameFromSearch) setUsername(usernameFromSearch)
  }, [usernameFromSearch])
  const [errors, setErrors] = useState<{ gameName?: string; username?: string }>({})

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createGame(gameName, username),
    onSuccess: ({ game }) => {
      navigate({ to: '/game/$gameId', params: { gameId: game.id } })
    },
  })

  function validate(): boolean {
    const next: typeof errors = {}
    if (!gameName.trim()) next.gameName = 'Game name is required'
    if (!username.trim()) next.username = 'Your name is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) mutate()
  }

  return (
    <main className="flex min-h-dvh flex-col px-6 py-8">
      {/* Back */}
      <Link
        to="/"
        className="mb-8 flex items-center gap-1 text-sm text-muted-foreground active:opacity-60 w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Link>

      {/* Header */}
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-bold">Start a Game</h1>
        <p className="text-sm text-muted-foreground">
          You'll be the game owner and can invite others with a link.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Game name" error={errors.gameName}>
          <input
            type="text"
            placeholder="e.g. Summer Hunt 2026"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            autoComplete="off"
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/60"
          />
        </Field>

        <Field label="Your name" error={errors.username}>
          <input
            type="text"
            placeholder="e.g. Grace"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="nickname"
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/60"
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition disabled:opacity-50 active:opacity-80"
        >
          {isPending ? 'Creating…' : 'Create Game'}
        </button>
      </form>
    </main>
  )
}
// ─── Reusable field wrapper ───────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

