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
    <div className="flex w-full max-w-[min(92vw,680px)] flex-col gap-3">
      <section
        className={[
          'flex items-center justify-between rounded-xl border px-4 py-3',
          activeTurnColor === rivalColor ? 'border-emerald-400/80 bg-emerald-500/10' : 'border-slate-700 bg-slate-900/75',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-400" />
          <NameSlot player={rival} fallback="Waiting for opponent..." />
        </div>
        <span className="text-lg font-bold tabular-nums text-slate-100">{formatTimer(rivalTime)}</span>
      </section>

      <section
        className={[
          'flex items-center justify-between rounded-xl border px-4 py-3',
          activeTurnColor === myColor ? 'border-cyan-400/90 bg-cyan-500/10' : 'border-slate-700 bg-slate-900/75',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
          <NameSlot player={me} fallback="You" />
        </div>
        <span className="text-lg font-bold tabular-nums text-slate-100">{formatTimer(myTime)}</span>
      </section>
    </div>
  )
}
