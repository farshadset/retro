export type PlayerColor = 'white' | 'black'
export type RoomStatus = 'waiting' | 'active' | 'checkmate' | 'draw' | 'timeout'

export interface RoomPlayer {
  id: string
  name: string
  color: PlayerColor
}

export interface LastMove {
  from: string
  to: string
  san: string
}

export type ChatMessageType = 'text' | 'sticker'

export interface ChatMessage {
  id: string
  senderColor: PlayerColor
  senderName: string
  type: ChatMessageType
  value: string
  createdAt: number
}

export type RoomChatMessage = ChatMessage

export interface RoomSnapshot {
  roomId: string
  status: RoomStatus
  fen: string
  pgn: string
  turn: PlayerColor
  winner: PlayerColor | null
  drawReason: string | null
  lastMove: LastMove | null
  moves: string[]
  chatMessages: ChatMessage[]
  players: {
    white: RoomPlayer | null
    black: RoomPlayer | null
  }
  spectatorCount: number
  timeControlMs: number
  incrementMs: number
  whiteTimeMs: number
  blackTimeMs: number
  activeSince: number | null
  createdAt: number
  updatedAt: number
}

export interface PlayerSession {
  playerId: string
  color: PlayerColor | null
}

export interface RoomSession {
  token: string
  playerId: string
  color: PlayerColor | null
  name: string
}
