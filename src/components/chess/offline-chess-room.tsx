'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, Square } from 'chess.js'
import { ChessBoard } from './chess-board'
import { MoveList } from './move-list'
import { PlayerPanel } from './player-panel'
import { PlayerColor, RoomSnapshot } from '@/lib/chess/types'

const OFFLINE_ROOM_ID = 'OFFBOT'
const OFFLINE_BOT_LEVEL_STORAGE_KEY = 'offline-chess-bot-level'
type PromotionPiece = 'q' | 'r' | 'b' | 'n'
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

interface BotLevel {
  id: string
  label: string
  rating: number
  thinkTimeMs: number
  randomDelayMs: number
  blunderChance: number
  randomNoise: number
}

interface PendingPromotion {
  from: Square
  to: Square
  color: 'w' | 'b'
  options: PromotionPiece[]
}

const BOT_LEVELS: BotLevel[] = [
  {
    id: 'beginner',
    label: 'مبتدی',
    rating: 400,
    thinkTimeMs: 280,
    randomDelayMs: 180,
    blunderChance: 0.38,
    randomNoise: 260,
  },
  {
    id: 'easy',
    label: 'آسان',
    rating: 800,
    thinkTimeMs: 340,
    randomDelayMs: 200,
    blunderChance: 0.24,
    randomNoise: 160,
  },
  {
    id: 'medium',
    label: 'متوسط',
    rating: 1200,
    thinkTimeMs: 460,
    randomDelayMs: 220,
    blunderChance: 0.12,
    randomNoise: 90,
  },
  {
    id: 'hard',
    label: 'سخت',
    rating: 1600,
    thinkTimeMs: 580,
    randomDelayMs: 240,
    blunderChance: 0.05,
    randomNoise: 40,
  },
  {
    id: 'expert',
    label: 'استاد',
    rating: 2000,
    thinkTimeMs: 740,
    randomDelayMs: 280,
    blunderChance: 0.02,
    randomNoise: 18,
  },
]

const DEFAULT_BOT_LEVEL_ID = BOT_LEVELS[2].id
const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

const PROMOTION_ICON_BY_COLOR: Record<'w' | 'b', Record<PromotionPiece, string>> = {
  w: {
    q: '/chess/pieces/cburnett/wQ.svg',
    r: '/chess/pieces/cburnett/wR.svg',
    b: '/chess/pieces/cburnett/wB.svg',
    n: '/chess/pieces/cburnett/wN.svg',
  },
  b: {
    q: '/chess/pieces/cburnett/bQ.svg',
    r: '/chess/pieces/cburnett/bR.svg',
    b: '/chess/pieces/cburnett/bB.svg',
    n: '/chess/pieces/cburnett/bN.svg',
  },
}

function evaluateMaterial(chess: Chess): number {
  let score = 0
  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (!piece) continue
      const pieceValue = PIECE_VALUES[piece.type as PieceType] ?? 0
      score += piece.color === 'b' ? pieceValue : -pieceValue
    }
  }
  return score
}

function centerBonus(square: string): number {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0)
  const rank = Number(square[1]) - 1
  const distanceFromCenter = Math.abs(file - 3.5) + Math.abs(rank - 3.5)
  return Math.round((4 - distanceFromCenter) * 8)
}

function scoreMove(chess: Chess, move: ReturnType<Chess['moves']>[number], level: BotLevel): number {
  const candidate = new Chess(chess.fen())
  const result = candidate.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  })
  if (!result) {
    return Number.NEGATIVE_INFINITY
  }

  if (candidate.isCheckmate()) {
    return 100000
  }

  let score = evaluateMaterial(candidate)
  score += centerBonus(result.to)
  if (candidate.isCheck()) {
    score += 35
  }
  if (result.captured) {
    score += PIECE_VALUES[result.captured as PieceType] ?? 0
  }
  if (result.promotion) {
    score += 80
  }

  // Lower levels make less consistent choices.
  score += (Math.random() * 2 - 1) * level.randomNoise
  return score
}

