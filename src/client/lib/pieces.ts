import { type Game, parseFen } from '../../engine';

export interface TrackedPiece {
  /** 棋子的起始位置，整盤棋都不變，讓 React 能為同一顆棋子做移動動畫。 */
  id: number;
  piece: number;
  square: number;
}

/** 回放棋譜，算出走完 `ply` 步時每顆棋子的位置。 */
export function trackPieces(game: Pick<Game, 'initialFen' | 'moves'>, ply: number): TrackedPiece[] {
  const { board } = parseFen(game.initialFen);
  const bySquare = new Map<number, TrackedPiece>();
  board.forEach((piece, square) => {
    if (piece !== 0) bySquare.set(square, { id: square, piece, square });
  });
  for (const move of game.moves.slice(0, ply)) {
    const moving = bySquare.get(move.from);
    if (!moving) continue;
    bySquare.delete(move.from);
    bySquare.set(move.to, { ...moving, square: move.to });
  }
  return [...bySquare.values()].sort((a, b) => a.id - b.id);
}

/** 走完 `ply` 步時的棋盤。 */
export function boardAt(game: Pick<Game, 'initialFen' | 'moves'>, ply: number): Int8Array {
  const { board } = parseFen(game.initialFen);
  for (const move of game.moves.slice(0, ply)) {
    board[move.to] = board[move.from]!;
    board[move.from] = 0;
  }
  return board;
}

/** 列出某方到目前為止吃掉的棋子。 */
export function capturedBy(game: Pick<Game, 'moves'>, side: 1 | -1, ply: number): number[] {
  return game.moves
    .slice(0, ply)
    .filter((move) => move.captured !== 0 && Math.sign(move.piece) === side)
    .map((move) => move.captured);
}
