import { replay, sideOf } from '../engine';
import { HINT_LIMITS, chooseMove, levelById } from '../engine/ai/levels';
import { searchBestMove } from '../engine/ai/search';
import { defenderIsLost, toughestDefense, winningMoves } from '../engine/ai/solver';
import type { EngineRequest, EngineResponse } from './lib/engineProtocol';

/** AI 與殘局求解都在 Worker 中執行，避免卡住畫面。 */
function handle(request: EngineRequest): number | null {
  const game = replay(request.fen, request.moves);
  switch (request.type) {
    case 'move':
      return chooseMove(game, levelById(request.level))?.move ?? null;
    case 'hint':
      return searchBestMove(game, HINT_LIMITS)?.move ?? null;
    case 'puzzle-check':
      return defenderIsLost(game.board.slice(), sideOf(game.turn), request.left) ? 1 : 0;
    case 'puzzle-reply':
      return toughestDefense(game, request.left);
    case 'puzzle-hint':
      return winningMoves(game, request.left)[0] ?? null;
  }
}

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const response: EngineResponse = { id: event.data.id, result: handle(event.data) };
  self.postMessage(response);
};