function chooseBotMove(chess: Chess, level: BotLevel) {
  const legalMoves = chess.moves({ verbose: true })
  if (legalMoves.length === 0) {
    return null
  }

  if (Math.random() < level.blunderChance) {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)]
  }

  let bestMove = legalMoves[0]
  let bestScore = Number.NEGATIVE_INFINITY
  for (const legalMove of legalMoves) {
    const score = scoreMove(chess, legalMove, level)
    if (score > bestScore) {
      bestScore = score
      bestMove = legalMove
    }
  }
  return bestMove
}

function describeDraw(chess: Chess): string {
  if (chess.isStalemate()) return 'Stalemate'
  if (chess.isThreefoldRepetition()) return 'Threefold repetition'
  if (chess.isInsufficientMaterial()) return 'Insufficient material'
  if (chess.isDrawByFiftyMoves()) return 'Fifty-move rule'
  return 'Draw'
}

function formatSnapshot(chess: Chess, lastMove: RoomSnapshot['lastMove'], moves: string[]): RoomSnapshot {
  const now = Date.now()
  let status: RoomSnapshot['status'] = 'active'
  let winner: RoomSnapshot['winner'] = null
  let drawReason: string | null = null

  if (chess.isCheckmate()) {
    status = 'checkmate'
    winner = chess.turn() === 'w' ? 'black' : 'white'
  } else if (chess.isDraw()) {
    status = 'draw'
    drawReason = describeDraw(chess)
  }

  return {
    roomId: OFFLINE_ROOM_ID,
    status,
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn() === 'w' ? 'white' : 'black',
    winner,
    drawReason,
    lastMove,
    moves,
    players: {
      white: { id: 'player-local', name: 'You', color: 'white' },
      black: { id: 'player-bot', name: 'Robot', color: 'black' },
    },
    spectatorCount: 0,
    timeControlMs: 0,
    incrementMs: 0,
    whiteTimeMs: 0,
    blackTimeMs: 0,
    activeSince: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function OfflineChessRoom() {
  const botTimerRef = useRef<number | null>(null)
  const [selectedBotLevelId, setSelectedBotLevelId] = useState(DEFAULT_BOT_LEVEL_ID)
  const [snapshot, setSnapshot] = useState<RoomSnapshot>(() => {
    const chess = new Chess()
    return formatSnapshot(chess, null, [])
  })
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [moveTargets, setMoveTargets] = useState<Square[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)

  const chessState = useMemo(() => new Chess(snapshot.fen), [snapshot.fen])
  const selectedBotLevel =
    BOT_LEVELS.find((level) => level.id === selectedBotLevelId) ?? BOT_LEVELS.find((level) => level.id === DEFAULT_BOT_LEVEL_ID) ?? BOT_LEVELS[0]
  const isGameActive = snapshot.status === 'active'
  const isPlayerTurn = isGameActive && snapshot.turn === 'white'

  const clearSelection = () => {
    setSelectedSquare(null)
    setMoveTargets([])
  }

  const applyBotMove = (chessAfterPlayer: Chess, baseMoves: string[]) => {
    if (chessAfterPlayer.isGameOver()) {
      const latestMoveSan = baseMoves[baseMoves.length - 1] ?? ''
      setSnapshot(
        formatSnapshot(
          chessAfterPlayer,
          snapshot.lastMove && snapshot.lastMove.san === latestMoveSan ? snapshot.lastMove : null,
          baseMoves
        )
      )
      return
    }

    setIsBotThinking(true)
    const delayMs = selectedBotLevel.thinkTimeMs + Math.floor(Math.random() * selectedBotLevel.randomDelayMs)
    botTimerRef.current = window.setTimeout(() => {
      const botMove = chooseBotMove(chessAfterPlayer, selectedBotLevel)
      if (!botMove) {
        setSnapshot(formatSnapshot(chessAfterPlayer, null, baseMoves))
        setIsBotThinking(false)
        botTimerRef.current = null
        return
      }
      const result = chessAfterPlayer.move({ from: botMove.from, to: botMove.to, promotion: botMove.promotion })
      if (!result) {
        setIsBotThinking(false)
        botTimerRef.current = null
        return
      }
      const nextMoves = [...baseMoves, result.san]
      setSnapshot(
        formatSnapshot(chessAfterPlayer, { from: result.from, to: result.to, san: result.san }, nextMoves)
      )
      setIsBotThinking(false)
      botTimerRef.current = null
    }, delayMs)
  }

  const handleSquareClick = (square: Square) => {
    if (!isPlayerTurn || isBotThinking || pendingPromotion) return

    if (!selectedSquare) {
      const piece = chessState.get(square)
      if (!piece || piece.color !== 'w') return
      setSelectedSquare(square)
      setMoveTargets(chessState.moves({ square, verbose: true }).map((move) => move.to as Square))
      return
    }

    if (square === selectedSquare) {
      clearSelection()
      return
    }

    if (!moveTargets.includes(square)) {
      const piece = chessState.get(square)
      if (piece && piece.color === 'w') {
        setSelectedSquare(square)
        setMoveTargets(chessState.moves({ square, verbose: true }).map((move) => move.to as Square))
      } else {
        clearSelection()
      }
      return
    }

    const legalMoves = chessState
      .moves({ square: selectedSquare, verbose: true })
      .filter((move) => move.to === square)
    const promotionOptions = legalMoves
      .map((move) => move.promotion as PromotionPiece | undefined)
      .filter((promotion): promotion is PromotionPiece => Boolean(promotion))
    const uniquePromotionOptions = Array.from(new Set(promotionOptions))
    if (uniquePromotionOptions.length > 0) {
      setPendingPromotion({
        from: selectedSquare,
        to: square,
        color: chessState.turn(),
        options: uniquePromotionOptions,
      })
      return
    }
    const moveResult = chessState.move({ from: selectedSquare, to: square })
    if (!moveResult) {
      setError('Move failed.')
      clearSelection()
      return
    }

    const nextMoves = [...snapshot.moves, moveResult.san]
    const nextSnapshot = formatSnapshot(chessState, { from: moveResult.from, to: moveResult.to, san: moveResult.san }, nextMoves)
    setSnapshot(nextSnapshot)
    setError(null)
    clearSelection()

    if (nextSnapshot.status === 'active') {
      applyBotMove(chessState, nextMoves)
    }
  }

  const handlePromotionChoice = (promotion: PromotionPiece) => {
    if (!pendingPromotion || isBotThinking) return
    const moveResult = chessState.move({
      from: pendingPromotion.from,
      to: pendingPromotion.to,
      promotion,
    })
    if (!moveResult) {
      setError('Promotion move failed.')
      setPendingPromotion(null)
      clearSelection()
      return
    }
    const nextMoves = [...snapshot.moves, moveResult.san]
    const nextSnapshot = formatSnapshot(
      chessState,
      { from: moveResult.from, to: moveResult.to, san: moveResult.san },
      nextMoves
    )
    setSnapshot(nextSnapshot)
    setError(null)
    setPendingPromotion(null)
    clearSelection()
    if (nextSnapshot.status === 'active') {
      applyBotMove(chessState, nextMoves)
    }
  }

  const resetGame = () => {
    if (botTimerRef.current) {
      window.clearTimeout(botTimerRef.current)
      botTimerRef.current = null
    }
    const chess = new Chess()
    setSnapshot(formatSnapshot(chess, null, []))
    setError(null)
    clearSelection()
    setPendingPromotion(null)
    setIsBotThinking(false)
  }

  useEffect(() => {
    const savedLevelId = localStorage.getItem(OFFLINE_BOT_LEVEL_STORAGE_KEY)?.trim() ?? ''
    if (!savedLevelId) {
      return
    }
    const exists = BOT_LEVELS.some((level) => level.id === savedLevelId)
    if (exists) {
      setSelectedBotLevelId(savedLevelId)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(OFFLINE_BOT_LEVEL_STORAGE_KEY, selectedBotLevelId)
  }, [selectedBotLevelId])

  useEffect(() => {
    return () => {
      if (botTimerRef.current) {
        window.clearTimeout(botTimerRef.current)
        botTimerRef.current = null
      }
    }
  }, [])

  return (
    <main className="min-h-screen bg-[#1f1d1b] px-2 py-5 text-slate-100 sm:px-5 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-md border border-[#3a3734] bg-[#262421] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-[#9f9a93]">Offline vs Robot</p>
            <p className="text-xs text-[#bfb9b1]" data-testid="offline-bot-rating-label">
              سطح بات: {selectedBotLevel.label} • ریتینگ {selectedBotLevel.rating}
            </p>
            <h2 className="text-xl font-black tracking-tight text-[#f3efe8] sm:text-2xl" data-testid="offline-status-label">
              {snapshot.status === 'active'
                ? isBotThinking
                  ? 'Robot is thinking...'
                  : snapshot.turn === 'white'
                    ? 'Your turn'
                    : 'Robot turn'
                : snapshot.status === 'checkmate'
                  ? `${snapshot.winner === 'white' ? 'You' : 'Robot'} won by checkmate`
                  : snapshot.drawReason ?? 'Draw'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-md border border-[#57524c] bg-[#34312e] px-2 py-1.5 text-xs text-[#d9d5cf]">
              <span>سطح</span>
              <select
                value={selectedBotLevelId}
                onChange={(event) => setSelectedBotLevelId(event.target.value)}
                data-testid="offline-bot-level-select"
                className="rounded border border-[#6e6862] bg-[#262421] px-2 py-1 text-xs text-[#f3efe8] outline-none"
              >
                {BOT_LEVELS.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.label} ({level.rating})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={resetGame}
              data-testid="offline-reset-btn"
              className="rounded-md border border-[#57524c] bg-[#34312e] px-3 py-2 text-xs font-semibold text-[#e6e2da] transition hover:bg-[#3f3b38]"
            >
              New game
            </button>
          </div>
        </header>

        {error ? <p className="rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p> : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col items-center gap-4">
            <PlayerPanel snapshot={snapshot} perspective={'white' as PlayerColor} />
            <ChessBoard
              fen={snapshot.fen}
              lastMove={snapshot.lastMove}
              perspective={'white' as PlayerColor}
              selectedSquare={selectedSquare}
              highlightedMoves={moveTargets}
              onSquareClick={handleSquareClick}
            />
            {pendingPromotion ? (
              <section className="w-full max-w-[min(96vw,680px)] rounded-md border border-[#3a3734] bg-[#262421] p-3">
                <p className="mb-3 text-sm font-semibold text-[#f3efe8]" data-testid="offline-promotion-picker-title">
                  سرباز به آخر رسید؛ انتخاب کن به چه مهره‌ای تبدیل شود:
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {pendingPromotion.options.map((promotion) => {
                    return (
                      <button
                        key={promotion}
                        type="button"
                        onClick={() => handlePromotionChoice(promotion)}
                        data-testid={`offline-promotion-option-${promotion}`}
                        className="inline-flex items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 transition hover:bg-cyan-500/20"
                      >
                        <img
                          src={PROMOTION_ICON_BY_COLOR[pendingPromotion.color][promotion]}
                          alt=""
                          aria-hidden="true"
                          className="h-9 w-9"
                          draggable={false}
                        />
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setPendingPromotion(null)}
                  className="mt-3 rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  انصراف
                </button>
              </section>
            ) : null}
          </div>

          <aside className="flex flex-col gap-4">
            <MoveList moves={snapshot.moves} />
            <section className="rounded-md border border-[#3a3734] bg-[#262421] p-4 text-sm text-[#cbc7c2]">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#f3efe8]">Players</h3>
              <p>White: You</p>
              <p>
                Black: Robot ({selectedBotLevel.label} • {selectedBotLevel.rating})
              </p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
