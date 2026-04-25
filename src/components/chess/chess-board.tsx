'use client'

import { memo, useMemo } from 'react'
import { Chess, Square } from 'chess.js'
import { PlayerColor, RoomSnapshot } from '@/lib/chess/types'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const

interface ChessBoardProps {
  fen: string
  lastMove: RoomSnapshot['lastMove']
  perspective: PlayerColor
  selectedSquare: Square | null
  highlightedMoves: Square[]
  onSquareClick: (square: Square) => void
}

type PieceCode = 'wp' | 'wn' | 'wb' | 'wr' | 'wq' | 'wk' | 'bp' | 'bn' | 'bb' | 'br' | 'bq' | 'bk'

const PIECE_IMAGES: Record<PieceCode, string> = {
  wp: '/chess/pieces/cburnett/wP.svg',
  wn: '/chess/pieces/cburnett/wN.svg',
  wb: '/chess/pieces/cburnett/wB.svg',
  wr: '/chess/pieces/cburnett/wR.svg',
  wq: '/chess/pieces/cburnett/wQ.svg',
  wk: '/chess/pieces/cburnett/wK.svg',
  bp: '/chess/pieces/cburnett/bP.svg',
  bn: '/chess/pieces/cburnett/bN.svg',
  bb: '/chess/pieces/cburnett/bB.svg',
  br: '/chess/pieces/cburnett/bR.svg',
  bq: '/chess/pieces/cburnett/bQ.svg',
  bk: '/chess/pieces/cburnett/bK.svg',
}

function ChessBoardComponent({
  fen,
  lastMove,
  perspective,
  selectedSquare,
  highlightedMoves,
  onSquareClick,
}: ChessBoardProps) {
  const orientedFiles = perspective === 'white' ? FILES : [...FILES].reverse()
  const orientedRanks = perspective === 'white' ? RANKS : [...RANKS].reverse()

  const highlightedSet = useMemo(() => new Set(highlightedMoves), [highlightedMoves])
  const pieceBySquare = useMemo(() => {
    const nextPieceMap = new Map<Square, PieceCode>()
    const board = new Chess(fen).board()
    board.forEach((rankSquares, rankIdx) => {
      rankSquares.forEach((piece, fileIdx) => {
        if (!piece) return
        const square = `${FILES[fileIdx]}${RANKS[rankIdx]}` as Square
        nextPieceMap.set(square, `${piece.color}${piece.type}` as PieceCode)
      })
    })
    return nextPieceMap
  }, [fen])

  return (
    <div className="w-full max-w-[min(96vw,680px)] rounded-md border border-[#201d1a] bg-[#262421] p-2 shadow-[0_14px_28px_rgba(0,0,0,0.42)]">
      <div className="grid grid-cols-8 overflow-hidden rounded-sm border-2 border-[#312e2b]">
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
  pieceBySquare: Map<Square, PieceCode>
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
      {fileOrder.map((file, colIndex) => {
        const square = `${file}${rank}` as Square
        const isLight = (rowIndex + colIndex) % 2 === 0
        const isSelected = selectedSquare === square
        const isMoveTarget = highlightedSet.has(square)
        const isLastMove = lastMove ? lastMove.from === square || lastMove.to === square : false
        const isLeftEdge = colIndex === 0
        const isBottomEdge = rowIndex === 7
        const piece = pieceBySquare.get(square)
        const squareTone = isLastMove ? (isLight ? 'bg-[#f6f681]' : 'bg-[#b9ca43]') : isLight ? 'bg-[#eeeed2]' : 'bg-[#769656]'
        const coordinateText = isLight ? 'text-[#769656]' : 'text-[#eeeed2]'

        return (
          <button
            key={square}
            type="button"
            onClick={() => onSquareClick(square)}
            data-testid={`chess-square-${square}`}
            className={[
              'relative aspect-square w-full touch-manipulation select-none transition-all duration-150',
              squareTone,
              isSelected ? 'z-10 shadow-[inset_0_0_0_3px_rgba(43,196,255,0.92)]' : '',
              isMoveTarget && piece ? 'shadow-[inset_0_0_0_3px_rgba(15,23,42,0.45)]' : '',
            ].join(' ')}
          >
            {isLeftEdge ? (
              <span className={`pointer-events-none absolute left-1 top-0.5 text-[10px] font-semibold ${coordinateText}`}>
                {rank}
              </span>
            ) : null}
            {isBottomEdge ? (
              <span className={`pointer-events-none absolute bottom-0.5 right-1 text-[10px] font-semibold ${coordinateText}`}>
                {file}
              </span>
            ) : null}
            {piece ? (
              <img
                src={PIECE_IMAGES[piece]}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute inset-0 m-auto h-[86%] w-[86%] drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
              />
            ) : null}
            {isMoveTarget && !piece ? (
              <span className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/22" />
            ) : null}
          </button>
        )
      })}
    </>
  )
}

export const ChessBoard = memo(ChessBoardComponent)
