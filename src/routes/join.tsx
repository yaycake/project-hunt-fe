import { useState } from 'react'
import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { joinGame } from '@/lib/mock'
import { z } from 'zod'

// Allow ?id=XXXXXX pre-fill when joining via a shared link
const searchSchema = z.object({
  id: z.string().optional(),
})

export const Route = createFileRoute('/join')({
  validateSearch: searchSchema,
  component: JoinGamePage,
})

function JoinGamePage() {
  const navigate = useNavigate()
  const { id: prefillId } = useSearch({ from: '/join' })

  const [gameCode, setGameCode] = useState(prefillId ?? '')
  const [username, setUsername] = useState('')
  const [errors, setErrors] = useState<{ gameCode?: string; username?: string }>({})

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => joinGame(gameCode, username),
    onSuccess: ({ game }) => {
      navigate({ to: '/game/$gameId', params: { gameId: game.id } })
    },
  })

  function validate(): boolean {
    const next: typeof errors = {}
    if (!gameCode.trim()) next.gameCode = 'Game code is required'
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
        <h1 className="text-2xl">Join a Game</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-character code shared by the game owner.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Game code" error={errors.gameCode}>
          <input
            type="text"
            placeholder="e.g. A4K9PZ"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-border bg-white px-4 py-3 font-mono text-lg tracking-widest transition placeholder:text-muted-foreground/40 placeholder:tracking-widest"
          />
        </Field>

        <Field label="Your name" error={errors.username}>
          <input
            type="text"
            placeholder="e.g. Alex"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="nickname"
            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm transition placeholder:text-muted-foreground/60"
          />
        </Field>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 space-y-1">
            <p className="text-sm text-destructive">{error.message}</p>
            {error.message.includes('not found') && (
              <p className="text-xs text-destructive/70">
                The mock store uses browser storage — games created in one browser
                aren't visible in another. Use two tabs in the same browser to test.
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition disabled:opacity-50 active:opacity-80"
        >
          {isPending ? 'Joining…' : 'Join Game'}
        </button>
      </form>
    </main>
  )
}

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
      <label className="text-sm">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
