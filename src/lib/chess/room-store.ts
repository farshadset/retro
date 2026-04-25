import { Chess, Move } from 'chess.js'
import { randomUUID } from 'crypto'
import { LastMove, PlayerColor, RoomPlayer, RoomSnapshot, RoomStatus } from './types'
import { assertChessRuntimeSafety, getChessRuntimeConfig } from './runtime-config'

type EventType = 'snapshot' | 'move' | 'room-created' | 'player-joined' | 'resigned' | 'game-over'

interface RoomEvent {
  id: number
  type: EventType
  roomId: string
  at: number
  snapshot: RoomSnapshot
}

interface SessionRecord {
  token: string
  playerId: string
  color: PlayerColor | null
  name: string
}

interface RoomState {
  id: string
  status: RoomStatus
  chess: Chess
  players: {
    white: RoomPlayer | null
    black: RoomPlayer | null
  }
  sessionsByToken: Map<string, SessionRecord>
  subscribers: Set<(event: RoomEvent) => void>
  sequence: number
  lastMove: LastMove | null
  winner: PlayerColor | null
  drawReason: string | null
  timeControlMs: number
  incrementMs: number
  whiteTimeMs: number
  blackTimeMs: number
  activeSince: number | null
  createdAt: number
  updatedAt: number
}

const ROOM_ID_LENGTH = 6
const runtimeConfig = getChessRuntimeConfig()
const MAX_ROOMS = runtimeConfig.roomStoreMaxRooms
const ROOM_TTL_MS = runtimeConfig.roomStoreTtlMs

class ChessApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function randomRoomId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let output = ''
  for (let i = 0; i < ROOM_ID_LENGTH; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length)
    output += alphabet[idx]
  }
  return output
}

function normalizeColor(turn: 'w' | 'b'): PlayerColor {
  return turn === 'w' ? 'white' : 'black'
}

function describeDraw(chess: Chess): string {
  if (chess.isStalemate()) return 'Stalemate'
  if (chess.isThreefoldRepetition()) return 'Threefold repetition'
  if (chess.isInsufficientMaterial()) return 'Insufficient material'
  if (chess.isDrawByFiftyMoves()) return 'Fifty-move rule'
  return 'Draw'
}

function clampMs(ms: number): number {
  return Math.max(0, Math.floor(ms))
}

export class RoomStore {
  private rooms = new Map<string, RoomState>()

  private findWaitingRoom(input: {
    timeControlMs: number
    incrementMs: number
    matchAnyTimeControl: boolean
  }): RoomState | null {
    const waitingRooms = Array.from(this.rooms.values())
      .filter((room) => {
        if (room.status !== 'waiting' || room.players.black) {
          return false
        }
        if (input.matchAnyTimeControl) {
          return true
        }
        return room.timeControlMs === input.timeControlMs && room.incrementMs === input.incrementMs
      })
      .sort((left, right) => left.createdAt - right.createdAt)

    return waitingRooms[0] ?? null
  }

  private cleanupExpiredRooms(): void {
    const now = Date.now()
    this.rooms.forEach((room, roomId) => {
      const isExpired = now - room.updatedAt > ROOM_TTL_MS
      if (isExpired && room.subscribers.size === 0) {
        this.rooms.delete(roomId)
      }
    })
    if (this.rooms.size <= MAX_ROOMS) return
    const sortedByAge = Array.from(this.rooms.values()).sort((a, b) => a.updatedAt - b.updatedAt)
    sortedByAge.forEach((room) => {
      if (this.rooms.size <= MAX_ROOMS) return
      if (room.subscribers.size === 0) {
        this.rooms.delete(room.id)
      }
    })
  }

  private getRoomOrThrow(roomId: string): RoomState {
    const normalizedRoomId = roomId.trim().toUpperCase()
    const room = this.rooms.get(normalizedRoomId)
    if (!room) {
      throw new ChessApiError(404, 'ROOM_NOT_FOUND', 'Room not found.')
    }
    return room
  }

  private applyTurnClock(room: RoomState, now: number): boolean {
    if (room.status !== 'active' || room.activeSince === null) return false
    const elapsed = now - room.activeSince
    if (elapsed <= 0) return false

    const currentTurn = normalizeColor(room.chess.turn())
    if (currentTurn === 'white') {
      room.whiteTimeMs = clampMs(room.whiteTimeMs - elapsed)
      if (room.whiteTimeMs <= 0) {
        room.whiteTimeMs = 0
        room.status = 'timeout'
        room.winner = 'black'
        room.drawReason = null
        room.activeSince = null
        return true
      }
    } else {
      room.blackTimeMs = clampMs(room.blackTimeMs - elapsed)
      if (room.blackTimeMs <= 0) {
        room.blackTimeMs = 0
        room.status = 'timeout'
        room.winner = 'white'
        room.drawReason = null
        room.activeSince = null
        return true
      }
    }
    return false
  }

