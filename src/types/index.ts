/**
 * Shared TypeScript types mirroring the Prisma schema.
 * These represent the API response shapes — keep in sync with the backend.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type GameStatus = 'LOBBY' | 'ACTIVE' | 'COMPLETE' | 'EXPIRED'
export type GameType = 'LIST' | 'BINGO' | 'LOCKOUT' | 'BLACKOUT'
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

// ─── Auth / User ──────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  username: string | null
  firstName: string | null
  lastName: string | null
  createdAt: string
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export interface GameConfig {
  id: number
  gameId: string
  gameType: GameType
  timeLimit: number | null
  goalsRequired: number
  teamCount: number
  minTeamSize: number | null
  maxTeamSize: number | null
}

export interface Team {
  id: number
  name: string
  color: string | null
  gameId: string
}

export interface GameParticipant {
  userId: number
  gameId: string
  teamId: number | null
  user: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>
}

export interface Game {
  id: string
  name: string
  status: GameStatus
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  config: GameConfig | null
  teams: Team[]
  participants: GameParticipant[]
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export interface Goal {
  id: number
  displayName: string
  description: string | null
  countable: boolean
  countLimit: number | null
}

export interface GameGoal {
  id: number
  gameId: string
  goalId: number
  goal: Goal
}

export interface GoalPhoto {
  id: number
  url: string
  mimeType: string | null
  sizeBytes: number | null
}

export interface CompletedGoal {
  id: number
  gameGoalId: number
  teamId: number
  completedAt: string
  completedLatitude: number | null
  completedLongitude: number | null
  verificationStatus: VerificationStatus
  photos: GoalPhoto[]
}
