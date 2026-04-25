'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, Square } from 'chess.js'
import { ChessBoard } from './chess-board'
import { MoveList } from './move-list'
import { PlayerPanel } from './player-panel'
import { createRoom, fetchRoom, joinRoom, makeMove, resign, roomEventsUrl } from '@/lib/chess/client'
import { PlayerColor, RoomSession, RoomSnapshot, RoomStatus } from '@/lib/chess/types'

type Mode = 'lobby' | 'playing'
type JoinMode = 'create' | 'join'

interface StoredSession {
  roomId: string
  session: RoomSession
}

const SESSION_STORAGE_KEY = 'realtime-chess-session'

function statusLabel(status: RoomStatus): string {
  switch (status) {
    case 'waiting':
      return 'Waiting for opponent'
    case 'active':
      return 'In progress'
    case 'checkmate':
      return 'Checkmate'
    case 'draw':
      return 'Draw'
    case 'timeout':
      return 'Timeout'
    default:
      return status
  }
}

function gameResultText(snapshot: RoomSnapshot): string {
  if (snapshot.status === 'draw') {
    return snapshot.drawReason ? `Draw — ${snapshot.drawReason}` : 'Draw'
  }
  if (snapshot.status === 'timeout') {
    return `${snapshot.winner === 'white' ? 'White' : 'Black'} won on time`
  }
  if (snapshot.status === 'checkmate') {
    if (snapshot.drawReason?.includes('resigned')) {
      return snapshot.drawReason
    }
    return `${snapshot.winner === 'white' ? 'White' : 'Black'} won by checkmate`
  }
  return ''
}

function normalizeRoomId(roomId: string): string {
  return roomId.trim().toUpperCase()
}

