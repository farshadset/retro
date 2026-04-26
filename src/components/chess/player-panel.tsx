'use client'

import { PlayerColor, RoomPlayer, RoomSnapshot } from '@/lib/chess/types'

interface PlayerPanelProps {
  snapshot: RoomSnapshot
  perspective: PlayerColor
}

function formatTimer(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function NameSlot({ player, fallback }: { player: RoomPlayer | null; fallback: string }) {
  return <span className="font-semibold text-slate-100">{player?.name ?? fallback}</span>
}

export function PlayerPanel({ snapshot, perspective }: PlayerPanelProps) {
  const myColor = perspective
  const rivalColor = myColor === 'white' ? 'black' : 'white'

  const me = myColor === 'white' ? snapshot.players.white : snapshot.players.black
  const rival = rivalColor === 'white' ? snapshot.players.white : snapshot.players.black
  const myTime = myColor === 'white' ? snapshot.whiteTimeMs : snapshot.blackTimeMs
  const rivalTime = rivalColor === 'white' ? snapshot.whiteTimeMs : snapshot.blackTimeMs
  const activeTurnColor = snapshot.turn

  return (
    <div className="flex w-full max-w-[min(96vw,680px)] flex-col gap-3">
      <section
        className={[
          'flex items-center justify-between rounded-md border px-4 py-3',
          activeTurnColor === rivalColor
            ? 'border-[#6c8d38] bg-[#2a2a29]'
            : 'border-[#3a3734] bg-[#2a2826]',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 text-sm text-[#cbc7c2]">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#9f9a93]" />
          <NameSlot player={rival} fallback="Waiting for opponent..." />
        </div>
        <span className="rounded-md bg-[#3a3937] px-4 py-1.5 text-xl font-bold tabular-nums text-[#f0ede6]">
          {formatTimer(rivalTime)}
        </span>
      </section>

      <section
        className={[
          'flex items-center justify-between rounded-md border px-4 py-3',
          activeTurnColor === myColor
            ? 'border-[#6c8d38] bg-[#2a2a29]'
            : 'border-[#3a3734] bg-[#2a2826]',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 text-sm text-[#cbc7c2]">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#9f9a93]" />
          <NameSlot player={me} fallback="You" />
        </div>
        <span className="rounded-md bg-[#171716] px-4 py-1.5 text-xl font-bold tabular-nums text-[#f0ede6]">
          {formatTimer(myTime)}
        </span>
      </section>
    </div>
  )
}
