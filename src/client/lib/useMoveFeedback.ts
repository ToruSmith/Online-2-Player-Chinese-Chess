import { useEffect, useRef } from 'react';
import type { Color, Game } from '../../engine';
import { playSound } from './sound';

/** 棋局有變化時播放對應的音效。悔棋與載入舊局時保持安靜。 */
export function useMoveFeedback(game: Game, you: Color | null): void {
  const seen = useRef(game.moves.length);
  const ended = useRef(Boolean(game.outcome));

  useEffect(() => {
    const count = game.moves.length;
    if (count > seen.current) {
      const move = game.moves[count - 1]!;
      if (!game.outcome) playSound(move.check ? 'check' : move.captured ? 'capture' : 'move');
    }
    seen.current = count;

    const finished = Boolean(game.outcome);
    if (finished && !ended.current) {
      const lost = you !== null && game.outcome?.winner !== null && game.outcome?.winner !== you;
      playSound(lost ? 'lose' : 'win');
    }
    ended.current = finished;
  }, [game, you]);
}
