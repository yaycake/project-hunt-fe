import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { joinGame } from '@/lib/mock'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const inputClass =
  'w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/60'

const primaryCtaClass =
  'flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition disabled:pointer-events-none disabled:opacity-40 active:opacity-80'

const secondaryCtaClass =
  'flex w-full items-center justify-center rounded-xl border border-border px-4 py-4 text-base font-semibold transition active:opacity-60'

function HomePage() {
  const navigate = useNavigate()
  const gameIdInputRef = useRef<HTMLInputElement>(null)
  const [username, setUsername] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [flow, setFlow] = useState<'pick' | 'join'>('pick')

  const {
    mutate: doJoin,
    isPending: isJoining,
    error: joinError,
    reset: resetJoinError,
  } = useMutation({
    mutationFn: () => joinGame(gameCode, username),
    onSuccess: ({ game }) => {
      navigate({ to: '/game/$gameId', params: { gameId: game.id } })
    },
  })

  useEffect(() => {
    if (flow === 'join') {
      gameIdInputRef.current?.focus()
    }
  }, [flow])

  function goToCreate() {
    const name = username.trim()
    if (!name) return
    navigate({ to: '/create', search: { username: name } })
  }

  function submitJoin() {
    const name = username.trim()
    const code = gameCode.trim()
    if (!name || !code) return
    resetJoinError()
    doJoin()
  }

  const canStart = username.trim().length > 0
  const canSubmitJoin =
    username.trim().length > 0 && gameCode.trim().length > 0 && !isJoining

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl text-primary-foreground select-none">
          🎯
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Project Hunt</h1>
          <p className="text-sm text-muted-foreground">Race your team to complete goals.</p>
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="home-username" className="text-sm font-medium">
            Your name
          </label>
          <input
            id="home-username"
            type="text"
            name="username"
            autoComplete="nickname"
            placeholder="e.g. Alex"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Fixed slots: same vertical rhythm in pick vs join to avoid layout jump */}
        <div
          className="flex flex-col gap-3"
          role="region"
          aria-label={flow === 'pick' ? 'Start or join' : 'Join with game ID'}
        >
          {/* Slot 1: Start a Game ↔ Game ID (matched min-height) */}
          <div className="flex min-h-[5.5rem] flex-col justify-center gap-1.5">
            {flow === 'pick' ? (
              <button
                type="button"
                disabled={!canStart}
                onClick={goToCreate}
                className={primaryCtaClass}
              >
                Start a Game
              </button>
            ) : (
              <>
                <label htmlFor="home-game-id" className="text-sm font-medium">
                  Game ID
                </label>
                <input
                  ref={gameIdInputRef}
                  id="home-game-id"
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="e.g. A4K9PZ"
                  maxLength={6}
                  value={gameCode}
                  onChange={e => setGameCode(e.target.value.toUpperCase())}
                  className={cn(
                    inputClass,
                    'font-mono text-lg tracking-widest placeholder:tracking-widest placeholder:text-muted-foreground/40',
                  )}
                />
              </>
            )}
          </div>

          {/* Slot 2: Join a Game ↔ Join game */}
          <div className="flex min-h-[3.25rem] items-center">
            {flow === 'pick' ? (
              <button
                type="button"
                onClick={() => {
                  resetJoinError()
                  setFlow('join')
                }}
                className={secondaryCtaClass}
              >
                Join a Game
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSubmitJoin}
                onClick={submitJoin}
                className={primaryCtaClass}
              >
                {isJoining ? 'Joining…' : 'Join game'}
              </button>
            )}
          </div>

          {/* Slot 3: reserved row — invisible in pick so Back doesn’t shift layout */}
          <div className="flex min-h-[2.75rem] items-center justify-center">
            {flow === 'join' ? (
              <button
                type="button"
                onClick={() => {
                  setFlow('pick')
                  setGameCode('')
                  resetJoinError()
                }}
                className="text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline active:opacity-70"
              >
                Back
              </button>
            ) : (
              <span className="invisible text-sm" aria-hidden>
                Back
              </span>
            )}
          </div>
        </div>

        {flow === 'join' && joinError && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 space-y-1">
            <p className="text-sm text-destructive">{joinError.message}</p>
            {joinError.message.includes('not found') && (
              <p className="text-xs text-destructive/80">
                The mock store uses browser storage — games created in one browser aren&apos;t visible in
                another. Use two tabs in the same browser to test.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
