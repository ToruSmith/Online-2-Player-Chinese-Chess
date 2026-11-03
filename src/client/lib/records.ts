import type { Color, EndReason, Game } from '../../engine';
import { readJson, writeJson } from './storage';

export type RecordMode = 'online' | 'ai' | 'local';

export interface GameRecord {
  id: string;
  playedAt: number;
  mode: RecordMode;
  red: string;
  black: string;
  initialFen: string;
  moves: [number, number][];
  winner: Color | null;
  reason: EndReason;
  /** 從本機玩家的角度看的結果；同機對弈時沒有。 */
  yourColor: Color | null;
}

const KEY = 'xiangqi.records';
const MAX_RECORDS = 50;

export const loadRecords = (): GameRecord[] => readJson<GameRecord[]>(KEY, []);
export const findRecord = (id: string): GameRecord | undefined =>
  loadRecords().find((record) => record.id === id);

interface SaveInput {
  id: string;
  mode: RecordMode;
  red: string;
  black: string;
  yourColor: Color | null;
  game: Game;
}

/** 儲存結束的對局。相同 id 只會留一筆，所以重複呼叫也安全。 */
export function saveRecord({ id, mode, red, black, yourColor, game }: SaveInput): void {
  if (!game.outcome || game.moves.length === 0) return;
  const record: GameRecord = {
    id,
    playedAt: Date.now(),
    mode,
    red,
    black,
    initialFen: game.initialFen,
    moves: game.moves.map((move) => [move.from, move.to]),
    winner: game.outcome.winner,
    reason: game.outcome.reason,
    yourColor,
  };
  const others = loadRecords().filter((item) => item.id !== id);
  writeJson(KEY, [record, ...others].slice(0, MAX_RECORDS));
}

export function deleteRecord(id: string): void {
  writeJson(
    KEY,
    loadRecords().filter((record) => record.id !== id),
  );
}

const PUZZLE_KEY = 'xiangqi.puzzles';

export const solvedPuzzles = (): string[] => readJson<string[]>(PUZZLE_KEY, []);

export function markPuzzleSolved(id: string): void {
  const solved = new Set(solvedPuzzles());
  solved.add(id);
  writeJson(PUZZLE_KEY, [...solved]);
}
