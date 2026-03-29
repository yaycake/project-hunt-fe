import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { createGame, joinGame } from '@/lib/mock'
import { cn } from '@/lib/utils'

/** Fallback if the player leaves “Name this game” empty. */
const DEFAULT_NEW_GAME_NAME = 'New Game'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const inputClass =
  'w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/60'

const primaryCtaClass =
  'flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition disabled:pointer-events-none disabled:opacity-40 active:opacity-80'

const secondaryCtaClass =
  'flex w-full items-center justify-center rounded-xl border border-border px-4 py-4 text-base font-semibold transition active:opacity-60 disabled:pointer-events-none disabled:opacity-40'

function HomePage() {
  const navigate = useNavigate()
  const gameIdInputRef = useRef<HTMLInputElement>(null)
  const [username, setUsername] = useState('')
  const [gameTitle, setGameTitle] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [flow, setFlow] = useState<'pick' | 'join'>('pick')

  const {
    mutate: doCreate,
    isPending: isCreating,
    error: createError,
    reset: resetCreateError,
  } = useMutation({
    mutationFn: () =>
      createGame(gameTitle.trim() || DEFAULT_NEW_GAME_NAME, username.trim()),
    onSuccess: ({ game }) => {
      navigate({ to: '/game/$gameId', params: { gameId: game.id } })
    },
  })

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

  function startGame() {
    const name = username.trim()
    if (!name) return
    resetCreateError()
    doCreate()
  }

  function submitJoin() {
    const name = username.trim()
    const code = gameCode.trim()
    if (!name || !code) return
    resetJoinError()
    doJoin()
  }

  const canStart = username.trim().length > 0 && !isCreating && !isJoining
  const canSubmitJoin =
    username.trim().length > 0 && gameCode.trim().length > 0 && !isJoining && !isCreating

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl text-primary-foreground select-none">
          🎯
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">Project Hunt</h1>
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

        {/* Three fixed slots: game name ↔ game ID | Start ↔ Join primary | Join secondary ↔ Back */}
        <div
          className="flex flex-col gap-3"
          role="region"
          aria-label={flow === 'pick' ? 'Start or join' : 'Join with game ID'}
        >
          {/* Slot 1: Name this game ↔ Game ID (same footprint) */}
          <div className="flex min-h-[5.5rem] flex-col justify-center gap-1.5">
            {flow === 'pick' ? (
              <>
                <label htmlFor="home-game-title" className="text-sm font-medium">
                  Name this game
                </label>
                <input
                  id="home-game-title"
                  type="text"
                  name="gameTitle"
                  autoComplete="off"
                  placeholder="e.g. Summer Hunt 2026"
                  value={gameTitle}
                  onChange={e => setGameTitle(e.target.value)}
                  className={inputClass}
                />
              </>
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

          {/* Slot 2: Start a Game ↔ Join game (primary) */}
          <div className="flex min-h-[3.25rem] items-center">
            {flow === 'pick' ? (
              <button
                type="button"
                disabled={!canStart}
                onClick={startGame}
                className={primaryCtaClass}
              >
                {isCreating ? 'Starting…' : 'Start a Game'}
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

          {/* Slot 3: Join a Game (secondary) ↔ Back (text) — reserved height matches */}
          <div className="flex min-h-[3.25rem] items-center justify-center">
            {flow === 'pick' ? (
              <button
                type="button"
                disabled={isCreating}
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
                onClick={() => {
                  setFlow('pick')
                  setGameCode('')
                  resetJoinError()
                }}
                className="text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline active:opacity-70"
              >
                Back
              </button>
            )}
          </div>
        </div>

        {flow === 'pick' && createError && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">{createError.message}</p>
          </div>
        )}

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
