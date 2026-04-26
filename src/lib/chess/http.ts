import { ChessApiError } from './room-store'

export function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, { status })
}

export async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ChessApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.')
  }
}

export function asApiError(error: unknown): ChessApiError {
  if (error instanceof ChessApiError) return error
  return new ChessApiError(500, 'INTERNAL_ERROR', 'Unexpected server error.')
}
