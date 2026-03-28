/**
 * mock-server.js — in-memory mock API for cross-device prototype testing.
 *
 * Run alongside Vite in a separate terminal:
 *   npm run server
 *
 * Vite proxies /api/* → http://localhost:3001 (configured in vite.config.ts),
 * so your phone just hits the Vite URL — no extra config needed on the client.
 *
 * NOTE: Data is in-memory. Restarting this server clears all games.
 *
 * BACKEND DEV: Every route here maps 1:1 to the real API documented in mock.ts.
 * Replace this file with a proper Express + Prisma server and nothing in the
 * frontend needs to change.
 */

import express from 'express'
const app = express()
app.use(express.json())

// ─── In-memory store ──────────────────────────────────────────────────────────

const store = {
  games:        {},   // gameId → Game
  participants: {},   // gameId → Participant[]
  teams:        {},   // gameId → Team[]
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function smallestTeamId(gameId) {
  const teams = store.teams[gameId] ?? []
  const participants = store.participants[gameId] ?? []
  if (!teams.length) return undefined
  return teams
    .map(t => ({ id: t.id, count: participants.filter(p => p.teamId === t.id).length }))
    .sort((a, b) => a.count - b.count)[0].id
}

// ─── Games ────────────────────────────────────────────────────────────────────

// BACKEND DEV: POST /api/games
// body:    { name, ownerUsername, ownerId }
// returns: { game, participant }
// Real impl: generate ownerId server-side from session, not client-supplied.
app.post('/api/games', (req, res) => {
  const { name, ownerUsername, ownerId } = req.body
  if (!name?.trim() || !ownerUsername?.trim() || !ownerId) {
    return res.status(400).json({ message: 'name, ownerUsername, and ownerId are required.' })
  }

  const gameId = generateGameCode()
  const game = { id: gameId, name: name.trim(), status: 'LOBBY', ownerId, createdAt: new Date().toISOString() }
  const participant = { id: ownerId, username: ownerUsername.trim(), gameId }

  store.games[gameId] = game
  store.participants[gameId] = [participant]
  store.teams[gameId] = []

  console.log(`[game created] ${gameId} — "${game.name}" by ${ownerUsername}`)
  res.json({ game, participant })
})

// BACKEND DEV: GET /api/games/:gameId
// returns: { game, participants, teams }
app.get('/api/games/:gameId', (req, res) => {
  const game = store.games[req.params.gameId]
  if (!game) return res.status(404).json({ message: 'Game not found. Check the code and try again.' })

  res.json({
    game,
    participants: store.participants[game.id] ?? [],
    teams:        store.teams[game.id]        ?? [],
  })
})

// BACKEND DEV: POST /api/games/:gameId/join
// body:    { username, participantId }
// returns: { game, participant }
// Real impl: generate participantId server-side; validate username uniqueness per game.
app.post('/api/games/:gameId/join', (req, res) => {
  const { gameId } = req.params
  const { username, participantId } = req.body
  const game = store.games[gameId]

  if (!game) return res.status(404).json({ message: 'Game not found. Check the code and try again.' })
  if (game.status !== 'LOBBY') return res.status(409).json({ message: 'This game has already started.' })

  const teamId = smallestTeamId(gameId)
  const participant = { id: participantId, username: username.trim(), gameId, teamId }
  store.participants[gameId] = [...(store.participants[gameId] ?? []), participant]

  console.log(`[player joined] ${gameId} — ${username}${teamId ? ` → team ${teamId}` : ''}`)
  res.json({ game, participant })
})

// BACKEND DEV: PATCH /api/games/:gameId/start
// returns: { game }
// Real impl: validate caller is owner via session.
app.patch('/api/games/:gameId/start', (req, res) => {
  const game = store.games[req.params.gameId]
  if (!game) return res.status(404).json({ message: 'Game not found.' })
  game.status = 'ACTIVE'
  console.log(`[game started] ${req.params.gameId}`)
  res.json({ game })
})

// ─── Teams ────────────────────────────────────────────────────────────────────

// BACKEND DEV: POST /api/games/:gameId/teams
// body:    { teams: { name, color }[] }
// returns: { teams }
// Owner only. Round-robin assigns existing participants.
app.post('/api/games/:gameId/teams', (req, res) => {
  const { gameId } = req.params
  if (!store.games[gameId]) return res.status(404).json({ message: 'Game not found.' })

  const teams = req.body.teams.map(def => ({
    id: crypto.randomUUID(),
    name: def.name.trim(),
    color: def.color,
    gameId,
  }))

  let i = 0
  store.participants[gameId] = (store.participants[gameId] ?? []).map(p => ({
    ...p, teamId: teams[i++ % teams.length].id,
  }))
  store.teams[gameId] = teams

  console.log(`[teams created] ${gameId} — ${teams.map(t => t.name).join(', ')}`)
  res.json({ teams })
})

// BACKEND DEV: PATCH /api/games/:gameId/teams/:teamId
// body:    { name }
// returns: { team }
// Owner only.
app.patch('/api/games/:gameId/teams/:teamId', (req, res) => {
  const { gameId, teamId } = req.params
  const team = (store.teams[gameId] ?? []).find(t => t.id === teamId)
  if (!team) return res.status(404).json({ message: 'Team not found.' })
  team.name = req.body.name.trim()
  res.json({ team })
})

// BACKEND DEV: DELETE /api/games/:gameId/teams/:teamId
// returns: { teams, participants }
// Owner only. Displaced members redistributed round-robin.
app.delete('/api/games/:gameId/teams/:teamId', (req, res) => {
  const { gameId, teamId } = req.params
  const remaining = (store.teams[gameId] ?? []).filter(t => t.id !== teamId)
  if (!remaining.length) return res.status(400).json({ message: "Can't delete the only team." })

  let idx = 0
  store.participants[gameId] = (store.participants[gameId] ?? []).map(p => {
    if (p.teamId !== teamId) return p
    return { ...p, teamId: remaining[idx++ % remaining.length].id }
  })
  store.teams[gameId] = remaining

  res.json({ teams: remaining, participants: store.participants[gameId] })
})

// ─── Participants ─────────────────────────────────────────────────────────────

// BACKEND DEV: PATCH /api/games/:gameId/participants/:participantId/team
// body:    { teamId }
// returns: { participant }
// Any participant for themselves; owner for anyone.
app.patch('/api/games/:gameId/participants/:participantId/team', (req, res) => {
  const { gameId, participantId } = req.params
  const p = (store.participants[gameId] ?? []).find(p => p.id === participantId)
  if (!p) return res.status(404).json({ message: 'Participant not found.' })
  p.teamId = req.body.teamId
  res.json({ participant: p })
})

// BACKEND DEV: DELETE /api/games/:gameId/participants/:participantId
// returns: 204
// Owner removing someone, or participant removing themselves (leaveGame).
app.delete('/api/games/:gameId/participants/:participantId', (req, res) => {
  const { gameId, participantId } = req.params
  store.participants[gameId] = (store.participants[gameId] ?? []).filter(p => p.id !== participantId)
  console.log(`[player removed] ${gameId} — ${participantId}`)
  res.sendStatus(204)
})

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = 3001
app.listen(PORT, () => {
  console.log(`\nMock server → http://localhost:${PORT}`)
  console.log('Vite proxies /api/* here automatically.')
  console.log('Open your phone to the Vite network URL — no extra config needed.\n')
})
