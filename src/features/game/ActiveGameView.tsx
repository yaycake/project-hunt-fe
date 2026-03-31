import { createPortal } from 'react-dom'
import { Fragment, useRef, useState, type ChangeEvent } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  GripVertical,
  ListChecks,
  MapPin,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { userTileClassName } from '@/components/ui/UserTile'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { Button } from '@/components/ui/Button'
import { GameCountdownTimer } from '@/features/game/GameCountdownTimer'
import { useSheetDrag } from '@/features/game/useSheetDrag'
import { useGoalSort, type GoalSortSession } from '@/features/game/useGoalSort'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Goal {
  id: number
  title: string
  description?: string
  countLimit: number
}

interface TeamInfo {
  id: string
  name: string
  /** Hex from teamPalette.ts */
  color: string
}

interface OtherTeamCompletion {
  teamId: string
  goalId: number
}

interface CompletionData {
  /** object URL — prototype only; swap for a real upload URL. */
  imageObjectUrl: string
  comment: string
}

type PanelView = 'list' | 'detail' | 'completing'

// ─── Mock data ────────────────────────────────────────────────────────────────
// BACKEND DEV: replace with real API data from /api/games/:id/goals,
// /api/games/:id/teams, and /api/games/:id/completed-goals.

const MOCK_GOALS: Goal[] = [
  { id: 1,  title: 'Find a red front door',         description: 'Photograph any building with a red front door.',                countLimit: 1 },
  { id: 2,  title: 'Street art',                    description: 'Locate and photograph a piece of street art or graffiti.',      countLimit: 1 },
  { id: 3,  title: 'Spot a dog',                    description: 'Get a photo with a dog you encounter on your route.',           countLimit: 3 },
  { id: 4,  title: 'Grab a coffee',                 description: 'Visit a local café and photograph your drink.',                 countLimit: 1 },
  { id: 5,  title: 'Oldest building you can find',  description: 'Find a building with a visible construction date and snap it.', countLimit: 1 },
  { id: 6,  title: 'Blue vehicle',                  description: 'Photograph any blue vehicle — car, bike, bus, anything.',       countLimit: 2 },
  { id: 7,  title: 'An interesting staircase',      description: 'Find and photograph a staircase with character.',               countLimit: 1 },
  { id: 8,  title: 'Local landmark selfie',         description: 'Take a selfie at the most iconic local landmark you can reach.', countLimit: 1 },
  { id: 9,  title: 'Something yellow',              description: 'Photograph anything noticeably yellow.',                        countLimit: 2 },
  { id: 10, title: 'Reflections',                   description: 'Find a reflection in water, glass, or a mirror and capture it.', countLimit: 1 },
  { id: 11, title: 'A bicycle',                     description: 'Find and photograph a parked or moving bicycle.',               countLimit: 1 },
  { id: 12, title: 'Something handmade',            description: 'A craft stall, hand-painted sign, knitted post — anything DIY.', countLimit: 1 },
]

const MOCK_OTHER_COMPLETIONS: OtherTeamCompletion[] = []

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  gameName: string
  /** Teams from the game's lobby configuration — passed in from the route. */
  teams: TeamInfo[]
  goals?: Goal[]
  otherCompletions?: OtherTeamCompletion[]
  timeLimitMinutes?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function panelX(panel: PanelView, current: PanelView): string {
  const ORDER: PanelView[] = ['list', 'detail', 'completing']
  return `${(ORDER.indexOf(panel) - ORDER.indexOf(current)) * 100}%`
}

// ─── Map placeholder ──────────────────────────────────────────────────────────

