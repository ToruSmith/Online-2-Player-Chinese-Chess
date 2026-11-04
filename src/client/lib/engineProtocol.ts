import type { LevelId } from '../../engine/ai/levels';

interface Line {
  id: number;
  fen: string;
  moves: [number, number][];
}

export type EngineRequest =
  | (Line & { type: 'move'; level: LevelId })
  | (Line & { type: 'hint' })
  | (Line & { type: 'evaluate' })
  | (Line & { type: 'puzzle-check' | 'puzzle-reply' | 'puzzle-hint'; left: number });

export interface EngineResponse {
  id: number;
  result: number | null;
  /** 只有 evaluate 才有：走子方視角的局面分；沒有其他選擇時為 null。 */
  score?: number | null;
}
