import type { LevelId } from '../../engine/ai/levels';

interface Line {
  id: number;
  fen: string;
  moves: [number, number][];
}

export type EngineRequest =
  | (Line & { type: 'move'; level: LevelId })
  | (Line & { type: 'hint' })
  | (Line & { type: 'puzzle-check' | 'puzzle-reply' | 'puzzle-hint'; left: number });

export interface EngineResponse {
  id: number;
  result: number | null;
}
