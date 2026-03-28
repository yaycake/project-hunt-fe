/** Polyfill for crypto.randomUUID — not available in Safari < 15.4 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return uuid()
  }
  // Fallback: RFC 4122 v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * Mock API client for prototype demo.
 *
 * Calls the local mock-server.js via /api/* (Vite proxies to localhost:3001).
 * All function signatures are identical to what the real api.ts will expose —
 * swap the import in each feature file when the backend is ready.
 *
 * User identity (id, username, gameId) is stored in sessionStorage so each
 * browser tab keeps its own identity while sharing the same server-side game state.
 *
 * BACKEND DEV: see mock-server.js for the matching route implementations.
 */

// ─── Colour palette (UI only — not stored server-side as a fixed list) ────────

export const TEAM_COLORS = [
  { id: 'red',    label: 'Red',    hex: '#ef4444' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308' },
  { id: 'green',  label: 'Green',  hex: '#22c55e' },
  { id: 'teal',   label: 'Teal',   hex: '#14b8a6' },
  { id: 'blue',   label: 'Blue',   hex: '#3b82f6' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'pink',   label: 'Pink',   hex: '#ec4899' },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MockGame {
  id: string
  name: string
  status: 'LOBBY' | 'ACTIVE' | 'COMPLETE' | 'EXPIRED'
  ownerId: string
  createdAt: string
}

export interface MockTeam {
  id: string
  name: string
  color: string
  gameId: string
}

export interface MockParticipant {
  id: string
  username: string
  gameId: string
  teamId?: string
}

export interface MockCurrentUser {
  id: string
  username: string
  gameId: string
}

// ─── Current user (sessionStorage — per-tab identity) ────────────────────────

const USER_KEY = 'ph_mock_user'

export function getCurrentUser(): MockCurrentUser | null {
  // BACKEND DEV: replace with GET /api/me (reads from session cookie)
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as MockCurrentUser) : null
  } catch { return null }
}

function setCurrentUser(user: MockCurrentUser): void {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearCurrentUser(): void {
  sessionStorage.removeItem(USER_KEY)
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 204) return undefined as T
  const body = await res.json()
  if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`)
  return body as T
}

// ─── Game API ─────────────────────────────────────────────────────────────────

/**
 * BACKEND DEV:
 *   POST /api/games
 *   body:    { name, ownerUsername, ownerId }
 *   returns: { game, participant }
 */
export async function createGame(
  name: string,
  username: string,
): Promise<{ game: MockGame; participant: MockParticipant }> {
  const ownerId = uuid()
  const data = await api<{ game: MockGame; participant: MockParticipant }>('/api/games', {
    method: 'POST',
    body: JSON.stringify({ name, ownerUsername: username, ownerId }),
  })
  setCurrentUser({ id: ownerId, username, gameId: data.game.id })
  return data
}

/**
 * BACKEND DEV:
 *   POST /api/games/:gameId/join
 *   body:    { username, participantId }
 *   returns: { game, participant }
 */
export async function joinGame(
  gameCode: string,
  username: string,
): Promise<{ game: MockGame; participant: MockParticipant }> {
  const participantId = uuid()
  const id = gameCode.trim().toUpperCase()
  const data = await api<{ game: MockGame; participant: MockParticipant }>(
    `/api/games/${id}/join`,
    { method: 'POST', body: JSON.stringify({ username, participantId }) },
  )
  setCurrentUser({ id: participantId, username, gameId: data.game.id })
  return data
}

/**
 * BACKEND DEV:
 *   GET /api/games/:gameId
 *   returns: { game, participants, teams }
 *   Replace useQuery refetchInterval with Socket.IO room events.
 */
export async function getGame(
  gameId: string,
): Promise<{ game: MockGame; participants: MockParticipant[]; teams: MockTeam[] }> {
  return api(`/api/games/${gameId}`)
}

/**
 * BACKEND DEV:
 *   PATCH /api/games/:gameId/start
 *   returns: { game }
 */
export async function startGame(gameId: string): Promise<{ game: MockGame }> {
  return api(`/api/games/${gameId}/start`, { method: 'PATCH' })
}

// ─── Team API ─────────────────────────────────────────────────────────────────

/**
 * BACKEND DEV:
 *   POST /api/games/:gameId/teams
 *   body:    { teams: { name, color }[] }
 *   returns: { teams }
 */
export async function createTeams(
  gameId: string,
  teamDefs: { name: string; color: string }[],
): Promise<{ teams: MockTeam[] }> {
  return api(`/api/games/${gameId}/teams`, {
    method: 'POST',
    body: JSON.stringify({ teams: teamDefs }),
  })
}

/**
 * BACKEND DEV:
 *   PATCH /api/games/:gameId/teams/:teamId
 *   body:    { name }
 *   returns: { team }
 */
export async function updateTeamName(
  gameId: string,
  teamId: string,
  name: string,
): Promise<{ team: MockTeam }> {
  return api(`/api/games/${gameId}/teams/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

/**
 * BACKEND DEV:
 *   DELETE /api/games/:gameId/teams/:teamId
 *   returns: { teams, participants }
 */
export async function deleteTeam(
  gameId: string,
  teamId: string,
): Promise<{ teams: MockTeam[]; participants: MockParticipant[] }> {
  return api(`/api/games/${gameId}/teams/${teamId}`, { method: 'DELETE' })
}

// ─── Participant API ──────────────────────────────────────────────────────────

/**
 * BACKEND DEV:
 *   PATCH /api/games/:gameId/participants/:participantId/team
 *   body:    { teamId }
 *   returns: { participant }
 */
export async function switchTeam(
  gameId: string,
  participantId: string,
  teamId: string,
): Promise<{ participant: MockParticipant }> {
  return api(`/api/games/${gameId}/participants/${participantId}/team`, {
    method: 'PATCH',
    body: JSON.stringify({ teamId }),
  })
}

/**
 * BACKEND DEV:
 *   DELETE /api/games/:gameId/participants/:participantId
 *   returns: 204
 *   Owner removing another player.
 */
export async function removePlayer(gameId: string, participantId: string): Promise<void> {
  return api(`/api/games/${gameId}/participants/${participantId}`, { method: 'DELETE' })
}

/**
 * BACKEND DEV:
 *   DELETE /api/games/:gameId/participants/:participantId
 *   returns: 204
 *   Player removing themselves. Clears local session after success.
 */
export async function leaveGame(gameId: string, participantId: string): Promise<void> {
  await api(`/api/games/${gameId}/participants/${participantId}`, { method: 'DELETE' })
  clearCurrentUser()
}
