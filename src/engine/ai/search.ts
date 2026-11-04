import { CANNON, CHARIOT, HORSE, RED, SQUARES, type Side, sideOf } from '../constants';
import { type Game, playMove } from '../game';
import { generatePseudoMoves, isInCheck, legalMoves, moveFrom, moveTo } from '../moves';
import { MATERIAL, PIECE_SQUARE, evaluateBoard } from './evaluation';

export const MATE = 30000;
const MATE_BOUND = MATE - 200;
const INFINITY = 32000;
const MAX_PLY = 96;
const TABLE_BITS = 18;
const TABLE_SIZE = 1 << TABLE_BITS;
const REPETITION_WINDOW = 24;

const EXACT = 1;
const LOWER = 2;
const UPPER = 3;

const TT_MOVE_SCORE = 1 << 28;
const CAPTURE_SCORE = 1 << 24;
const KILLER_SCORE = 1 << 23;

/** 固定種子的亂數鍵，讓搜尋結果可重現。 */
const zobrist = (() => {
  let state = 0x9e3779b9;
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state | 0;
  };
  const low = new Int32Array(15 * SQUARES);
  const high = new Int32Array(15 * SQUARES);
  for (let index = 0; index < low.length; index += 1) {
    low[index] = next();
    high[index] = next();
  }
  return { low, high, sideLow: next(), sideHigh: next() };
})();

export interface SearchLimits {
  maxDepth: number;
  timeMs: number;
  /** 根節點不考慮的走法。 */
  excluded?: readonly number[];
  /** 與最佳分差距在此範圍內的走法都可能被選中，用來降低棋力。 */
  noise?: number;
  random?: () => number;
}

export interface SearchResult {
  move: number;
  score: number;
  depth: number;
  nodes: number;
}

class Search {
  private readonly board: Int8Array;
  private side: Side;
  private material: number;
  private hashLow = 0;
  private hashHigh = 0;
  private readonly hashStack: number[] = [];
  private nodes = 0;
  private stopped = false;
  private deadline = 0;

  private readonly tableLow = new Int32Array(TABLE_SIZE);
  private readonly tableHigh = new Int32Array(TABLE_SIZE);
  private readonly tableData = new Int32Array(TABLE_SIZE);
  private readonly tableScore = new Int16Array(TABLE_SIZE);

  private readonly history = new Int32Array(SQUARES * SQUARES);
  private readonly killers = new Int32Array(MAX_PLY * 2 + 2).fill(-1);
  private readonly moveLists: number[][] = Array.from({ length: MAX_PLY + 2 }, () => []);
  private readonly scoreLists: number[][] = Array.from({ length: MAX_PLY + 2 }, () => []);

  constructor(board: Int8Array, side: Side, previousPositions: readonly number[]) {
    this.board = board.slice();
    this.side = side;
    this.material = evaluateBoard(board);
    for (let square = 0; square < SQUARES; square += 1) {
      const piece = this.board[square]!;
      if (piece !== 0) this.togglePiece(piece, square);
    }
    if (side !== RED) this.toggleSide();
    this.hashStack.push(...previousPositions);
  }

  private togglePiece(piece: number, square: number): void {
    const index = (piece + 7) * SQUARES + square;
    this.hashLow ^= zobrist.low[index]!;
    this.hashHigh ^= zobrist.high[index]!;
  }

  private toggleSide(): void {
    this.hashLow ^= zobrist.sideLow;
    this.hashHigh ^= zobrist.sideHigh;
  }

  private make(move: number): number {
    const from = moveFrom(move);
    const to = moveTo(move);
    const piece = this.board[from]!;
    const captured = this.board[to]!;
    this.hashStack.push(this.hashLow);

    this.togglePiece(piece, from);
    this.material -= PIECE_SQUARE[(piece + 7) * SQUARES + from]!;
    if (captured !== 0) {
      this.togglePiece(captured, to);
      this.material -= PIECE_SQUARE[(captured + 7) * SQUARES + to]!;
    }
    this.togglePiece(piece, to);
    this.material += PIECE_SQUARE[(piece + 7) * SQUARES + to]!;
    this.board[to] = piece;
    this.board[from] = 0;
    this.toggleSide();
    this.side = -this.side as Side;
    return captured;
  }

  private unmake(move: number, captured: number): void {
    const from = moveFrom(move);
    const to = moveTo(move);
    const piece = this.board[to]!;
    this.side = -this.side as Side;
    this.toggleSide();
    this.togglePiece(piece, to);
    this.material -= PIECE_SQUARE[(piece + 7) * SQUARES + to]!;
    if (captured !== 0) {
      this.togglePiece(captured, to);
      this.material += PIECE_SQUARE[(captured + 7) * SQUARES + to]!;
    }
    this.togglePiece(piece, from);
    this.material += PIECE_SQUARE[(piece + 7) * SQUARES + from]!;
    this.board[from] = piece;
    this.board[to] = captured;
    this.hashStack.pop();
  }

  private passTurn(): void {
    this.hashStack.push(this.hashLow);
    this.toggleSide();
    this.side = -this.side as Side;
  }

