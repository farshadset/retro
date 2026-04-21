'use client'

interface MoveListProps {
  moves: string[]
}

export function MoveList({ moves }: MoveListProps) {
  return (
    <div className="w-full rounded-xl border border-slate-700 bg-slate-900/70 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Move list</h3>
      {moves.length === 0 ? (
        <p className="text-sm text-slate-400">No moves yet.</p>
      ) : (
        <ol className="grid max-h-44 grid-cols-2 gap-x-6 gap-y-1 overflow-y-auto pr-1 text-sm text-slate-200">
          {moves.map((move, index) => (
            <li key={`${move}-${index}`} className="flex items-baseline gap-2">
              <span className="w-7 text-xs text-slate-500">{index + 1}.</span>
              <span>{move}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