function MapPlaceholder() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-200 dark:bg-slate-800">
      <svg className="absolute inset-0 h-full w-full opacity-30 dark:opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#map-grid)" className="text-slate-400 dark:text-slate-600" />
      </svg>
      <svg className="absolute inset-0 h-full w-full opacity-40 dark:opacity-25" xmlns="http://www.w3.org/2000/svg">
        <line x1="0"   y1="35%" x2="100%" y2="40%" stroke="white" strokeWidth="6" />
        <line x1="0"   y1="60%" x2="100%" y2="57%" stroke="white" strokeWidth="10" />
        <line x1="28%" y1="0"   x2="32%"  y2="100%" stroke="white" strokeWidth="6" />
        <line x1="65%" y1="0"   x2="62%"  y2="100%" stroke="white" strokeWidth="10" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 opacity-40 dark:opacity-30">
          <MapPin className="h-8 w-8 text-primary" strokeWidth={2} />
          <span className="rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            Map loading…
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── FAB ─────────────────────────────────────────────────────────────────────

function FloatingGoalsButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 z-[50] flex justify-center transition-all duration-300',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
      style={{ paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))' }}
    >
      <button
        type="button"
        onClick={onClick}
        className="!min-h-0 !min-w-0 inline-flex items-center gap-2 rounded-full px-5 py-3 font-rubik text-sm font-semibold shadow-xl transition-transform active:scale-95"
        style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
        aria-label="View goals list"
      >
        <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
        View goals
      </button>
    </div>
  )
}

// ─── Team dots ────────────────────────────────────────────────────────────────

function TeamDots({
  teams,
  otherCompletions,
  goalId,
}: {
  teams: TeamInfo[]
  otherCompletions: OtherTeamCompletion[]
  goalId: number
}) {
  const completing = teams.filter(t =>
    otherCompletions.some(c => c.teamId === t.id && c.goalId === goalId),
  )
  if (completing.length === 0) return null

  const label =
    completing.length === 1
      ? `${completing[0].name} completed this`
      : `${completing.length} other teams completed this`

  return (
    <div className="mt-1.5 flex items-center gap-1.5" title={label}>
      {completing.map(t => (
        <span
          key={t.id}
          className="inline-block h-2 w-2 rounded-full ring-1 ring-white/20"
          style={{ backgroundColor: t.color }}
          aria-hidden
        />
      ))}
      <span className="text-[11px] leading-none text-muted-foreground">{label}</span>
    </div>
  )
}

// ─── Sortable grip ────────────────────────────────────────────────────────────

function GoalSortGrip({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
}) {
  return (
    <span
      data-sort-handle=""
      onPointerDown={onPointerDown}
      className="inline-flex h-10 w-7 shrink-0 touch-none cursor-grab select-none items-center justify-center rounded-lg text-muted-foreground/50 active:cursor-grabbing"
      aria-hidden
    >
      <GripVertical className="h-4 w-4" strokeWidth={2} />
    </span>
  )
}

// ─── Sort ghost card (rendered via portal to escape sheet's transform) ─────────

function GoalSortGhost({
  goal,
  session,
}: {
  goal: Goal
  session: GoalSortSession
}) {
  return (
    <div
      data-sort-ghost=""
      className={cn(
        'pointer-events-none fixed z-[125]',
        'min-w-[200px] max-w-[min(100vw-2rem,360px)]',
        '-translate-x-1/2 -translate-y-[calc(50%+14px)]',
      )}
      style={{ left: session.x, top: session.y }}
    >
      <div
        className={cn(
          userTileClassName,
          'flex items-center gap-2 px-3 py-3',
          'shadow-2xl ring-2 ring-primary/25 dark:ring-primary/35',
        )}
      >
        <GoalSortGrip onPointerDown={() => {}} />
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted text-xs font-bold tabular-nums text-muted-foreground">
          <GripVertical className="h-3.5 w-3.5 opacity-60" strokeWidth={2.5} aria-hidden />
        </div>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {goal.title}
        </p>
      </div>
    </div>
  )
}

// ─── Goal list panel ──────────────────────────────────────────────────────────

