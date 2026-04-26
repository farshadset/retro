'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, Square } from 'chess.js'
import { ChessBoard } from './chess-board'
import { MoveList } from './move-list'
import { PlayerPanel } from './player-panel'
import { createRoom, fetchRoom, joinRoom, makeMove, resign, roomEventsUrl, sendChatMessage } from '@/lib/chess/client'
import { ChatMessage, PlayerColor, RoomSession, RoomSnapshot, RoomStatus } from '@/lib/chess/types'
import { PROFILE_USERNAME_STORAGE_KEY } from '@/lib/profile/constants'

type PromotionPiece = 'q' | 'r' | 'b' | 'n'
type ChatComposerTab = 'text' | 'sticker'
type ChatStickerCategoryId = 'general' | 'reaction' | 'chess'

interface StoredSession {
  roomId: string
  session: RoomSession
}

interface PendingPromotion {
  from: Square
  to: Square
  options: PromotionPiece[]
}

const PROMOTION_PIECE_IMAGE: Record<PlayerColor, Record<PromotionPiece, string>> = {
  white: {
    q: '/chess/pieces/cburnett/wQ.svg',
    r: '/chess/pieces/cburnett/wR.svg',
    b: '/chess/pieces/cburnett/wB.svg',
    n: '/chess/pieces/cburnett/wN.svg',
  },
  black: {
    q: '/chess/pieces/cburnett/bQ.svg',
    r: '/chess/pieces/cburnett/bR.svg',
    b: '/chess/pieces/cburnett/bB.svg',
    n: '/chess/pieces/cburnett/bN.svg',
  },
}

const SESSION_STORAGE_KEY = 'realtime-chess-session'
const WAITING_ACTIONS_DELAY_MS = 15_000
const WAITING_ACTIONS_DELAY_STORAGE_KEY = 'realtime-chess-waiting-actions-delay-ms'
const CHAT_QUICK_MESSAGES = ['ایول', 'عجب حرکتی بود', 'دمت گرم', 'نوبت تو', 'آفرین', 'حرکت خوبی بود', 'خوبه!']
const CHAT_STICKER_CATEGORIES: Array<{ id: ChatStickerCategoryId; label: string; stickers: string[] }> = [
  {
    id: 'general',
    label: 'عمومی',
    stickers: ['👍', '🔥', '👏', '😀', '😍', '😂', '✨', '🎯'],
  },
  {
    id: 'reaction',
    label: 'واکنش سریع',
    stickers: ['😮', '😅', '😎', '🤯', '🤝', '🙏', '🙌', '💪'],
  },
  {
    id: 'chess',
    label: 'شطرنجی',
    stickers: ['♔', '♕', '♖', '♗', '♘', '♙', '♚', '♛', '♜', '♝', '♞', '♟'],
  },
]

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

function formatChatMessageTime(createdAt: number): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(createdAt)
  } catch {
    return ''
  }
}

function lastChatPreview(chatMessages: ChatMessage[]): string {
  if (chatMessages.length === 0) {
    return 'پیام آماده یا استیکر بفرست.'
  }
  const lastMessage = chatMessages[chatMessages.length - 1]
  const prefix = lastMessage.senderName ? `${lastMessage.senderName}: ` : ''
  return `${prefix}${lastMessage.value}`
}