  private undoPass(): void {
    this.side = -this.side as Side;
    this.toggleSide();
    this.hashStack.pop();
  }

  private isRepetition(): boolean {
    const stack = this.hashStack;
    for (
      let index = stack.length - 2;
      index >= 0 && index >= stack.length - REPETITION_WINDOW;
      index -= 2
    ) {
      if (stack[index] === this.hashLow) return true;
    }
    return false;
  }

  private shouldStop(): boolean {
    if (!this.stopped && (this.nodes & 2047) === 0 && Date.now() >= this.deadline) {
      this.stopped = true;
    }
    return this.stopped;
  }

  private evaluate(): number {
    return this.side * this.material + 3;
  }

  private hasMajorPiece(): boolean {
    for (let square = 0; square < SQUARES; square += 1) {
      const piece = this.board[square]! * this.side;
      if (piece === CHARIOT || piece === CANNON || piece === HORSE) return true;
    }
    return false;
  }

  private orderMoves(moves: number[], scores: number[], ply: number, ttMove: number): void {
    scores.length = moves.length;
    for (let index = 0; index < moves.length; index += 1) {
      const move = moves[index]!;
      const victim = this.board[moveTo(move)]!;
      if (move === ttMove) {
        scores[index] = TT_MOVE_SCORE;
      } else if (victim !== 0) {
        const attacker = Math.abs(this.board[moveFrom(move)]!);
        scores[index] = CAPTURE_SCORE + MATERIAL[Math.abs(victim)]! * 16 - MATERIAL[attacker]!;
      } else if (move === this.killers[ply * 2] || move === this.killers[ply * 2 + 1]) {
        scores[index] = KILLER_SCORE;
      } else {
        scores[index] = this.history[moveFrom(move) * SQUARES + moveTo(move)]!;
      }
    }
  }

  /** 把剩餘走法中分數最高的換到 `index`。 */
  private pickNext(moves: number[], scores: number[], index: number): number {
    let best = index;
    for (let other = index + 1; other < moves.length; other += 1) {
      if (scores[other]! > scores[best]!) best = other;
    }
    const move = moves[best]!;
    moves[best] = moves[index]!;
    moves[index] = move;
    const score = scores[best]!;
    scores[best] = scores[index]!;
    scores[index] = score;
    return move;
  }

  private quiescence(alpha: number, beta: number, ply: number): number {
    this.nodes += 1;
    if (this.shouldStop()) return 0;
    const side = this.side;
    const inCheck = isInCheck(this.board, side);
    if (!inCheck) {
      const standPat = this.evaluate();
      if (standPat >= beta) return standPat;
      if (standPat > alpha) alpha = standPat;
    }
    if (ply >= MAX_PLY) return this.evaluate();

    const moves = this.moveLists[ply]!;
    const scores = this.scoreLists[ply]!;
    moves.length = 0;
    generatePseudoMoves(this.board, side, moves, !inCheck);
    this.orderMoves(moves, scores, ply, -1);

    let best = inCheck ? -MATE + ply : alpha;
    for (let index = 0; index < moves.length; index += 1) {
      const move = this.pickNext(moves, scores, index);
      const captured = this.make(move);
      if (isInCheck(this.board, side)) {
        this.unmake(move, captured);
        continue;
      }
      const score = -this.quiescence(-beta, -alpha, ply + 1);
      this.unmake(move, captured);
      if (this.stopped) return 0;
      if (score > best) best = score;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return best;
  }

  private negamax(
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
    allowNull: boolean,
  ): number {
    this.nodes += 1;
    if (this.shouldStop()) return 0;
    if (ply > 0 && this.isRepetition()) return 0;
    if (ply >= MAX_PLY) return this.evaluate();

    const side = this.side;
    const inCheck = isInCheck(this.board, side);
    if (inCheck) depth += 1;
    if (depth <= 0) return this.quiescence(alpha, beta, ply);

    const slot = this.hashLow & (TABLE_SIZE - 1);
    const hit = this.tableLow[slot] === this.hashLow && this.tableHigh[slot] === this.hashHigh;
    const data = hit ? this.tableData[slot]! : 0;
    const ttMove = hit ? (data >> 8) - 1 : -1;
    if (hit && ply > 0 && (data & 0x3f) >= depth) {
      let stored = this.tableScore[slot]!;
      if (stored > MATE_BOUND) stored -= ply;
      else if (stored < -MATE_BOUND) stored += ply;
      const flag = (data >> 6) & 3;
      if (flag === EXACT) return stored;
      if (flag === LOWER && stored >= beta) return stored;
      if (flag === UPPER && stored <= alpha) return stored;
    }

    if (allowNull && !inCheck && depth >= 3 && beta < MATE_BOUND && this.hasMajorPiece()) {
      this.passTurn();
      const score = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
      this.undoPass();
      if (this.stopped) return 0;
      if (score >= beta) return score;
    }

    const moves = this.moveLists[ply]!;
    const scores = this.scoreLists[ply]!;
    moves.length = 0;
    generatePseudoMoves(this.board, side, moves);
    this.orderMoves(moves, scores, ply, ttMove);

    const originalAlpha = alpha;
    let best = -INFINITY;
    let bestMove = -1;
    let legal = 0;

    for (let index = 0; index < moves.length; index += 1) {
      const move = this.pickNext(moves, scores, index);
      const captured = this.make(move);
      if (isInCheck(this.board, side)) {
        this.unmake(move, captured);
        continue;
      }
      legal += 1;
      let score: number;
      if (legal === 1) {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && score < beta) {
          score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
        }
      }
      this.unmake(move, captured);
      if (this.stopped) return 0;

      if (score > best) {
        best = score;
        bestMove = move;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (captured === 0) {
          if (this.killers[ply * 2] !== move) {
            this.killers[ply * 2 + 1] = this.killers[ply * 2]!;
            this.killers[ply * 2] = move;
          }
          this.history[moveFrom(move) * SQUARES + moveTo(move)]! += depth * depth;
        }
        break;
      }
    }

    // 中國象棋沒有逼和：無路可走就是輸。
    if (legal === 0) return -MATE + ply;

    const flag = best <= originalAlpha ? UPPER : best >= beta ? LOWER : EXACT;
    let stored = best;
    if (stored > MATE_BOUND) stored += ply;
    else if (stored < -MATE_BOUND) stored -= ply;
    this.tableLow[slot] = this.hashLow;
    this.tableHigh[slot] = this.hashHigh;
    this.tableData[slot] = ((bestMove + 1) << 8) | (flag << 6) | Math.min(depth, 63);
    this.tableScore[slot] = stored;
    return best;
  }