interface GoalListPanelProps {
  goals: Goal[]
  completions: Map<number, CompletionData>
  teams: TeamInfo[]
  otherCompletions: OtherTeamCompletion[]
  panelActive: boolean
  onSelectGoal: (id: number) => void
}

function GoalListPanel({
  goals,
  completions,
  teams,
  otherCompletions,
  panelActive,
  onSelectGoal,
}: GoalListPanelProps) {
  const listRef = useRef<HTMLUListElement>(null)

  const { goalIds, session, onGripPointerDown } = useGoalSort(
    goals.map(g => g.id),
    listRef,
    panelActive,
  )

  const orderedGoals = goalIds
    .map(id => goals.find(g => g.id === id))
    .filter((g): g is Goal => !!g)

  const draggingGoal = session ? goals.find(g => g.id === session.goalId) : null

  return (
    <>
      {/* ── Scrollable list ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-y-auto scroll-momentum">
        <ul
          ref={listRef}
          className="space-y-2 px-3 pt-3"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          {orderedGoals.map((goal, displayIdx) => {
            const done        = completions.has(goal.id)
            const isDragging  = session?.goalId === goal.id
            // Show indicator BEFORE this item's slot
            const showInsert  = !!session && session.insertAt === displayIdx

            return (
              <Fragment key={goal.id}>
                {/* ── Insert indicator ──────────────────────────────────── */}
                {showInsert && (
                  <li
                    aria-hidden
                    className="mx-1 h-0.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.65)]"
                  />
                )}

                {/* ── Goal tile ─────────────────────────────────────────── */}
                <li
                  data-sort-goal-id={goal.id}
                  className={cn(
                    userTileClassName,
                    'flex items-center gap-0 transition-opacity duration-150',
                    isDragging ? 'opacity-25' : 'opacity-100',
                  )}
                >
                  {/* Grip — drag-only, stops tap propagation */}
                  <GoalSortGrip
                    onPointerDown={e => onGripPointerDown(e, goal.id)}
                  />

                  {/* Tappable content area */}
                  <button
                    type="button"
                    onClick={() => onSelectGoal(goal.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 text-left"
                  >
                    {/* Number / check badge */}
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums',
                        done
                          ? 'border-success bg-success text-success-foreground'
                          : 'border-border bg-muted text-muted-foreground',
                      )}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                      ) : (
                        displayIdx + 1
                      )}
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-semibold leading-snug',
                          done ? 'text-muted-foreground line-through' : 'text-foreground',
                        )}
                      >
                        {goal.title}
                      </p>
                      {goal.description && !done && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {goal.description}
                        </p>
                      )}
                      <TeamDots
                        teams={teams}
                        otherCompletions={otherCompletions}
                        goalId={goal.id}
                      />
                    </div>

                    {/* Count badge */}
                    {goal.countLimit > 1 && !done && (
                      <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                        ×{goal.countLimit}
                      </span>
                    )}

                    <ChevronRight
                      className={cn(
                        'h-4 w-4 shrink-0',
                        done ? 'text-muted-foreground/40' : 'text-muted-foreground/60',
                      )}
                      aria-hidden
                    />
                  </button>
                </li>
              </Fragment>
            )
          })}

          {/* End-of-list insert indicator */}
          {session && session.insertAt === orderedGoals.length && (
            <li
              aria-hidden
              className="mx-1 h-0.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.65)]"
            />
          )}
        </ul>
      </div>

      {/* ── Sort ghost — portal escapes the sheet's CSS transform ─────────── */}
      {session && draggingGoal &&
        createPortal(
          <GoalSortGhost goal={draggingGoal} session={session} />,
          document.body,
        )}
    </>
  )
}

// ─── Goal detail panel ────────────────────────────────────────────────────────

interface GoalDetailPanelProps {
  goal: Goal
  completion: CompletionData | undefined
  teams: TeamInfo[]
  otherCompletions: OtherTeamCompletion[]
  onCompleteGoal: () => void
  onRedo: () => void
}

