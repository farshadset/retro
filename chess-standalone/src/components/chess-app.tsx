"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, Square } from "chess.js";

type GameMode = "local" | "bot";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

const PIECE_SYMBOL: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

function buildChessFromPgn(pgn: string): Chess {
  const chess = new Chess();
  if (pgn.trim()) {
    chess.loadPgn(pgn);
  }
  return chess;
}

function statusText(chess: Chess, mode: GameMode, botThinking: boolean): string {
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? "مات! مشکی برنده شد." : "مات! سفید برنده شد.";
  }
  if (chess.isStalemate()) return "پات شد.";
  if (chess.isDraw()) return "بازی مساوی شد.";
  if (botThinking) return "بات در حال فکر کردن...";

  const turnText = chess.turn() === "w" ? "سفید" : "مشکی";
  if (mode === "bot" && chess.turn() === "b") {
    return "نوبت بات (مشکی)";
  }
  return `نوبت ${turnText}`;
}

export function ChessApp() {
  const [mode, setMode] = useState<GameMode>("local");
  const [pgn, setPgn] = useState("");
  const [selected, setSelected] = useState<Square | null>(null);
  const [targets, setTargets] = useState<Square[]>([]);
  const [botThinking, setBotThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const botTimerRef = useRef<number | null>(null);

  const chess = useMemo(() => buildChessFromPgn(pgn), [pgn]);
  const status = statusText(chess, mode, botThinking);
  const history = chess.history();

  useEffect(() => {
    return () => {
      if (botTimerRef.current !== null) {
        window.clearTimeout(botTimerRef.current);
      }
    };
  }, []);

  const resetGame = (nextMode?: GameMode) => {
    if (botTimerRef.current !== null) {
      window.clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
    setPgn("");
    setSelected(null);
    setTargets([]);
    setBotThinking(false);
    setError(null);
    if (nextMode) setMode(nextMode);
  };

  const scheduleBotMove = (nextPgn: string) => {
    if (mode !== "bot") return;
    const nextChess = buildChessFromPgn(nextPgn);
    if (nextChess.turn() !== "b" || nextChess.isGameOver()) return;

    setBotThinking(true);
    botTimerRef.current = window.setTimeout(() => {
      const botChess = buildChessFromPgn(nextPgn);
      const legalMoves = botChess.moves({ verbose: true });
      if (legalMoves.length > 0 && !botChess.isGameOver()) {
        const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        botChess.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
        setPgn(botChess.pgn());
      }
      setBotThinking(false);
      botTimerRef.current = null;
    }, 500);
  };

  const tryMakeMove = (from: Square, to: Square) => {
    const nextChess = buildChessFromPgn(pgn);
    try {
      const move = nextChess.move({ from, to, promotion: "q" });
      if (!move) {
        setError("حرکت مجاز نیست.");
        return;
      }
      const nextPgn = nextChess.pgn();
      setPgn(nextPgn);
      setSelected(null);
      setTargets([]);
      setError(null);
      scheduleBotMove(nextPgn);
    } catch {
      setError("حرکت مجاز نیست.");
    }
  };

  const onSquareClick = (square: Square) => {
    if (chess.isGameOver() || botThinking) return;
    if (mode === "bot" && chess.turn() === "b") return;

    const piece = chess.get(square);
    const humanTurnColor = chess.turn();

    if (!selected) {
      if (!piece || piece.color !== humanTurnColor) return;
      setSelected(square);
      const legalTargets = chess.moves({ square, verbose: true }).map((move) => move.to as Square);
      setTargets(legalTargets);
      return;
    }

    if (square === selected) {
      setSelected(null);
      setTargets([]);
      return;
    }

    if (!targets.includes(square)) {
      if (piece && piece.color === humanTurnColor) {
        setSelected(square);
        const legalTargets = chess.moves({ square, verbose: true }).map((move) => move.to as Square);
        setTargets(legalTargets);
      } else {
        setSelected(null);
        setTargets([]);
      }
      return;
    }

    tryMakeMove(selected, square);
  };

  const undoMove = () => {
    if (botThinking) return;
    const nextChess = buildChessFromPgn(pgn);
    if (mode === "bot") {
      nextChess.undo();
      nextChess.undo();
    } else {
      nextChess.undo();
    }
    setPgn(nextChess.pgn());
    setSelected(null);
    setTargets([]);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#020617_70%)] px-3 py-5 text-slate-100 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-4 rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-xl backdrop-blur-sm">
          <h1 className="text-xl font-bold sm:text-2xl">Chess Standalone</h1>
          <p className="mt-1 text-sm text-slate-300">پروژه مستقل شطرنج برای دیپلوی سریع روی Vercel</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => resetGame("local")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mode === "local" ? "bg-cyan-400 text-slate-900" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              دو نفره (لوکال)
            </button>
            <button
              type="button"
              onClick={() => resetGame("bot")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mode === "bot" ? "bg-cyan-400 text-slate-900" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              بازی با بات
            </button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/75 p-3 shadow-lg">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm text-cyan-200">{status}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={undoMove}
                  disabled={history.length === 0 || botThinking}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={() => resetGame()}
                  className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  بازی جدید
                </button>
              </div>
            </div>

            <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-xl border border-slate-700/70">
              {RANKS.map((rank, rankIndex) =>
                FILES.map((file, fileIndex) => {
                  const square = `${file}${rank}` as Square;
                  const piece = chess.get(square);
                  const isDark = (rankIndex + fileIndex) % 2 === 1;
                  const isSelected = selected === square;
                  const isTarget = targets.includes(square);

                  return (
                    <button
                      key={square}
                      type="button"
                      onClick={() => onSquareClick(square)}
                      className={[
                        "relative flex items-center justify-center text-3xl transition sm:text-4xl",
                        isDark ? "bg-[#7a5a40]" : "bg-[#f2d7b4]",
                        isSelected ? "ring-2 ring-cyan-400 ring-inset" : "",
                        isTarget ? "after:absolute after:h-3 after:w-3 after:rounded-full after:bg-cyan-500/80" : "",
                      ].join(" ")}
                      aria-label={`square-${square}`}
                    >
                      {piece ? PIECE_SYMBOL[`${piece.color}${piece.type}`] : ""}
                    </button>
                  );
                })
              )}
            </div>

            {error ? <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p> : null}
          </div>

          <aside className="rounded-2xl border border-slate-700/60 bg-slate-900/75 p-4 shadow-lg">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-200">Move List</h2>
            <ol className="mt-3 max-h-[420px] space-y-2 overflow-y-auto text-sm">
              {history.length === 0 ? (
                <li className="rounded-lg bg-slate-800/60 px-3 py-2 text-slate-400">هنوز حرکتی ثبت نشده.</li>
              ) : (
                history.map((move, index) => (
                  <li key={`${move}-${index}`} className="rounded-lg bg-slate-800/70 px-3 py-2">
                    <span className="mr-1 text-slate-400">{index + 1}.</span>
                    <span>{move}</span>
                  </li>
                ))
              )}
            </ol>
          </aside>
        </section>
      </div>
    </main>
  );
}