  private snapshotFor(room: RoomState): RoomSnapshot {
    return {
      roomId: room.id,
      status: room.status,
      fen: room.chess.fen(),
      pgn: room.chess.pgn(),
      turn: normalizeColor(room.chess.turn()),
      winner: room.winner,
      drawReason: room.drawReason,
      lastMove: room.lastMove,
      moves: room.chess.history(),
      players: {
        white: room.players.white,
        black: room.players.black,
      },
      spectatorCount: Array.from(room.sessionsByToken.values()).filter((session) => session.color === null).length,
      timeControlMs: room.timeControlMs,
      incrementMs: room.incrementMs,
      whiteTimeMs: room.whiteTimeMs,
      blackTimeMs: room.blackTimeMs,
      activeSince: room.activeSince,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    }
  }

  private emit(room: RoomState, type: EventType): RoomSnapshot {
    const snapshot = this.snapshotFor(room)
    const event: RoomEvent = {
      id: room.sequence,
      type,
      roomId: room.id,
      at: Date.now(),
      snapshot,
    }
    room.sequence += 1
    room.subscribers.forEach((listener) => {
      listener(event)
    })
    return snapshot
  }

  private ensurePlayerToken(room: RoomState, token: string): SessionRecord {
    const session = room.sessionsByToken.get(token)
    if (!session) {
      throw new ChessApiError(401, 'INVALID_TOKEN', 'Invalid player session token.')
    }
    return session
  }

  createRoom(input: { name: string; timeControlMs: number; incrementMs: number }): {
    snapshot: RoomSnapshot
    session: SessionRecord
  } {
    const name = input.name.trim()
    if (name.length < 2) {
      throw new ChessApiError(400, 'INVALID_NAME', 'Player name must be at least 2 characters.')
    }
    const now = Date.now()
    const roomId = (() => {
      let candidate = randomRoomId()
      while (this.rooms.has(candidate)) {
        candidate = randomRoomId()
      }
      return candidate
    })()

    const playerId = randomUUID()
    const token = randomUUID()
    const whitePlayer: RoomPlayer = { id: playerId, name, color: 'white' }
    const room: RoomState = {
      id: roomId,
      status: 'waiting',
      chess: new Chess(),
      players: {
        white: whitePlayer,
        black: null,
      },
      sessionsByToken: new Map([
        [
          token,
          {
            token,
            playerId,
            color: 'white',
            name,
          },
        ],
      ]),
      subscribers: new Set(),
      sequence: 1,
      lastMove: null,
      winner: null,
      drawReason: null,
      timeControlMs: input.timeControlMs,
      incrementMs: input.incrementMs,
      whiteTimeMs: input.timeControlMs,
      blackTimeMs: input.timeControlMs,
      activeSince: null,
      createdAt: now,
      updatedAt: now,
    }

    this.rooms.set(room.id, room)
    this.cleanupExpiredRooms()
    const snapshot = this.emit(room, 'room-created')
    return { snapshot, session: room.sessionsByToken.get(token)! }
  }

  quickMatch(input: {
    name: string
    timeControlMs: number
    incrementMs: number
    matchAnyTimeControl: boolean
  }): {
    snapshot: RoomSnapshot
    session: SessionRecord
    matchedRoom: boolean
  } {
    const name = input.name.trim()
    if (name.length < 2) {
      throw new ChessApiError(400, 'INVALID_NAME', 'Player name must be at least 2 characters.')
    }

    this.cleanupExpiredRooms()
    const waitingRoom = this.findWaitingRoom({
      timeControlMs: input.timeControlMs,
      incrementMs: input.incrementMs,
      matchAnyTimeControl: input.matchAnyTimeControl,
    })

    if (!waitingRoom) {
      const created = this.createRoom({
        name,
        timeControlMs: input.timeControlMs,
        incrementMs: input.incrementMs,
      })
      return {
        ...created,
        matchedRoom: false,
      }
    }

    const now = Date.now()
    const token = randomUUID()
    const playerId = randomUUID()
    const color: PlayerColor = 'black'
    waitingRoom.players.black = { id: playerId, name, color }
    waitingRoom.status = 'active'
    waitingRoom.activeSince = now

    const session: SessionRecord = {
      token,
      playerId,
      color,
      name,
    }
    waitingRoom.sessionsByToken.set(token, session)
    waitingRoom.updatedAt = now

    const snapshot = this.emit(waitingRoom, 'player-joined')
    return {
      snapshot,
      session,
      matchedRoom: true,
    }
  }

  joinRoom(input: { roomId: string; name: string }): {
    snapshot: RoomSnapshot
    session: SessionRecord
  } {
    const room = this.getRoomOrThrow(input.roomId)
    const name = input.name.trim()
    if (name.length < 2) {
      throw new ChessApiError(400, 'INVALID_NAME', 'Player name must be at least 2 characters.')
    }
    const now = Date.now()
    const token = randomUUID()
    const playerId = randomUUID()
    let color: PlayerColor | null = null

    if (!room.players.black) {
      color = 'black'
      room.players.black = { id: playerId, name, color }
      if (room.status === 'waiting') {
        room.status = 'active'
        room.activeSince = now
      }
    }

    const session: SessionRecord = {
      token,
      playerId,
      color,
      name,
    }
    room.sessionsByToken.set(token, session)
    room.updatedAt = now
    const snapshot = this.emit(room, 'player-joined')
    return { snapshot, session }
  }