  run(rootMoves: readonly number[], limits: SearchLimits): SearchResult {
    this.deadline = Date.now() + limits.timeMs;
    const noise = limits.noise ?? 0;
    const random = limits.random ?? Math.random;
    let ordered = [...rootMoves];
    let result: SearchResult = { move: ordered[0]!, score: 0, depth: 0, nodes: 0 };

    for (let depth = 1; depth <= limits.maxDepth; depth += 1) {
      const scored: { move: number; score: number }[] = [];
      let alpha = -INFINITY;
      for (const move of ordered) {
        const captured = this.make(move);
        // 需要隨機選擇時，每個走法都要算出確切分數。
        const score = -this.negamax(depth - 1, -INFINITY, noise > 0 ? INFINITY : -alpha, 1, true);
        this.unmake(move, captured);
        if (this.stopped) break;
        scored.push({ move, score });
        if (score > alpha) alpha = score;
      }
      if (this.stopped && scored.length === 0) break;

      // 中途逾時仍可使用已搜尋的部分，因為上一層的最佳走法排在最前面。
      scored.sort((a, b) => b.score - a.score);
      const top = scored[0]!;
      const pool = noise > 0 ? scored.filter((item) => item.score >= top.score - noise) : [top];
      const chosen = pool[Math.floor(random() * pool.length)]!;
      result = { move: chosen.move, score: chosen.score, depth, nodes: this.nodes };

      if (this.stopped) break;
      const searched = new Set(scored.map((item) => item.move));
      ordered = [
        ...scored.map((item) => item.move),
        ...ordered.filter((move) => !searched.has(move)),
      ];
      if (Math.abs(top.score) > MATE_BOUND) break;
    }
    result.nodes = this.nodes;
    return result;
  }
}

function hashPosition(board: Int8Array, side: Side): number {
  let hash = side === RED ? 0 : zobrist.sideLow;
  for (let square = 0; square < SQUARES; square += 1) {
    const piece = board[square]!;
    if (piece !== 0) hash ^= zobrist.low[(piece + 7) * SQUARES + square]!;
  }
  return hash;
}

/** 由目前局面倒推最近幾步的局面雜湊值，讓搜尋能避開重複局面。 */
function recentPositionHashes(game: Game): number[] {
  const hashes: number[] = [];
  const board = game.board.slice();
  let side = sideOf(game.turn);
  const oldest = Math.max(0, game.moves.length - REPETITION_WINDOW);
  for (let index = game.moves.length - 1; index >= oldest; index -= 1) {
    const move = game.moves[index]!;
    board[move.from] = move.piece;
    board[move.to] = move.captured;
    side = -side as Side;
    hashes.unshift(hashPosition(board, side));
  }
  return hashes;
}

/**
 * 為目前局面找出一步棋。會避開立刻造成判負的走法（例如長將），
 * 除非已經沒有別的選擇。
 */
export function searchBestMove(game: Game, limits: SearchLimits): SearchResult | null {
  const side = sideOf(game.turn);
  const legal = legalMoves(game.board, side);
  if (legal.length === 0) return null;

  const excluded = new Set(limits.excluded ?? []);
  const safe = legal.filter((move) => {
    if (excluded.has(move)) return false;
    const next = playMove(game, moveFrom(move), moveTo(move));
    const reason = next?.outcome?.reason;
    return reason !== 'perpetual-check' && reason !== 'perpetual-chase';
  });
  const candidates = safe.length > 0 ? safe : legal;
  if (candidates.length === 1) {
    return { move: candidates[0]!, score: 0, depth: 0, nodes: 0 };
  }
  return new Search(game.board, side, recentPositionHashes(game)).run(candidates, limits);
}
