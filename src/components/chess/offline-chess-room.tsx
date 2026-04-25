'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, Square } from 'chess.js'
import { ChessBoard } from './chess-board'
import { MoveList } from './move-list'
import { PlayerPanel } from './player-panel'
import { PlayerColor, RoomSnapshot } from '@/lib/chess/types'

const OFFLINE_ROOM_ID = 'OFFBOT'

function chooseBotMove(chess: Chess) {
  const legalMoves = chess.moves({ verbose: true })
  if (legalMoves.length === 0) {
    return null
  }

  const prioritizedCapture = legalMoves.find((move) => move.captured)
  return prioritizedCapture ?? legalMoves[Math.floor(Math.random() * legalMoves.length)]
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
  const [snapshot, setSnapshot] = useState<RoomSnapshot>(() => {
    const chess = new Chess()
    return formatSnapshot(chess, null, [])
  })
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [moveTargets, setMoveTargets] = useState<Square[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isBotThinking, setIsBotThinking] = useState(false)

  const chessState = useMemo(() => new Chess(snapshot.fen), [snapshot.fen])
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
    botTimerRef.current = window.setTimeout(() => {
      const botMove = chooseBotMove(chessAfterPlayer)
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
    }, 450)
  }

  const handleSquareClick = (square: Square) => {
    if (!isPlayerTurn || isBotThinking) return

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

    const legalMove = chessState
      .moves({ square: selectedSquare, verbose: true })
      .find((move) => move.to === square)
    const promotion = legalMove?.promotion as 'q' | 'r' | 'b' | 'n' | undefined
    const moveResult = chessState.move({ from: selectedSquare, to: square, promotion })
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

  const resetGame = () => {
    if (botTimerRef.current) {
      window.clearTimeout(botTimerRef.current)
      botTimerRef.current = null
    }
    const chess = new Chess()
    setSnapshot(formatSnapshot(chess, null, []))
    setError(null)
    clearSelection()
    setIsBotThinking(false)
  }

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
          <button
            type="button"
            onClick={resetGame}
            data-testid="offline-reset-btn"
            className="rounded-md border border-[#57524c] bg-[#34312e] px-3 py-2 text-xs font-semibold text-[#e6e2da] transition hover:bg-[#3f3b38]"
          >
            New game
          </button>
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
          </div>

          <aside className="flex flex-col gap-4">
            <MoveList moves={snapshot.moves} />
            <section className="rounded-md border border-[#3a3734] bg-[#262421] p-4 text-sm text-[#cbc7c2]">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#f3efe8]">Players</h3>
              <p>White: You</p>
              <p>Black: Robot</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
