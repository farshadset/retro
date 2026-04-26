type StoreMode = 'memory' | 'redis'

function parseStoreMode(rawMode: string | undefined): StoreMode {
  const normalized = (rawMode ?? 'memory').toLowerCase()
  if (normalized === 'memory' || normalized === 'redis') {
    return normalized
  }
  throw new Error(`Invalid CHESS_STORE_MODE "${rawMode}". Use "memory" or "redis".`)
}

function parsePositiveInt(rawValue: string | undefined): number | null {
  if (!rawValue) return null
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return null
  if (value <= 0) return null
  return Math.floor(value)
}

export interface ChessRuntimeConfig {
  storeMode: StoreMode
  enforceSingleInstance: boolean
  redisUrl: string | null
  webConcurrency: number | null
  roomStoreMaxRooms: number
  roomStoreTtlMs: number
}

let cachedConfig: ChessRuntimeConfig | null = null

export function getChessRuntimeConfig(): ChessRuntimeConfig {
  if (cachedConfig) return cachedConfig

  const roomStoreMaxRooms = parsePositiveInt(process.env.CHESS_ROOM_STORE_MAX_ROOMS) ?? 500
  const roomStoreTtlMs = parsePositiveInt(process.env.CHESS_ROOM_STORE_TTL_MS) ?? 6 * 60 * 60 * 1000

  cachedConfig = {
    storeMode: parseStoreMode(process.env.CHESS_STORE_MODE),
    enforceSingleInstance: process.env.CHESS_ENFORCE_SINGLE_INSTANCE !== 'false',
    redisUrl: process.env.REDIS_URL?.trim() || null,
    webConcurrency: parsePositiveInt(process.env.WEB_CONCURRENCY),
    roomStoreMaxRooms,
    roomStoreTtlMs,
  }

  return cachedConfig
}

export function assertChessRuntimeSafety(): void {
  const config = getChessRuntimeConfig()
  if (process.env.NODE_ENV !== 'production') return

  if (config.storeMode === 'redis') {
    if (!config.redisUrl) {
      throw new Error('CHESS_STORE_MODE=redis requires REDIS_URL to be set.')
    }
    throw new Error(
      'CHESS_STORE_MODE=redis is reserved for the scale-out migration phase. For ParsPack startup deployment use CHESS_STORE_MODE=memory.'
    )
  }

  if (!config.enforceSingleInstance) {
    return
  }

  if (config.webConcurrency !== null && config.webConcurrency > 1) {
    throw new Error(
      'Memory chess store cannot run with WEB_CONCURRENCY > 1. Set WEB_CONCURRENCY=1 or switch CHESS_STORE_MODE=redis.'
    )
  }

  const pm2InstanceId = parsePositiveInt(process.env.NODE_APP_INSTANCE)
  if (pm2InstanceId !== null && pm2InstanceId > 0) {
    throw new Error(
      'Memory chess store detected multiple PM2 instances. Keep a single instance or migrate to CHESS_STORE_MODE=redis.'
    )
  }
}
