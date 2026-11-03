import type { LevelId } from '../../engine/ai/levels';
import type { EngineRequest, EngineResponse } from './engineProtocol';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (move: number | null) => void>();

function engine(): Worker {
  if (worker) return worker;
  worker = new Worker(__ENGINE_WORKER_URL__, { type: 'module' });
  worker.onmessage = (event: MessageEvent<EngineResponse>) => {
    pending.get(event.data.id)?.(event.data.result);
    pending.delete(event.data.id);
  };
  return worker;
}

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

function ask(request: WithoutId<EngineRequest>): Promise<number | null> {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    engine().postMessage({ ...request, id } as EngineRequest);
  });
}

type Line = { fen: string; moves: [number, number][] };

export const askMove = (line: Line, level: LevelId) => ask({ type: 'move', ...line, level });
export const askHint = (line: Line) => ask({ type: 'hint', ...line });
/** 回傳 1 代表這一步仍能在剩餘步數內取勝。 */
export const askPuzzleCheck = (line: Line, left: number) =>
  ask({ type: 'puzzle-check', ...line, left });
export const askPuzzleReply = (line: Line, left: number) =>
  ask({ type: 'puzzle-reply', ...line, left });
export const askPuzzleHint = (line: Line, left: number) =>
  ask({ type: 'puzzle-hint', ...line, left });

/** 把對局轉成可以傳給 Worker 的形式。 */
export const toLine = (game: {
  initialFen: string;
  moves: readonly { from: number; to: number }[];
}): Line => ({
  fen: game.initialFen,
  moves: game.moves.map((move) => [move.from, move.to]),
});
