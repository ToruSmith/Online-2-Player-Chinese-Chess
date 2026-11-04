import { useEffect, useState } from 'react';
import { type Game, replay } from '../../engine';
import { type MoveQuality, judgeMoves } from '../../engine/ai/review';
import { askEvaluate } from './engineClient';

export interface ReviewState {
  status: 'idle' | 'running' | 'done';
  /** 已分析的局面數 */
  done: number;
  total: number;
  /** 第 i 個局面走子方視角的分數 */
  scores: (number | null)[];
  /** 第 i 個局面電腦建議的走法 */
  best: (number | null)[];
  /** 第 i 步的評語 */
  qualities: MoveQuality[];
}

const IDLE: ReviewState = {
  status: 'idle',
  done: 0,
  total: 0,
  scores: [],
  best: [],
  qualities: [],
};

const moveList = (game: Game, plies: number): [number, number][] =>
  game.moves.slice(0, plies).map((move) => [move.from, move.to]);

/** 逐一請 Worker 評估每個局面，離開頁面就停止。 */
export function useReview(game: Game | null): { review: ReviewState; start: () => void } {
  const [running, setRunning] = useState(false);
  const [review, setReview] = useState<ReviewState>(IDLE);

  useEffect(() => {
    if (!running || !game) return;
    let cancelled = false;
    const total = game.moves.length + 1;
    const scores: (number | null)[] = [];
    const best: (number | null)[] = [];

    const run = async (): Promise<void> => {
      for (let ply = 0; ply < total && !cancelled; ply += 1) {
        const line = { fen: game.initialFen, moves: moveList(game, ply) };
        const finished = replay(line.fen, line.moves).outcome !== null;
        const answer = finished ? null : await askEvaluate(line);
        if (cancelled) return;
        scores.push(answer?.score ?? null);
        best.push(answer?.move ?? null);
        const done = ply + 1 === total;
        setReview({
          status: done ? 'done' : 'running',
          done: ply + 1,
          total,
          scores: [...scores],
          best: [...best],
          qualities: done ? judgeMoves(scores) : [],
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [running, game]);

  return { review, start: () => setRunning(true) };
}
