'use client'

import { useMemo, useState } from 'react'
import { Chess, Square } from 'chess.js'
import { ChessBoard } from './chess-board'
import { MoveList } from './move-list'
import { PlayerPanel } from './player-panel'
import { RoomSnapshot } from '@/lib/chess/types'

const PERSONAL_ROOM_ID = 'PERSONAL'
type PromotionPiece = 'q' | 'r' | 'b' | 'n'

interface PendingPromotion {
  from: Square
  to: Square
  options: PromotionPiece[]
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
    roomId: PERSONAL_ROOM_ID,
    status,
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn() === 'w' ? 'white' : 'black',
    winner,
    drawReason,
    lastMove,
    moves,
    players: {
      white: { id: 'personal-white', name: 'White Player', color: 'white' },
      black: { id: 'personal-black', name: 'Black Player', color: 'black' },
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

export function PersonalChessRoom() {
  const [snapshot, setSnapshot] = useState<RoomSnapshot>(() => {
    const chess = new Chess()
    return formatSnapshot(chess, null, [])
  })
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [moveTargets, setMoveTargets] = useState<Square[]>([])
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const chessState = useMemo(() => new Chess(snapshot.fen), [snapshot.fen])
  const currentTurn = snapshot.turn
  const turnColor = currentTurn === 'white' ? 'w' : 'b'

  const clearSelection = () => {
    setSelectedSquare(null)
    setMoveTargets([])
  }

  const applyMove = (move: { from: Square; to: Square; promotion?: PromotionPiece }) => {
    const moveResult = chessState.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    })
    if (!moveResult) {
      setError('Move failed.')
      clearSelection()
      setPendingPromotion(null)
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
    clearSelection()
    setPendingPromotion(null)
  }

  const handleSquareClick = (square: Square) => {
    if (snapshot.status !== 'active' || pendingPromotion) return

    if (!selectedSquare) {
      const piece = chessState.get(square)
      if (!piece || piece.color !== turnColor) return
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
      if (piece && piece.color === turnColor) {
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
        options: uniquePromotionOptions,
      })
      return
    }

    applyMove({ from: selectedSquare, to: square })
  }

  const handlePromotionChoice = (promotion: PromotionPiece) => {
    if (!pendingPromotion) return
    applyMove({
      from: pendingPromotion.from,
      to: pendingPromotion.to,
      promotion,
    })
  }

  const resetGame = () => {
    const chess = new Chess()
    setSnapshot(formatSnapshot(chess, null, []))
    setError(null)
    clearSelection()
    setPendingPromotion(null)
  }

  return (
    <main className="min-h-screen bg-[#1f1d1b] px-2 py-5 text-slate-100 sm:px-5 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-md border border-[#3a3734] bg-[#262421] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-[#9f9a93]">Personal Offline Game</p>
            <h2 className="text-xl font-black tracking-tight text-[#f3efe8] sm:text-2xl" data-testid="personal-status-label">
              {snapshot.status === 'active'
                ? snapshot.turn === 'white'
                  ? 'نوبت سفید'
                  : 'نوبت مشکی'
                : snapshot.status === 'checkmate'
                  ? `برنده: ${snapshot.winner === 'white' ? 'سفید' : 'مشکی'}`
                  : snapshot.drawReason ?? 'مساوی'}
            </h2>
            <p className="text-xs text-[#bfb9b1]" data-testid="personal-perspective-label">
              صفحه برای بازیکن {snapshot.turn === 'white' ? 'سفید' : 'مشکی'} چرخیده است.
            </p>
          </div>
          <button
            type="button"
            onClick={resetGame}
            data-testid="personal-reset-btn"
            className="rounded-md border border-[#57524c] bg-[#34312e] px-3 py-2 text-xs font-semibold text-[#e6e2da] transition hover:bg-[#3f3b38]"
          >
            New game
          </button>
        </header>

        {error ? <p className="rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p> : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col items-center gap-4">
            <PlayerPanel snapshot={snapshot} perspective={snapshot.turn} />
            <ChessBoard
              fen={snapshot.fen}
              lastMove={snapshot.lastMove}
              perspective={snapshot.turn}
              selectedSquare={selectedSquare}
              highlightedMoves={moveTargets}
              onSquareClick={handleSquareClick}
            />
            {pendingPromotion ? (
              <section className="w-full max-w-[min(96vw,680px)] rounded-md border border-[#3a3734] bg-[#262421] p-3">
                <p className="mb-3 text-sm font-semibold text-[#f3efe8]" data-testid="personal-promotion-picker-title">
                  سرباز به آخر رسید؛ انتخاب کن به چه مهره‌ای تبدیل شود:
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {pendingPromotion.options.map((promotion) => {
                    const label =
                      promotion === 'q'
                        ? 'وزیر'
                        : promotion === 'r'
                          ? 'رخ'
                          : promotion === 'b'
                            ? 'فیل'
                            : 'اسب'
                    return (
                      <button
                        key={promotion}
                        type="button"
                        onClick={() => handlePromotionChoice(promotion)}
                        data-testid={`personal-promotion-option-${promotion}`}
                        className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                      >
                        {label}
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
              <p>White: Player 1</p>
              <p>Black: Player 2</p>
              <p className="mt-2 text-xs text-[#9f9a93]">نکته: بعد از هر حرکت، برد برای نفر بعدی می‌چرخد.</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
