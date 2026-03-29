/** Polyfill for crypto.randomUUID — not available in Safari < 15.4 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
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
  { id: 'sky',    label: 'Sky',    hex: '#468FED' },
  { id: 'orange', label: 'Orange', hex: '#FF6200' },
  { id: 'yellow', label: 'Yellow', hex: '#FFD000' },
  { id: 'green',  label: 'Green',  hex: '#C2E812' },
  { id: 'teal',   label: 'Teal',   hex: '#01F181' },
  { id: 'blue',   label: 'Blue',   hex: '#3b82f6' },
  { id: 'purple', label: 'Purple', hex: '#6320EE' },
  { id: 'pink',   label: 'Pink',   hex: '#DC0490' },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

/** Coerce API enum strings so strict checks like `status === 'LOBBY'` always work. */
export function normalizeGameStatus(status: unknown): MockGame['status'] {
  const t = String(status ?? '')
    .trim()
    .toUpperCase()
  if (t === 'LOBBY' || t === 'ACTIVE' || t === 'COMPLETE' || t === 'EXPIRED') return t
  return 'LOBBY'
}

export interface MockGame {
  id: string
  name: string
  status: 'LOBBY' | 'ACTIVE' | 'COMPLETE' | 'EXPIRED'
  ownerId: string
  createdAt: string
  /** Minutes; default 120 (2h); lobby configurable up to 1440 (24h). */
  timeLimitMinutes: number
  /** Number of goals for this game (e.g. to win). */
  goalsRequired: number
}

export interface MockTeam {
  id: string
  name: string
  color: string
  gameId: string
}

/** Reported by each client; visible to all players in the lobby (poll / GET game). */
export type ParticipantLocationPermission = 'granted' | 'denied' | 'unavailable' | 'pending'

export type ParticipantNotificationPermission =
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'pending'

export interface MockParticipant {
  id: string
  username: string
  gameId: string
  teamId?: string
  /** Last known browser location permission (self-reported). */
  locationPermission?: ParticipantLocationPermission
  /** Last known browser notification permission (self-reported). */
  notificationPermission?: ParticipantNotificationPermission
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

  const text = await res.text()
  if (text.length === 0) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return undefined as T
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    const htmlHint = text.trimStart().startsWith('<')
      ? ' The response was HTML (often the app shell or a proxy error). For local mock data, run `npm run server` in a second terminal so `/api` is served on port 3001; `npm run dev` proxies `/api` to it.'
      : ''
    throw new Error(`API did not return JSON.${htmlHint}`)
  }

  if (!res.ok) {
    const msg =
      typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return parsed as T
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
  const data = await api<{ game: MockGame; participants: MockParticipant[]; teams: MockTeam[] }>(
    `/api/games/${gameId}`,
  )
  return {
    ...data,
    game: { ...data.game, status: normalizeGameStatus(data.game.status) },
  }
}

/**
 * BACKEND DEV:
 *   PATCH /api/games/:gameId/start
 *   returns: { game }
 */
export async function startGame(gameId: string): Promise<{ game: MockGame }> {
  const data = await api<{ game: MockGame }>(`/api/games/${gameId}/start`, { method: 'PATCH' })
  return { game: { ...data.game, status: normalizeGameStatus(data.game.status) } }
}

/**
 * BACKEND DEV:
 *   PATCH /api/games/:gameId
 *   body:    { actorId, timeLimitMinutes?, goalsRequired? } — owner only, LOBBY only
 *   returns: { game }
 */
export async function updateGameSettings(
  gameId: string,
  payload: { actorId: string; timeLimitMinutes?: number; goalsRequired?: number },
): Promise<{ game: MockGame }> {
  const data = await api<{ game: MockGame }>(`/api/games/${gameId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return { game: { ...data.game, status: normalizeGameStatus(data.game.status) } }
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
 *   POST /api/games/:gameId/teams/add
 *   body:    { name, color, actorId } — owner only; appends one team without reassigning players.
 *   returns: { team }
 */
export async function addTeam(
  gameId: string,
  payload: { name: string; color: string; actorId: string },
): Promise<{ team: MockTeam }> {
  return api(`/api/games/${gameId}/teams/add`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * BACKEND DEV:
 *   PATCH /api/games/:gameId/teams/:teamId
 *   body:    { actorId, name?, color? }
 *   name:    game owner, or a member of that team
 *   color:   member of that team, or game owner (any team)
 *   returns: { team }
 */
export async function updateTeam(
  gameId: string,
  teamId: string,
  payload: { actorId: string; name?: string; color?: string },
): Promise<{ team: MockTeam }> {
  const body: { actorId: string; name?: string; color?: string } = {
    actorId: payload.actorId,
  }
  if (payload.name !== undefined) body.name = payload.name
  if (payload.color !== undefined) body.color = payload.color
  return api(`/api/games/${gameId}/teams/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
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
 *   PATCH /api/games/:gameId/participants/:participantId
 *   body:    { username }
 *   returns: { participant }
 */
export async function updateParticipantUsername(
  gameId: string,
  participantId: string,
  username: string,
): Promise<{ participant: MockParticipant }> {
  const data = await api<{ participant: MockParticipant }>(
    `/api/games/${gameId}/participants/${participantId}`,
    { method: 'PATCH', body: JSON.stringify({ username: username.trim() }) },
  )
  const me = getCurrentUser()
  if (me?.id === participantId) {
    setCurrentUser({ ...me, username: data.participant.username })
  }
  return data
}

/**
 * BACKEND DEV:
 *   PATCH /api/games/:gameId/participants/:participantId
 *   body:    { locationPermission?, notificationPermission? } (partial)
 *   returns: { participant }
 */
export async function updateParticipantPermissions(
  gameId: string,
  participantId: string,
  payload: {
    locationPermission?: ParticipantLocationPermission
    notificationPermission?: ParticipantNotificationPermission
  },
): Promise<{ participant: MockParticipant }> {
  return api<{ participant: MockParticipant }>(
    `/api/games/${gameId}/participants/${participantId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  )
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

/**
 * BACKEND DEV:
 *   DELETE /api/games/:gameId?actorId=… — owner only; deletes the game for all players.
 *   Uses query param because DELETE request bodies are not reliably delivered (proxies/clients).
 */
export async function endGameAsOwner(gameId: string, ownerId: string): Promise<void> {
  const qs = new URLSearchParams({ actorId: ownerId }).toString()
  await api(`/api/games/${encodeURIComponent(gameId)}?${qs}`, { method: 'DELETE' })
  clearCurrentUser()
}
