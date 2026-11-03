import { encodeMove } from '../moves';
import { INITIAL_FEN, toSquare } from '../constants';
import { parseFen, toFen } from '../fen';
import type { Game } from '../game';
import { legalMovesOf } from '../game';
import { type SearchResult, searchBestMove } from './search';

export type LevelId = 'sprout' | 'beginner' | 'club' | 'expert' | 'master';

export interface Level {
  id: LevelId;
  name: string;
  description: string;
  maxDepth: number;
  timeMs: number;
  noise: number;
  /** 完全亂走一步的機率，讓初學者有機會贏。 */
  blunderRate: number;
}

export const LEVELS: readonly Level[] = [
  {
    id: 'sprout',
    name: '小樹苗',
    description: '剛學會走棋，常常漏看，適合第一次下棋',
    maxDepth: 1,
    timeMs: 200,
    noise: 45,
    blunderRate: 0.25,
  },
  {
    id: 'beginner',
    name: '小學徒',
    description: '會吃子也會逃跑，但看不遠',
    maxDepth: 2,
    timeMs: 300,
    noise: 20,
    blunderRate: 0.06,
  },
  {
    id: 'club',
    name: '棋友',
    description: '公園棋友的程度，會設簡單的陷阱',
    maxDepth: 4,
    timeMs: 800,
    noise: 6,
    blunderRate: 0,
  },
  {
    id: 'expert',
    name: '高手',
    description: '思考約兩秒，需要認真應付',
    maxDepth: 32,
    timeMs: 2000,
    noise: 0,
    blunderRate: 0,
  },
  {
    id: 'master',
    name: '棋王',
    description: '思考約五秒，全力以赴',
    maxDepth: 32,
    timeMs: 5000,
    noise: 0,
    blunderRate: 0,
  },
];

export const levelById = (id: LevelId): Level =>
  LEVELS.find((level) => level.id === id) ?? LEVELS[0]!;

/** 提示功能使用的搜尋設定。 */
export const HINT_LIMITS = { maxDepth: 32, timeMs: 1200 };

const OPENING_MOVES = [
  encodeMove(toSquare(7, 7), toSquare(4, 7)), // 中炮
  encodeMove(toSquare(7, 9), toSquare(6, 7)), // 起馬
  encodeMove(toSquare(6, 9), toSquare(4, 7)), // 飛相
  encodeMove(toSquare(2, 6), toSquare(2, 5)), // 仙人指路
];
const STANDARD_START = toFen(parseFen(INITIAL_FEN).board, 'red');

export function chooseMove(
  game: Game,
  level: Level,
  random: () => number = Math.random,
): SearchResult | null {
  const moves = legalMovesOf(game);
  if (moves.length === 0) return null;

  if (game.moves.length === 0 && game.initialFen === STANDARD_START) {
    const move = OPENING_MOVES[Math.floor(random() * OPENING_MOVES.length)]!;
    return { move, score: 0, depth: 0, nodes: 0 };
  }
  if (level.blunderRate > 0 && random() < level.blunderRate) {
    const move = moves[Math.floor(random() * moves.length)]!;
    return { move, score: 0, depth: 0, nodes: 0 };
  }
  return searchBestMove(game, {
    maxDepth: level.maxDepth,
    timeMs: level.timeMs,
    noise: level.noise,
    random,
  });
}