export function ChessRoom() {
  const [mode, setMode] = useState<Mode>('lobby')
  const [joinMode, setJoinMode] = useState<JoinMode>('create')
  const [name, setName] = useState('')
  const [roomInput, setRoomInput] = useState('')
  const [timeControlMinutes, setTimeControlMinutes] = useState(10)
  const [incrementSeconds, setIncrementSeconds] = useState(2)
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [session, setSession] = useState<RoomSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [moveTargets, setMoveTargets] = useState<Square[]>([])
  const [isMakingMove, setIsMakingMove] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())
  const eventSourceRef = useRef<EventSource | null>(null)
  const clockIntervalRef = useRef<number | null>(null)

  const playerColor = session?.color ?? 'white'
  const isPlayerTurn = Boolean(snapshot && session?.color && snapshot.turn === session.color && snapshot.status === 'active')

  const reconstructedChess = useMemo(() => {
    if (!snapshot) return null
    return new Chess(snapshot.fen)
  }, [snapshot])

  const hydratedSnapshot = useMemo(() => {
    if (!snapshot || snapshot.status !== 'active' || snapshot.activeSince === null) return snapshot
    const elapsed = Math.max(0, nowTick - snapshot.activeSince)
    if (snapshot.turn === 'white') {
      return { ...snapshot, whiteTimeMs: Math.max(0, snapshot.whiteTimeMs - elapsed) }
    }
    return { ...snapshot, blackTimeMs: Math.max(0, snapshot.blackTimeMs - elapsed) }
  }, [snapshot, nowTick])

  const clearSelection = useCallback(() => {
    setSelectedSquare(null)
    setMoveTargets([])
  }, [])

  const persistSession = useCallback((nextRoomId: string, nextSession: RoomSession) => {
    const payload: StoredSession = { roomId: nextRoomId, session: nextSession }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
  }, [])

  const clearPersistedSession = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  }, [])

  const disconnectEvents = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (clockIntervalRef.current) {
      window.clearInterval(clockIntervalRef.current)
      clockIntervalRef.current = null
    }
  }, [])

  const connectEvents = useCallback((roomId: string) => {
    disconnectEvents()
    const source = new EventSource(roomEventsUrl(roomId))
    const applySnapshot = (rawPayload: string) => {
      try {
        const nextSnapshot = JSON.parse(rawPayload) as RoomSnapshot
        setSnapshot(nextSnapshot)
      } catch {
        setError('Failed to parse live game event.')
      }
    }
    source.addEventListener('snapshot', (event) => {
      applySnapshot((event as MessageEvent<string>).data)
    })
    source.addEventListener('move', (event) => {
      applySnapshot((event as MessageEvent<string>).data)
    })
    source.addEventListener('player-joined', (event) => {
      applySnapshot((event as MessageEvent<string>).data)
    })
    source.addEventListener('game-over', (event) => {
      applySnapshot((event as MessageEvent<string>).data)
    })
    source.addEventListener('resigned', (event) => {
      applySnapshot((event as MessageEvent<string>).data)
    })
    source.onerror = () => {
      source.close()
      setTimeout(() => {
        connectEvents(roomId)
      }, 1200)
    }
    eventSourceRef.current = source

    clockIntervalRef.current = window.setInterval(async () => {
      setNowTick(Date.now())
      try {
        const fresh = await fetchRoom(roomId)
        setSnapshot(fresh.snapshot)
      } catch {
        // Ignore periodic errors; SSE will continue retrying.
      }
    }, 1000)
  }, [disconnectEvents])

  const enterGame = useCallback(
    (nextSnapshot: RoomSnapshot, nextSession: RoomSession) => {
      setSnapshot(nextSnapshot)
      setSession(nextSession)
      setMode('playing')
      setError(null)
      setNowTick(Date.now())
      clearSelection()
      persistSession(nextSnapshot.roomId, nextSession)
      connectEvents(nextSnapshot.roomId)
    },
    [clearSelection, connectEvents, persistSession]
  )

  useEffect(() => {
    const roomIdFromQuery = normalizeRoomId(new URLSearchParams(window.location.search).get('room') ?? '')
    if (roomIdFromQuery) {
      setRoomInput(roomIdFromQuery)
      setJoinMode('join')
    }

    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as StoredSession
      if (!parsed?.roomId || !parsed?.session?.token) return
      fetchRoom(parsed.roomId)
        .then((response) => {
          enterGame(response.snapshot, parsed.session)
        })
        .catch(() => {
          clearPersistedSession()
        })
    } catch {
      clearPersistedSession()
    }
  }, [clearPersistedSession, enterGame])

  useEffect(() => {
    return () => disconnectEvents()
  }, [disconnectEvents])

  useEffect(() => {
    clearSelection()
  }, [snapshot?.fen, clearSelection])

  const handleCreateRoom = async () => {
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await createRoom({
        name: name.trim(),
        timeControlMinutes,
        incrementSeconds,
      })
      window.history.replaceState({}, '', `/?room=${response.snapshot.roomId}`)
      enterGame(response.snapshot, response.session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create room.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoinRoom = async () => {
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.')
      return
    }
    const roomId = normalizeRoomId(roomInput)
    if (roomId.length < 4) {
      setError('Room ID is invalid.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const response = await joinRoom({ roomId, name: name.trim() })
      window.history.replaceState({}, '', `/?room=${response.snapshot.roomId}`)
      enterGame(response.snapshot, response.session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not join room.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSquareClick = async (square: Square) => {
    if (!snapshot || !session || !reconstructedChess) return
    if (!session.color || snapshot.status !== 'active' || snapshot.turn !== session.color) return

    if (!selectedSquare) {
      const piece = reconstructedChess.get(square)
      if (!piece || piece.color !== (session.color === 'white' ? 'w' : 'b')) return
      setSelectedSquare(square)
      const legalTargets = reconstructedChess
        .moves({ square, verbose: true })
        .map((move) => move.to as Square)
      setMoveTargets(legalTargets)
      return
    }

    if (square === selectedSquare) {
      clearSelection()
      return
    }

    if (!moveTargets.includes(square)) {
      const piece = reconstructedChess.get(square)
      if (piece && piece.color === (session.color === 'white' ? 'w' : 'b')) {
        setSelectedSquare(square)
        const legalTargets = reconstructedChess
          .moves({ square, verbose: true })
          .map((move) => move.to as Square)
        setMoveTargets(legalTargets)
      } else {
        clearSelection()
      }
      return
    }

    setIsMakingMove(true)
    try {
      const legalMove = reconstructedChess
        .moves({ square: selectedSquare, verbose: true })
        .find((move) => move.to === square)
      const promotion = legalMove?.promotion as 'q' | 'r' | 'b' | 'n' | undefined
      const response = await makeMove({
        roomId: snapshot.roomId,
        token: session.token,
        from: selectedSquare,
        to: square,
        promotion,
      })
      setSnapshot(response.snapshot)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Move failed.')
    } finally {
      setIsMakingMove(false)
      clearSelection()
    }
  }

  const handleResign = async () => {
    if (!snapshot || !session) return
    if (!session.color) return
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await resign({
        roomId: snapshot.roomId,
        token: session.token,
      })
      setSnapshot(response.snapshot)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resign.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const leaveGame = () => {
    disconnectEvents()
    clearPersistedSession()
    setMode('lobby')
    setSession(null)
    setSnapshot(null)
    setRoomInput('')
    window.history.replaceState({}, '', '/')
  }

  if (mode === 'lobby' || !hydratedSnapshot || !session) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12 text-slate-100">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header className="space-y-3 text-center">
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Realtime Arena</p>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Lightning Chess</h1>
            <p className="mx-auto max-w-xl text-sm text-slate-300 sm:text-base">
              Fast real-time chess with synchronized clocks, legal-move enforcement, and instant room sharing.
            </p>
          </header>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 backdrop-blur sm:p-8">
            <div className="mb-6 flex gap-2 rounded-xl bg-slate-800/80 p-1">
              <button
                type="button"
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  joinMode === 'create' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
                onClick={() => setJoinMode('create')}
              >
                Create room
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  joinMode === 'join' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
                onClick={() => setJoinMode('join')}
              >
                Join room
              </button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Player name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 text-sm outline-none ring-cyan-400 transition focus:ring-2"
                  placeholder="e.g. Ali"
                />
              </label>

              {joinMode === 'create' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-200">Base time (minutes)</span>
                    <input
                      value={timeControlMinutes}
                      onChange={(event) => setTimeControlMinutes(Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 text-sm outline-none ring-cyan-400 transition focus:ring-2"
                      type="number"
                      min={1}
                      max={60}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-200">Increment (seconds)</span>
                    <input
                      value={incrementSeconds}
                      onChange={(event) => setIncrementSeconds(Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 text-sm outline-none ring-cyan-400 transition focus:ring-2"
                      type="number"
                      min={0}
                      max={30}
                    />
                  </label>
                </div>
              ) : (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Room ID</span>
                  <input
                    value={roomInput}
                    onChange={(event) => setRoomInput(event.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 text-sm uppercase outline-none ring-cyan-400 transition focus:ring-2"
                    placeholder="AB12CD"
                  />
                </label>
              )}
            </div>

            {error ? <p className="mt-4 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            <button
              type="button"
              disabled={isSubmitting}
              onClick={joinMode === 'create' ? handleCreateRoom : handleJoinRoom}
              className="mt-6 w-full rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Please wait...' : joinMode === 'create' ? 'Create and play' : 'Join game'}
            </button>
          </section>
        </div>
      </main>
    )
  }

  const roomShareUrl = `${window.location.origin}/?room=${hydratedSnapshot.roomId}`

  return (
    <main className="min-h-screen bg-[#1f1d1b] px-2 py-5 text-slate-100 sm:px-5 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-md border border-[#3a3734] bg-[#262421] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-[#9f9a93]">Room {hydratedSnapshot.roomId}</p>
            <h2 className="text-xl font-black tracking-tight text-[#f3efe8] sm:text-2xl">{statusLabel(hydratedSnapshot.status)}</h2>
            {hydratedSnapshot.status !== 'active' && hydratedSnapshot.status !== 'waiting' ? (
              <p className="text-sm text-amber-200">{gameResultText(hydratedSnapshot)}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(roomShareUrl)
                } catch {
                  setError('Could not copy room link.')
                }
              }}
              className="rounded-md border border-[#57524c] bg-[#34312e] px-3 py-2 text-xs font-semibold text-[#e6e2da] transition hover:bg-[#3f3b38]"
            >
              Copy room link
            </button>
            <button
              type="button"
              onClick={leaveGame}
              className="rounded-md border border-[#57524c] bg-[#34312e] px-3 py-2 text-xs font-semibold text-[#e6e2da] transition hover:bg-[#3f3b38]"
            >
              Leave room
            </button>
            <button
              type="button"
              disabled={!session.color || hydratedSnapshot.status !== 'active' || isSubmitting}
              onClick={handleResign}
              className="rounded-md border border-red-500/40 bg-[#3a2b2b] px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-[#4b3333] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Resign
            </button>
          </div>
        </header>

        {error ? <p className="rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p> : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col items-center gap-4">
            <PlayerPanel snapshot={hydratedSnapshot} perspective={playerColor as PlayerColor} />
            <ChessBoard
              snapshot={hydratedSnapshot}
              perspective={(session.color ?? 'white') as PlayerColor}
              selectedSquare={selectedSquare}
              highlightedMoves={moveTargets}
              onSquareClick={handleSquareClick}
            />
            <p className="text-sm text-[#bfb9b1]">
              {session.color
                ? isPlayerTurn
                  ? isMakingMove
                    ? 'Submitting your move...'
                    : 'Your turn'
                  : hydratedSnapshot.status === 'active'
                    ? "Opponent's turn"
                    : 'Game finished'
                : 'Spectator mode'}
            </p>
          </div>

          <aside className="flex flex-col gap-4">
            <MoveList moves={hydratedSnapshot.moves} />
            <section className="rounded-md border border-[#3a3734] bg-[#262421] p-4 text-sm text-[#cbc7c2]">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#f3efe8]">Players</h3>
              <p>White: {hydratedSnapshot.players.white?.name ?? 'Waiting...'}</p>
              <p>Black: {hydratedSnapshot.players.black?.name ?? 'Waiting...'}</p>
              <p className="mt-2 text-xs text-[#9f9a93]">Spectators: {hydratedSnapshot.spectatorCount}</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