  getRoomSnapshot(roomId: string): RoomSnapshot {
    const room = this.getRoomOrThrow(roomId)
    this.evaluateClock(room.id)
    return this.snapshotFor(room)
  }

  evaluateClock(roomId: string): RoomSnapshot {
    const room = this.getRoomOrThrow(roomId)
    if (room.status !== 'active') {
      return this.snapshotFor(room)
    }

    const now = Date.now()
    const timedOut = this.applyTurnClock(room, now)
    room.updatedAt = now

    if (timedOut) {
      return this.emit(room, 'game-over')
    }

    return this.snapshotFor(room)
  }

  getSession(roomId: string, token: string | null): SessionRecord | null {
    if (!token) return null
    const room = this.getRoomOrThrow(roomId)
    return room.sessionsByToken.get(token) ?? null
  }

  makeMove(input: {
    roomId: string
    token: string
    from: string
    to: string
    promotion?: 'q' | 'r' | 'b' | 'n'
  }): RoomSnapshot {
    const room = this.getRoomOrThrow(input.roomId)
    const session = this.ensurePlayerToken(room, input.token)
    if (session.color === null) {
      throw new ChessApiError(403, 'SPECTATOR_FORBIDDEN', 'Spectators cannot make moves.')
    }
    if (room.status !== 'active') {
      throw new ChessApiError(409, 'GAME_NOT_ACTIVE', 'Game is not active.')
    }

    const clockSnapshot = this.evaluateClock(room.id)
    if (clockSnapshot.status === 'timeout') {
      throw new ChessApiError(409, 'TIMEOUT', 'Current player lost on time.')
    }

    const turn = normalizeColor(room.chess.turn())
    if (turn !== session.color) {
      throw new ChessApiError(403, 'NOT_YOUR_TURN', 'It is not your turn.')
    }

    let move: Move
    try {
      const nextMove = room.chess.move({
        from: input.from,
        to: input.to,
        promotion: input.promotion,
      })
      if (!nextMove) {
        throw new ChessApiError(400, 'INVALID_MOVE', 'Illegal move.')
      }
      move = nextMove
    } catch {
      throw new ChessApiError(400, 'INVALID_MOVE', 'Illegal move.')
    }

    room.lastMove = { from: move.from, to: move.to, san: move.san }
    if (session.color === 'white') {
      room.whiteTimeMs = clampMs(room.whiteTimeMs + room.incrementMs)
    } else {
      room.blackTimeMs = clampMs(room.blackTimeMs + room.incrementMs)
    }

    if (room.chess.isCheckmate()) {
      room.status = 'checkmate'
      room.winner = session.color
      room.drawReason = null
      room.activeSince = null
      room.updatedAt = Date.now()
      return this.emit(room, 'game-over')
    }

    if (room.chess.isDraw()) {
      room.status = 'draw'
      room.winner = null
      room.drawReason = describeDraw(room.chess)
      room.activeSince = null
      room.updatedAt = Date.now()
      return this.emit(room, 'game-over')
    }

    room.status = 'active'
    room.winner = null
    room.drawReason = null
    room.activeSince = Date.now()
    room.updatedAt = room.activeSince
    return this.emit(room, 'move')
  }

  resign(input: { roomId: string; token: string }): RoomSnapshot {
    const room = this.getRoomOrThrow(input.roomId)
    const session = this.ensurePlayerToken(room, input.token)
    if (!session.color) {
      throw new ChessApiError(403, 'SPECTATOR_FORBIDDEN', 'Spectators cannot resign.')
    }
    if (room.status !== 'active' && room.status !== 'waiting') {
      throw new ChessApiError(409, 'GAME_FINISHED', 'Game is already finished.')
    }

    room.status = 'checkmate'
    room.winner = session.color === 'white' ? 'black' : 'white'
    room.drawReason = `${session.name} resigned`
    room.activeSince = null
    room.updatedAt = Date.now()
    return this.emit(room, 'resigned')
  }

  subscribe(roomId: string, listener: (event: RoomEvent) => void): () => void {
    const room = this.getRoomOrThrow(roomId)
    room.subscribers.add(listener)
    return () => {
      room.subscribers.delete(listener)
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __chessRoomStore: RoomStore | undefined
}

export function getRoomStore(): RoomStore {
  if (!global.__chessRoomStore) {
    assertChessRuntimeSafety()
    global.__chessRoomStore = new RoomStore()
  }
  return global.__chessRoomStore
}

export { ChessApiError }

export function describeStoreMode(): { storeMode: 'memory' | 'redis'; singleInstanceOnly: boolean } {
  return {
    storeMode: runtimeConfig.storeMode,
    singleInstanceOnly: runtimeConfig.storeMode === 'memory',
  }
}
