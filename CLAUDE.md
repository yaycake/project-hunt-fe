# Project Hunt — Claude Context

## Project Overview

**Project Hunt** is a gamified scavenger hunt progressive web app (PWA), designed **mobile-first**. Players join games, form teams, and race to complete a list of goals. Each goal completion is verified by:

1. **Geographic coordinates** — captured at the time of submission
2. **Photo proof** — submitted image with EXIF data extracted and validated

---

## Tech Stack (intended)

- **Frontend**: Progressive Web App (PWA), mobile-first
- **Backend**: Node.js (likely Express or similar)
- **Database**: PostgreSQL via **Prisma ORM**
- **Auth**: Session-based (connect-pg-simple style, `sessions` table)
- **File storage**: S3 / Cloudflare R2 / Cloudflare Images (photo uploads)
- **Real-time**: Socket.IO (transient `socketId` per `GameParticipant`)

---

## Core Concepts

### Game Lifecycle
```
LOBBY → ACTIVE → COMPLETE | EXPIRED
```
- Games are created with a password for joining
- Players join in the **LOBBY** phase, get assigned to teams
- Game moves to **ACTIVE** when started; ends when time runs out or all goals are met
- `GameStatus` enum: `LOBBY`, `ACTIVE`, `COMPLETE`, `EXPIRED`

### Game Configuration (`GameConfig`)
| Field | Description |
|---|---|
| `gameType` | `LIST`, `BINGO`, `LOCKOUT`, `BLACKOUT` |
| `timeLimit` | Minutes; `null` = no limit |
| `goalsRequired` | How many goals must be completed to win |
| `teamCount` | Number of teams |
| `minTeamSize` / `maxTeamSize` | Optional team size constraints |

### Goals
- Goals are **reusable** across games (created once, added to many games via `GameGoal`)
- `countable` goals have a `countLimit` (e.g., "find 5 red cars")
- Each goal has a `displayName` and optional `description`

### Goal Completion Flow
1. A team submits a goal completion with lat/lng coordinates
2. One or more photos are uploaded as proof (`GoalPhoto`)
3. `VerificationStatus` starts as `PENDING`, moves to `APPROVED` or `REJECTED`
4. A team can only complete a given goal once (`@@unique([gameGoalId, teamId])`)

---

## Database Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Users & sessions
model User {
  id           Int               @id @default(autoincrement())
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  email        String            @unique
  username     String?           @unique @db.VarChar(36)
  firstName    String?           @db.VarChar(80)
  lastName     String?           @db.VarChar(80)
  gamesCreated Game[]
  participants GameParticipant[]
  goalsCreated Goal[]
  @@map("users")
}

model Session {
  sid    String   @id @unique
  sess   Json
  expire DateTime
  @@map("sessions")
}

// Goals (objectives)
model Goal {
  id          Int        @id @default(autoincrement())
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  displayName String     @db.VarChar(240)
  description String?    @db.VarChar(480)
  countable   Boolean    @default(false)
  countLimit  Int?
  creatorId   Int
  creator     User       @relation(fields: [creatorId], references: [id])
  gameGoals   GameGoal[]
  @@map("goals")
}

// Games
model Game {
  id           String            @id @default(uuid())
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  name         String
  password     String
  status       GameStatus        @default(LOBBY)
  startedAt    DateTime?
  endedAt      DateTime?
  createdById  Int
  createdBy    User              @relation(fields: [createdById], references: [id])
  config       GameConfig?
  teams        Team[]
  participants GameParticipant[]
  gameGoals    GameGoal[]
  @@map("games")
}

model GameConfig {
  id            Int      @id @default(autoincrement())
  gameId        String   @unique
  game          Game     @relation(fields: [gameId], references: [id])
  gameType      GameType @default(LIST)
  timeLimit     Int?     // minutes; null = no limit
  goalsRequired Int      @default(5)
  teamCount     Int      @default(2)
  minTeamSize   Int?
  maxTeamSize   Int?
  @@map("game_configs")
}

model Team {
  id             Int               @id @default(autoincrement())
  createdAt      DateTime          @default(now())
  gameId         String
  name           String
  color          String?
  game           Game              @relation(fields: [gameId], references: [id])
  participants   GameParticipant[]
  completedGoals CompletedGoal[]
  @@map("teams")
}

model GameParticipant {
  userId   Int
  gameId   String
  teamId   Int?     // null until assigned in lobby
  socketId String?  // transient — rebuilt on reconnect
  user     User     @relation(fields: [userId], references: [id])
  game     Game     @relation(fields: [gameId], references: [id])
  team     Team?    @relation(fields: [teamId], references: [id])
  @@id([userId, gameId], name: "gameParticipantId")
  @@index([socketId])
  @@map("game_participants")
}

// Game goals + completion tracking
model GameGoal {
  id             Int             @id @default(autoincrement())
  gameId         String
  goalId         Int
  game           Game            @relation(fields: [gameId], references: [id])
  goal           Goal            @relation(fields: [goalId], references: [id])
  completedGoals CompletedGoal[]
  @@unique([gameId, goalId])
  @@map("game_goals")
}

model CompletedGoal {
  id                 Int                @id @default(autoincrement())
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  gameGoalId         Int
  teamId             Int
  completedAt        DateTime           @default(now())
  completedLatitude  Float?
  completedLongitude Float?
  verificationStatus VerificationStatus @default(PENDING)
  gameGoal           GameGoal           @relation(fields: [gameGoalId], references: [id])
  team               Team               @relation(fields: [teamId], references: [id])
  photos             GoalPhoto[]
  @@unique([gameGoalId, teamId])
  @@map("completed_goals")
}

model GoalPhoto {
  id              Int           @id @default(autoincrement())
  createdAt       DateTime      @default(now())
  completedGoalId Int
  url             String
  key             String
  mimeType        String?       @db.VarChar(64)
  sizeBytes       Int?
  completedGoal   CompletedGoal @relation(fields: [completedGoalId], references: [id])
  @@map("goal_photos")
}

// Enums
enum GameStatus {
  LOBBY
  ACTIVE
  COMPLETE
  EXPIRED
}

enum GameType {
  LIST
  BINGO
  LOCKOUT
  BLACKOUT
}

enum VerificationStatus {
  PENDING
  APPROVED
  REJECTED
}
```

---

## Key Design Notes

- **Game ID** is a UUID string (not integer) — useful for shareable join links
- **GameParticipant** uses a composite PK `[userId, gameId]`; `teamId` is null until lobby assignment
- **socketId** is transient — always rebuilt on reconnect, not persisted permanently
- **Goals are global** — not scoped to a game until linked via `GameGoal`
- **Photos** live in external object storage; only the URL + key are stored in DB
- **Verification** is manual (`PENDING → APPROVED/REJECTED`) — could be automated via EXIF/geo check
- Game password is stored on the `Game` model — used for joining

---

## Naming Conventions

- DB tables: snake_case (`game_participants`, `completed_goals`)
- Prisma models: PascalCase
- All `createdAt` / `updatedAt` fields use Prisma's `@default(now())` / `@updatedAt`