function GoalDetailPanel({
  goal, completion, teams, otherCompletions, onCompleteGoal, onRedo,
}: GoalDetailPanelProps) {
  const done = !!completion
  const completingTeams = teams.filter(t =>
    otherCompletions.some(c => c.teamId === t.id && c.goalId === goal.id),
  )

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto scroll-momentum">
      <div className="flex-1 space-y-5 px-5 pt-4 pb-6">
        {done && (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-sm font-semibold text-success">
            <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
            Your team completed this
          </div>
        )}

        <div>
          <h3 className={cn('text-xl font-bold leading-snug', done ? 'text-muted-foreground line-through' : 'text-foreground')}>
            {goal.title}
          </h3>
          {goal.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{goal.description}</p>
          )}
          {goal.countLimit > 1 && (
            <div className="mt-3 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Complete up to {goal.countLimit} times
            </div>
          )}
        </div>

        {completingTeams.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed by</p>
            <div className="flex flex-wrap gap-2">
              {completingTeams.map(team => (
                <div
                  key={team.id}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: `${team.color}22`,
                    color: team.color,
                    border: `1px solid ${team.color}55`,
                  }}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} aria-hidden />
                  {team.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {done && completion && (
          <div className="space-y-3">
            <img
              src={completion.imageObjectUrl}
              alt="Submitted proof"
              className="w-full rounded-2xl object-cover shadow-sm"
              style={{ maxHeight: '40vh' }}
            />
            {completion.comment.trim() && (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
                {completion.comment}
              </p>
            )}
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t border-border bg-background px-5 py-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        {done ? (
          <Button variant="secondary" type="button" onClick={onRedo} className="gap-2">
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
            Redo this goal
          </Button>
        ) : (
          <PrimaryButton type="button" onClick={onCompleteGoal}>Complete goal</PrimaryButton>
        )}
      </div>
    </div>
  )
}

// ─── Completing (submission) panel ────────────────────────────────────────────

interface CompletingPanelProps {
  goalTitle: string
  pendingImageUrl: string | null
  pendingComment: string
  onImageChange: (e: ChangeEvent<HTMLInputElement>) => void
  onCommentChange: (val: string) => void
  onSubmit: () => void
}

function CompletingPanel({
  goalTitle, pendingImageUrl, pendingComment,
  onImageChange, onCommentChange, onSubmit,
}: CompletingPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scroll-momentum px-5 pt-4 pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{goalTitle}</p>

        <div>
          <input
            ref={fileInputRef}
            id="goal-photo-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={onImageChange}
          />
          {pendingImageUrl ? (
            <div className="relative">
              <img
                src={pendingImageUrl}
                alt="Your photo"
                className="w-full rounded-2xl object-cover shadow-sm"
                style={{ maxHeight: '40vh' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="!min-h-0 !min-w-0 absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition active:opacity-70"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden />
                Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 py-10 text-center transition active:bg-muted/60"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Camera className="h-6 w-6 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Add a photo</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Take a photo or choose from your library</p>
              </div>
            </button>
          )}
        </div>

        <div>
          <label
            htmlFor="goal-comment"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Comment <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            id="goal-comment"
            value={pendingComment}
            onChange={e => onCommentChange(e.target.value)}
            placeholder="Describe how you found it…"
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div
        className="shrink-0 border-t border-border bg-background px-5 py-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <PrimaryButton
          type="button"
          onClick={onSubmit}
          disabled={!pendingImageUrl}
          className="disabled:opacity-40"
        >
          Submit proof
        </PrimaryButton>
      </div>
    </div>
  )
}

// ─── Goals action sheet ───────────────────────────────────────────────────────

interface GoalsSheetProps {
  gameName: string
  goals: Goal[]
  teams: TeamInfo[]
  otherCompletions: OtherTeamCompletion[]
  open: boolean
  panelView: PanelView
  selectedGoal: Goal | undefined
  completions: Map<number, CompletionData>
  pendingImageUrl: string | null
  pendingComment: string
  onClose: () => void
  onSelectGoal: (id: number) => void
  onBack: () => void
  onCompleteGoal: () => void
  onRedo: () => void
  onImageChange: (e: ChangeEvent<HTMLInputElement>) => void
  onCommentChange: (val: string) => void
  onSubmit: () => void
}

function GoalsSheet({
  gameName, goals, teams, otherCompletions,
  open, panelView, selectedGoal, completions,
  pendingImageUrl, pendingComment,
  onClose, onSelectGoal, onBack, onCompleteGoal, onRedo,
  onImageChange, onCommentChange, onSubmit,
}: GoalsSheetProps) {
  // ── Sheet drag-to-close ────────────────────────────────────────────────────
  const { translateY, isDragging, onHandlePointerDown } = useSheetDrag(onClose)

  const completedCount = completions.size

  const headerTitle =
    panelView === 'list' ? gameName :
    panelView === 'detail' ? (selectedGoal?.title ?? '') :
    'Complete goal'

  return (
    <>
      {/* Tap-outside dismiss */}
      <div
        className={cn(
          'absolute inset-0 z-[49] transition-opacity duration-300',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet panel */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-[50] flex h-[80dvh] flex-col',
          'rounded-t-3xl bg-background shadow-2xl',
          // Disable CSS transition while dragging (finger tracks in real-time);
          // re-enable it for open/close snap and spring-back.
          !isDragging && 'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
        )}
        style={{
          transform: isDragging
            ? `translateY(${translateY}px)`
            : open ? 'translateY(0)' : 'translateY(100%)',
        }}
        role="dialog"
        aria-label="Game goals"
      >
        {/* ── Drag handle + header — entire area is the sheet drag target ── */}
        <div
          onPointerDown={onHandlePointerDown}
          className="shrink-0 cursor-grab select-none active:cursor-grabbing touch-none"
        >
          {/* Handle pill */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
          </div>

          {/* Header row */}
          <div className="border-b border-border px-5 pb-3 pt-1">
            <div className="flex min-w-0 items-center gap-2">
              {panelView !== 'list' && (
                <button
                  type="button"
                  onPointerDown={e => e.stopPropagation()} // don't start sheet drag
                  onClick={onBack}
                  className="!min-h-0 !min-w-0 -ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:bg-muted"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5 text-foreground" aria-hidden />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <h2
                  className={cn(
                    'truncate font-semibold leading-tight text-foreground',
                    panelView === 'list' ? 'text-lg' : 'text-base',
                  )}
                >
                  {headerTitle}
                </h2>
                {panelView === 'list' && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {completedCount} of {goals.length} completed · drag to reorder
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sliding panel body ─────────────────────────────────────────── */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* List panel */}
          <div
            className="absolute inset-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `translateX(${panelX('list', panelView)})` }}
            aria-hidden={panelView !== 'list'}
          >
            <GoalListPanel
              goals={goals}
              completions={completions}
              teams={teams}
              otherCompletions={otherCompletions}
              panelActive={panelView === 'list' && open}
              onSelectGoal={onSelectGoal}
            />
          </div>

          {/* Detail panel */}
          <div
            className="absolute inset-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `translateX(${panelX('detail', panelView)})` }}
            aria-hidden={panelView !== 'detail'}
          >
            {selectedGoal && (
              <GoalDetailPanel
                goal={selectedGoal}
                completion={completions.get(selectedGoal.id)}
                teams={teams}
                otherCompletions={otherCompletions}
                onCompleteGoal={onCompleteGoal}
                onRedo={onRedo}
              />
            )}
          </div>

          {/* Completing panel */}
          <div
            className="absolute inset-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `translateX(${panelX('completing', panelView)})` }}
            aria-hidden={panelView !== 'completing'}
          >
            {selectedGoal && (
              <CompletingPanel
                goalTitle={selectedGoal.title}
                pendingImageUrl={pendingImageUrl}
                pendingComment={pendingComment}
                onImageChange={onImageChange}
                onCommentChange={onCommentChange}
                onSubmit={onSubmit}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Active game view (root) ──────────────────────────────────────────────────

export function ActiveGameView({
  gameName,
  teams,
  goals            = MOCK_GOALS,
  otherCompletions = MOCK_OTHER_COMPLETIONS,
  timeLimitMinutes,
}: Props) {
  const [sheetOpen, setSheetOpen]             = useState(true)
  const [selectedGoalId, setSelectedGoalId]   = useState<number | null>(null)
  const [isCompleting, setIsCompleting]       = useState(false)
  const [completions, setCompletions]         = useState<Map<number, CompletionData>>(new Map())
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const [pendingComment, setPendingComment]   = useState('')

  const panelView: PanelView =
    isCompleting ? 'completing' : selectedGoalId !== null ? 'detail' : 'list'
  const selectedGoal = goals.find(g => g.id === selectedGoalId)

  function handleSelectGoal(id: number) {
    setSelectedGoalId(id)
    setIsCompleting(false)
  }

  function handleBack() {
    if (isCompleting) {
      if (pendingImageUrl) { URL.revokeObjectURL(pendingImageUrl); setPendingImageUrl(null) }
      setPendingComment('')
      setIsCompleting(false)
    } else {
      setSelectedGoalId(null)
    }
  }

  function handleRedo() {
    if (!selectedGoalId) return
    // Clear the previous completion (revoke its object URL)
    setCompletions(prev => {
      const next = new Map(prev)
      const old = next.get(selectedGoalId)
      if (old) URL.revokeObjectURL(old.imageObjectUrl)
      next.delete(selectedGoalId)
      return next
    })
    // Reset any in-flight pending state and jump straight to submission panel
    if (pendingImageUrl) { URL.revokeObjectURL(pendingImageUrl); setPendingImageUrl(null) }
    setPendingComment('')
    setIsCompleting(true)
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl)
    setPendingImageUrl(URL.createObjectURL(file))
    e.target.value = ''
  }

  function handleSubmit() {
    if (!selectedGoalId || !pendingImageUrl) return
    setCompletions(prev => {
      const next = new Map(prev)
      const old = next.get(selectedGoalId)
      if (old && old.imageObjectUrl !== pendingImageUrl) URL.revokeObjectURL(old.imageObjectUrl)
      next.set(selectedGoalId, { imageObjectUrl: pendingImageUrl, comment: pendingComment.trim() })
      return next
    })
    setPendingImageUrl(null)
    setPendingComment('')
    setIsCompleting(false)
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <MapPlaceholder />

      {!!timeLimitMinutes && timeLimitMinutes > 0 && (
        <div
          className="absolute left-0 top-0 z-[45]"
          style={{
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingTop:  'max(0.75rem, env(safe-area-inset-top))',
          }}
        >
          <GameCountdownTimer totalMinutes={timeLimitMinutes} />
        </div>
      )}

      <GoalsSheet
        gameName={gameName}
        goals={goals}
        teams={teams}
        otherCompletions={otherCompletions}
        open={sheetOpen}
        panelView={panelView}
        selectedGoal={selectedGoal}
        completions={completions}
        pendingImageUrl={pendingImageUrl}
        pendingComment={pendingComment}
        onClose={() => setSheetOpen(false)}
        onSelectGoal={handleSelectGoal}
        onBack={handleBack}
        onCompleteGoal={() => setIsCompleting(true)}
        onRedo={handleRedo}
        onImageChange={handleImageChange}
        onCommentChange={setPendingComment}
        onSubmit={handleSubmit}
      />

      <FloatingGoalsButton visible={!sheetOpen} onClick={() => setSheetOpen(true)} />
    </div>
  )
}
