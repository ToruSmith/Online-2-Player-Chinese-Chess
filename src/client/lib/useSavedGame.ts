import { useCallback, useEffect, useState } from 'react';
import { type Game, createGame, playMove, replay, takeBack } from '../../engine';
import { readJson, removeKey, writeJson } from './storage';

interface SavedGame<M> {
  fen: string;
  moves: [number, number][];
  meta: M;
}

export function loadSavedGame<M>(key: string): { game: Game; meta: M } | null {
  const saved = readJson<SavedGame<M> | null>(key, null);
  if (!saved) return null;
  try {
    return { game: replay(saved.fen, saved.moves), meta: saved.meta };
  } catch {
    removeKey(key);
    return null;
  }
}

export const clearSavedGame = removeKey;

/** 管理一盤本機對局，並把進度存起來，下次打開可以接著下。 */
export function useLocalGame<M>(key: string, initial: Game, meta: M) {
  const [game, setGame] = useState(initial);

  useEffect(() => {
    if (game.outcome) {
      removeKey(key);
      return;
    }
    const saved: SavedGame<M> = {
      fen: game.initialFen,
      moves: game.moves.map((move) => [move.from, move.to]),
      meta,
    };
    writeJson(key, saved);
  }, [game, key, meta]);

  const play = useCallback((from: number, to: number) => {
    setGame((current) => playMove(current, from, to) ?? current);
  }, []);
  const undo = useCallback((plies: number) => {
    setGame((current) => takeBack(current, plies));
  }, []);
  const restart = useCallback((fen: string) => setGame(createGame(fen)), []);

  return { game, setGame, play, undo, restart };
}