export function ChessRoom() {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [session, setSession] = useState<RoomSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [moveTargets, setMoveTargets] = useState<Square[]>([])
  const [isMakingMove, setIsMakingMove] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [showWaitingActions, setShowWaitingActions] = useState(false)
  const [waitingActionsDelayMs, setWaitingActionsDelayMs] = useState(WAITING_ACTIONS_DELAY_MS)
  const [isRetryingMatch, setIsRetryingMatch] = useState(false)
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false)
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [activeComposerTab, setActiveComposerTab] = useState<ChatComposerTab>('text')
  const [activeStickerCategory, setActiveStickerCategory] = useState<ChatStickerCategoryId>('general')
  const [nowTick, setNowTick] = useState(Date.now())
  const eventSourceRef = useRef<EventSource | null>(null)
  const clockIntervalRef = useRef<number | null>(null)
  const chatListRef = useRef<HTMLDivElement | null>(null)
  const autoBootstrappingRef = useRef(false)
  const autoPlayerNameRef = useRef<string>('')

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
  const chatMessages = useMemo(() => hydratedSnapshot?.chatMessages ?? [], [hydratedSnapshot?.chatMessages])
  const selectedStickerCategory =
    CHAT_STICKER_CATEGORIES.find((category) => category.id === activeStickerCategory) ?? CHAT_STICKER_CATEGORIES[0]

  const clearSelection = useCallback(() => {
    setSelectedSquare(null)
    setMoveTargets([])
  }, [])

  const submitMove = useCallback(
    async (move: { from: Square; to: Square; promotion?: PromotionPiece }) => {
      if (!snapshot || !session) return
      setIsMakingMove(true)
      try {
        const response = await makeMove({
          roomId: snapshot.roomId,
          token: session.token,
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        })
        setSnapshot(response.snapshot)
        setError(null)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Move failed.')
      } finally {
        setIsMakingMove(false)
        clearSelection()
        setPendingPromotion(null)
      }
    },
    [clearSelection, session, snapshot]
  )

  const persistSession = useCallback((nextRoomId: string, nextSession: RoomSession) => {
    const payload: StoredSession = { roomId: nextRoomId, session: nextSession }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
  }, [])

  const clearPersistedSession = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  }, [])

  const resolveAutoPlayerName = useCallback((): string => {
    if (autoPlayerNameRef.current) {
      return autoPlayerNameRef.current
    }
    const storedProfileName = localStorage.getItem(PROFILE_USERNAME_STORAGE_KEY)?.trim() ?? ''
    if (storedProfileName.length >= 2) {
      autoPlayerNameRef.current = storedProfileName.slice(0, 32)
      return autoPlayerNameRef.current
    }
    autoPlayerNameRef.current = `Guest-${Math.floor(1000 + Math.random() * 9000)}`
    return autoPlayerNameRef.current
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
    source.addEventListener('chat', (event) => {
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
      setError(null)
      setNowTick(Date.now())
      clearSelection()
      persistSession(nextSnapshot.roomId, nextSession)
      connectEvents(nextSnapshot.roomId)
    },
    [clearSelection, connectEvents, persistSession]
  )

  useEffect(() => {
    const rawDelay = localStorage.getItem(WAITING_ACTIONS_DELAY_STORAGE_KEY)?.trim()
    if (!rawDelay) return
    const parsedDelay = Number(rawDelay)
    if (Number.isFinite(parsedDelay) && parsedDelay >= 250 && parsedDelay <= 120_000) {
      setWaitingActionsDelayMs(Math.floor(parsedDelay))
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const bootstrapGame = async () => {
      const roomIdFromQuery = normalizeRoomId(new URLSearchParams(window.location.search).get('room') ?? '')
      const raw = localStorage.getItem(SESSION_STORAGE_KEY)
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as StoredSession
          if (parsed?.roomId && parsed?.session?.token) {
            const response = await fetchRoom(parsed.roomId)
            if (cancelled) return
            enterGame(response.snapshot, parsed.session)
            return
          }
        } catch {
          clearPersistedSession()
        }
      }

      if (autoBootstrappingRef.current) {
        return
      }
      autoBootstrappingRef.current = true
      setIsSubmitting(true)
      setError(null)

      try {
        const autoName = resolveAutoPlayerName()
        const response = roomIdFromQuery
          ? await joinRoom({ roomId: roomIdFromQuery, name: autoName })
          : await createRoom({
              name: autoName,
              timeControlMinutes: 10,
              incrementSeconds: 2,
              quickMatch: true,
              matchAnyTimeControl: true,
            })
        if (cancelled) return
        window.history.replaceState({}, '', `/online?room=${response.snapshot.roomId}`)
        enterGame(response.snapshot, response.session)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not start online game.')
        }
      } finally {
        autoBootstrappingRef.current = false
        if (!cancelled) {
          setIsSubmitting(false)
        }
      }
    }

    void bootstrapGame()
    return () => {
      cancelled = true
    }
  }, [clearPersistedSession, enterGame, resolveAutoPlayerName])

  useEffect(() => {
    return () => disconnectEvents()
  }, [disconnectEvents])

  useEffect(() => {
    clearSelection()
    setPendingPromotion(null)
  }, [snapshot?.fen, clearSelection])

  useEffect(() => {
    if (!snapshot || !session || session.color !== 'white' || snapshot.status !== 'waiting') {
      setShowWaitingActions(false)
      return
    }

    const elapsedMs = Math.max(0, Date.now() - snapshot.createdAt)
    const remainingMs = Math.max(0, waitingActionsDelayMs - elapsedMs)
    if (remainingMs === 0) {
      setShowWaitingActions(true)
      return
    }

    setShowWaitingActions(false)
    const timeout = window.setTimeout(() => {
      setShowWaitingActions(true)
    }, remainingMs)

    return () => window.clearTimeout(timeout)
  }, [session, snapshot, waitingActionsDelayMs])

  useEffect(() => {
    if (!isChatPanelOpen) return
    const chatContainer = chatListRef.current
    if (!chatContainer) return
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: 'smooth',
    })
  }, [chatMessages, isChatPanelOpen])

  const handleSquareClick = async (square: Square) => {
    if (!snapshot || !session || !reconstructedChess) return
    if (!session.color || snapshot.status !== 'active' || snapshot.turn !== session.color) return
    if (pendingPromotion) return

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

    const matchingMoves = reconstructedChess
      .moves({ square: selectedSquare, verbose: true })
      .filter((move) => move.to === square)
    const promotionOptions = matchingMoves
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
    await submitMove({
      from: selectedSquare,
      to: square,
      promotion: uniquePromotionOptions[0],
    })
  }

  const handlePromotionChoice = async (promotion: PromotionPiece) => {
    if (!pendingPromotion) return
    await submitMove({
      from: pendingPromotion.from,
      to: pendingPromotion.to,
      promotion,
    })
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

  const handleRetryMatch = async () => {
    if (!snapshot || !session || session.color !== 'white' || snapshot.status !== 'waiting') {
      return
    }
    setIsRetryingMatch(true)
    setError(null)
    try {
      const response = await createRoom({
        name: session.name,
        timeControlMinutes: Math.max(1, Math.round(snapshot.timeControlMs / 60_000)),
        incrementSeconds: Math.max(0, Math.round(snapshot.incrementMs / 1_000)),
        quickMatch: true,
        matchAnyTimeControl: true,
        excludeRoomId: snapshot.roomId,
      })
      window.history.replaceState({}, '', `/online?room=${response.snapshot.roomId}`)
      enterGame(response.snapshot, response.session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not retry matchmaking.')
    } finally {
      setIsRetryingMatch(false)
    }
  }

  const handleShareRoom = async () => {
    if (!hydratedSnapshot) return
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Chess room',
          text: 'برای بازی آنلاین شطرنج با من وارد این لینک شو.',
          url: roomShareUrl,
        })
        return
      }
      await navigator.clipboard.writeText(roomShareUrl)
    } catch (cause) {
      const shareError = cause as { name?: string } | undefined
      if (shareError?.name === 'AbortError') {
        return
      }
      setError('Could not share room link.')
    }
  }

  const handleSendChat = async (kind: 'text' | 'sticker', value: string) => {
    if (!snapshot || !session || !session.color || !value.trim()) {
      return
    }
    setIsSendingChat(true)
    try {
      const response = await sendChatMessage({
        roomId: snapshot.roomId,
        token: session.token,
        kind,
        value: value.trim(),
      })
      setSnapshot(response.snapshot)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send chat message.')
    } finally {
      setIsSendingChat(false)
    }
  }

  const leaveGame = () => {
    disconnectEvents()
    clearPersistedSession()
    setSession(null)
    setSnapshot(null)
    window.location.assign('/')
  }

  if (!hydratedSnapshot || !session) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12 text-slate-100">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 text-center backdrop-blur">
            <h1 className="text-xl font-black text-slate-100">در حال آماده‌سازی بازی آنلاین...</h1>
            <p className="mt-2 text-sm text-slate-300">
              {isSubmitting ? 'در حال ساخت یا ورود خودکار به اتاق. لطفاً کمی صبر کنید.' : 'در حال تلاش مجدد برای اتصال.'}
            </p>
            {error ? <p className="mt-4 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p> : null}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              تلاش مجدد
            </button>
          </section>
        </div>
      </main>
    )
  }

  const roomShareUrl = `${window.location.origin}/online?room=${hydratedSnapshot.roomId}`

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
          </div>
        </header>

        {error ? <p className="rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p> : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col items-center gap-4">
            <PlayerPanel snapshot={hydratedSnapshot} perspective={playerColor as PlayerColor} />
            <ChessBoard
              fen={hydratedSnapshot.fen}
              lastMove={hydratedSnapshot.lastMove}
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
                    : pendingPromotion
                      ? 'Choose promotion piece'
                    : 'Your turn'
                  : hydratedSnapshot.status === 'active'
                    ? "Opponent's turn"
                    : 'Game finished'
                : 'Spectator mode'}
            </p>
            {showWaitingActions ? (
              <section
                className="w-full max-w-[min(96vw,680px)] rounded-md border border-[#3a3734] bg-[#262421] p-3"
                data-testid="waiting-actions-panel"
              >
                <p className="mb-3 text-sm text-[#dcd6ce]" data-testid="waiting-actions-text">
                  هنوز حریفی پیدا نشده. می‌تونی دوباره تلاش کنی یا لینک اتاقت رو برای دوستت بفرستی.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRetryMatch()}
                    disabled={isRetryingMatch}
                    data-testid="waiting-retry-btn"
                    className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRetryingMatch ? 'در حال تلاش...' : 'تلاش مجدد'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareRoom()}
                    data-testid="waiting-share-btn"
                    className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                  >
                    اشتراک‌گذاری لینک
                  </button>
                </div>
              </section>
            ) : null}
            {pendingPromotion ? (
              <section className="w-full max-w-[min(96vw,680px)] rounded-md border border-[#3a3734] bg-[#262421] p-3">
                <p className="mb-3 text-sm font-semibold text-[#f3efe8]" data-testid="promotion-picker-title">
                  مهره ارتقا را انتخاب کن:
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {pendingPromotion.options.map((promotion) => {
                    return (
                      <button
                        key={promotion}
                        type="button"
                        onClick={() => void handlePromotionChoice(promotion)}
                        data-testid={`promotion-option-${promotion}`}
                        className="flex items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 transition hover:bg-cyan-500/20"
                      >
                        <img
                          src={PROMOTION_PIECE_IMAGE[session.color ?? 'white'][promotion]}
                          alt=""
                          aria-hidden="true"
                          className="h-11 w-11"
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
            <section className="overflow-hidden rounded-xl border border-[#3a3734] bg-gradient-to-b from-[#2c2926] to-[#24211e] shadow-[0_18px_45px_-28px_rgba(15,23,42,0.85)]">
              <div className="border-b border-[#3a3734] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setIsChatPanelOpen((prev) => !prev)}
                    data-testid="chat-toggle-btn"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-2 text-right text-xs text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    <span className="text-base leading-none">💬</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold sm:text-xs">چت بازی</span>
                      <span className="block truncate text-[10px] text-cyan-50/75 sm:text-[11px]">{lastChatPreview(chatMessages)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={!session.color || hydratedSnapshot.status !== 'active' || isSubmitting}
                    onClick={handleResign}
                    data-testid="chat-resign-btn"
                    className="rounded-lg border border-red-500/45 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    انصراف
                  </button>
                </div>
              </div>
              {isChatPanelOpen ? (
                <div className="space-y-3 p-3" data-testid="chat-panel">
                  <div
                    ref={chatListRef}
                    className="h-44 space-y-2 overflow-y-auto rounded-xl border border-[#47413a] bg-[#1e1b18] p-2.5 sm:h-52"
                    data-testid="chat-message-list"
                  >
                    {chatMessages.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-center text-xs text-[#9f9a93]">هنوز پیامی ارسال نشده.</p>
                      </div>
                    ) : (
                      chatMessages.map((message) => {
                        const isMine = session.color === message.senderColor
                        return (
                          <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`} data-testid={`chat-message-${message.id}`}>
                            <div
                              className={[
                                'max-w-[84%] rounded-2xl px-3 py-2 shadow-sm',
                                isMine ? 'rounded-br-md bg-cyan-500/16 text-cyan-50' : 'rounded-bl-md bg-slate-700/35 text-slate-100',
                              ].join(' ')}
                            >
                              {!isMine ? <p className="mb-0.5 text-[10px] font-semibold text-slate-300">{message.senderName}</p> : null}
                              <p className={message.type === 'sticker' ? 'text-xl leading-6' : 'text-xs leading-5'}>{message.value}</p>
                              <p className="mt-1 text-[10px] text-slate-300/70">{formatChatMessageTime(message.createdAt)}</p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="rounded-lg bg-[#1f1d1b] p-1">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveComposerTab('text')}
                        data-testid="chat-composer-tab-text"
                        className={[
                          'rounded-md px-2.5 py-1.5 text-xs font-semibold transition',
                          activeComposerTab === 'text'
                            ? 'bg-cyan-500/25 text-cyan-100'
                            : 'text-[#bfb9b1] hover:bg-slate-700/35 hover:text-slate-100',
                        ].join(' ')}
                      >
                        پیام سریع
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveComposerTab('sticker')}
                        data-testid="chat-composer-tab-sticker"
                        className={[
                          'rounded-md px-2.5 py-1.5 text-xs font-semibold transition',
                          activeComposerTab === 'sticker'
                            ? 'bg-cyan-500/25 text-cyan-100'
                            : 'text-[#bfb9b1] hover:bg-slate-700/35 hover:text-slate-100',
                        ].join(' ')}
                      >
                        استیکر
                      </button>
                    </div>
                  </div>

                  {activeComposerTab === 'text' ? (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {CHAT_QUICK_MESSAGES.map((message) => (
                        <button
                          key={message}
                          type="button"
                          onClick={() => void handleSendChat('text', message)}
                          disabled={isSendingChat || !session.color}
                          data-testid={`chat-quick-${message}`}
                          className="rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-2 py-1.5 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {message}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-1 overflow-x-auto pb-1">
                        {CHAT_STICKER_CATEGORIES.map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => setActiveStickerCategory(category.id)}
                            data-testid={`chat-sticker-category-${category.id}`}
                            className={[
                              'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                              activeStickerCategory === category.id
                                ? 'bg-emerald-500/25 text-emerald-100'
                                : 'bg-[#302c28] text-[#c9c2ba] hover:bg-[#393430] hover:text-slate-100',
                            ].join(' ')}
                          >
                            {category.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                        {selectedStickerCategory.stickers.map((sticker) => (
                          <button
                            key={sticker}
                            type="button"
                            onClick={() => void handleSendChat('sticker', sticker)}
                            disabled={isSendingChat || !session.color}
                            data-testid={`chat-sticker-${encodeURIComponent(sticker)}`}
                            className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-1 py-1.5 text-lg text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {sticker}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isSendingChat ? <p className="text-[11px] text-cyan-100/80">در حال ارسال...</p> : null}
                </div>
              ) : null}
            </section>
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
