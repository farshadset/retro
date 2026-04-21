'use client'

import { memo, useMemo } from 'react'
import { Chess, Square } from 'chess.js'
import { PlayerColor, RoomSnapshot } from '@/lib/chess/types'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const

interface ChessBoardProps {
  snapshot: RoomSnapshot
  perspective: PlayerColor
  selectedSquare: Square | null
  highlightedMoves: Square[]
  onSquareClick: (square: Square) => void
}

const PIECE_UNICODE: Record<string, string> = {
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  wk: '♔',
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚',
}

function ChessBoardComponent({
  snapshot,
  perspective,
  selectedSquare,
  highlightedMoves,
  onSquareClick,
}: ChessBoardProps) {
  const orientedFiles = perspective === 'white' ? FILES : [...FILES].reverse()
  const orientedRanks = perspective === 'white' ? RANKS : [...RANKS].reverse()

  const highlightedSet = useMemo(() => new Set(highlightedMoves), [highlightedMoves])
  const pieceBySquare = useMemo(() => {
    const nextPieceMap = new Map<Square, string>()
    const board = new Chess(snapshot.fen).board()
    board.forEach((rankSquares, rankIdx) => {
      rankSquares.forEach((piece, fileIdx) => {
        if (!piece) return
        const square = `${FILES[fileIdx]}${RANKS[rankIdx]}` as Square
        nextPieceMap.set(square, PIECE_UNICODE[`${piece.color}${piece.type}`] ?? '')
      })
    })
    return nextPieceMap
  }, [snapshot.fen])
  const lastMove = snapshot.lastMove

  return (
    <div className="w-full max-w-[min(92vw,680px)] rounded-2xl border border-slate-700/60 bg-slate-900 p-3 shadow-2xl">
      <div className="grid grid-cols-[16px_repeat(8,minmax(0,1fr))] gap-1">
        <div />
        {orientedFiles.map((file) => (
          <div key={`file-${file}`} className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            {file}
          </div>
        ))}
        {orientedRanks.map((rank, rowIndex) => (
          <FragmentRow
            key={`rank-${rank}`}
            fileOrder={orientedFiles}
            rank={rank}
            rowIndex={rowIndex}
            selectedSquare={selectedSquare}
            highlightedSet={highlightedSet}
            lastMove={lastMove}
            pieceBySquare={pieceBySquare}
            onSquareClick={onSquareClick}
          />
        ))}
      </div>
    </div>
  )
}

interface FragmentRowProps {
  fileOrder: readonly string[]
  rank: string
  rowIndex: number
  selectedSquare: Square | null
  highlightedSet: Set<Square>
  lastMove: RoomSnapshot['lastMove']
  pieceBySquare: Map<Square, string>
  onSquareClick: (square: Square) => void
}

function FragmentRow({
  fileOrder,
  rank,
  rowIndex,
  selectedSquare,
  highlightedSet,
  lastMove,
  pieceBySquare,
  onSquareClick,
}: FragmentRowProps) {
  return (
    <>
      <div className="flex items-center justify-center text-xs font-semibold text-slate-400">{rank}</div>
      {fileOrder.map((file, colIndex) => {
        const square = `${file}${rank}` as Square
        const isLight = (rowIndex + colIndex) % 2 === 0
        const isSelected = selectedSquare === square
        const isMoveTarget = highlightedSet.has(square)
        const isLastMove = lastMove ? lastMove.from === square || lastMove.to === square : false
        const piece = pieceBySquare.get(square) ?? ''

        return (
          <button
            key={square}
            type="button"
            onClick={() => onSquareClick(square)}
            className={[
              'relative aspect-square w-full rounded-[10px] text-3xl transition-all duration-150 sm:text-4xl',
              isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]',
              isSelected ? 'ring-4 ring-cyan-400/95' : '',
              isLastMove ? 'shadow-[inset_0_0_0_3px_rgba(234,179,8,0.75)]' : '',
              isMoveTarget ? 'shadow-[inset_0_0_0_3px_rgba(45,212,191,0.8)]' : '',
            ].join(' ')}
          >
            {piece}
            {isMoveTarget && !piece ? (
              <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-400/85" />
            ) : null}
          </button>
        )
      })}
    </>
  )
}

export const ChessBoard = memo(ChessBoardComponent)
