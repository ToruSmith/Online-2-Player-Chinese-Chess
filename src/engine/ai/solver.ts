import { type Side, sideOf } from '../constants';
import type { Game } from '../game';
import { isInCheck, legalMoves, moveFrom, moveTo } from '../moves';

/**
 * 殘局專用的窮舉求解器。和 AI 的搜尋不同，它不做任何剪枝假設，
 * 因此「N 步殺」的結論是可以信任的。無子可走也算獲勝。
 */

function withMove<T>(board: Int8Array, move: number, run: () => T): T {
  const from = moveFrom(move);
  const to = moveTo(move);
  const piece = board[from]!;
  const captured = board[to]!;
  board[to] = piece;
  board[from] = 0;
  const result = run();
  board[from] = piece;
  board[to] = captured;
  return result;
}

/** 先試將軍的走法，大幅加快找到殺棋的速度。 */
function attackingOrder(board: Int8Array, side: Side, moves: number[]): number[] {
  const checks: number[] = [];
  const quiet: number[] = [];
  for (const move of moves) {
    const givesCheck = withMove(board, move, () => isInCheck(board, -side as Side));
    (givesCheck ? checks : quiet).push(move);
  }
  return [...checks, ...quiet];
}

/** 輪到防守方：是否不論怎麼應，攻方都能在 `moves` 步內取勝。 */
export function defenderIsLost(board: Int8Array, defender: Side, moves: number): boolean {
  const replies = legalMoves(board, defender);
  if (replies.length === 0) return true;
  if (moves <= 0) return false;
  const attacker = -defender as Side;
  return replies.every((reply) =>
    withMove(board, reply, () => canForceWin(board, attacker, moves)),
  );
}

/** 輪到攻方：是否能在 `moves` 步內強迫取勝。 */
export function canForceWin(board: Int8Array, attacker: Side, moves: number): boolean {
  if (moves <= 0) return false;
  const defender = -attacker as Side;
  return attackingOrder(board, attacker, legalMoves(board, attacker)).some((move) =>
    withMove(board, move, () => defenderIsLost(board, defender, moves - 1)),
  );
}

/** 列出所有能在 `moves` 步內取勝的第一步。 */
export function winningMoves(game: Game, moves: number): number[] {
  const board = game.board.slice();
  const attacker = sideOf(game.turn);
  const defender = -attacker as Side;
  return legalMoves(board, attacker).filter((move) =>
    withMove(board, move, () => defenderIsLost(board, defender, moves - 1)),
  );
}

/** 防守方能撐最久的應著；已無棋可走時回傳 null。 */
export function toughestDefense(game: Game, moves: number): number | null {
  const board = game.board.slice();
  const defender = sideOf(game.turn);
  const attacker = -defender as Side;
  const replies = legalMoves(board, defender);
  if (replies.length === 0) return null;

  let best = replies[0]!;
  let longest = -1;
  for (const reply of replies) {
    const length = withMove(board, reply, () => {
      for (let n = 1; n <= moves; n += 1) {
        if (canForceWin(board, attacker, n)) return n;
      }
      return moves + 1;
    });
    if (length > longest) {
      longest = length;
      best = reply;
    }
  }
  return best;
}
