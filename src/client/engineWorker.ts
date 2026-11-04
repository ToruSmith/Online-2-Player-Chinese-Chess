import { replay, sideOf } from '../engine';
import { HINT_LIMITS, chooseMove, levelById } from '../engine/ai/levels';
import { searchBestMove } from '../engine/ai/search';
import { defenderIsLost, toughestDefense, winningMoves } from '../engine/ai/solver';
import type { EngineRequest, EngineResponse } from './lib/engineProtocol';

/** 賽後分析每個局面思考的時間 */
const REVIEW_LIMITS = { maxDepth: 32, timeMs: 200 };

/** AI 與殘局求解都在 Worker 中執行，避免卡住畫面。 */
function handle(request: Exclude<EngineRequest, { type: 'evaluate' }>): number | null {
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
  const request = event.data;
  if (request.type === 'evaluate') {
    const found = searchBestMove(replay(request.fen, request.moves), REVIEW_LIMITS);
    // depth 0 代表只有一種走法，沒有真的搜尋，分數沒有意義
    const score = found && found.depth > 0 ? found.score : null;
    const response: EngineResponse = { id: request.id, result: found?.move ?? null, score };
    self.postMessage(response);
    return;
  }
  const response: EngineResponse = { id: request.id, result: handle(request) };
  self.postMessage(response);
};
