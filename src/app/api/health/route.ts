import { describeStoreMode } from '@/lib/chess/room-store'
import { getChessRuntimeConfig } from '@/lib/chess/runtime-config'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const runtime = getChessRuntimeConfig()
  const store = describeStoreMode()
  return Response.json({
    ok: true,
    now: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
    runtime: {
      storeMode: store.storeMode,
      singleInstanceOnly: store.singleInstanceOnly,
      enforceSingleInstance: runtime.enforceSingleInstance,
      webConcurrency: runtime.webConcurrency,
      roomStoreMaxRooms: runtime.roomStoreMaxRooms,
      roomStoreTtlMs: runtime.roomStoreTtlMs,
      redisConfigured: Boolean(runtime.redisUrl),
    },
  })
}
