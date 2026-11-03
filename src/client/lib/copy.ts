import { type Color, type EndReason, type Outcome } from '../../engine';

export const COLOR_NAME: Record<Color, string> = { red: '紅方', black: '黑方' };

const REASON_TEXT: Record<EndReason, string> = {
  checkmate: '絕殺',
  stalemate: '困斃，無子可走判負',
  'perpetual-check': '長將判負',
  repetition: '同一局面重複三次',
  'no-capture': '連續 60 回合沒有吃子',
  insufficient: '雙方都沒有能過河的棋子',
  resign: '對方認輸',
  timeout: '對方時間用完',
  agreement: '雙方同意和棋',
};

export const reasonText = (reason: EndReason): string => REASON_TEXT[reason];

/** 結果的標題。`you` 為本機玩家的顏色；同機對弈或觀戰時為 null。 */
export function outcomeTitle(outcome: Outcome, you: Color | null): string {
  if (!outcome.winner) return '和棋';
  if (!you) return `${COLOR_NAME[outcome.winner]}獲勝`;
  return outcome.winner === you ? '你贏了' : '這盤輸了';
}

export const formatClock = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
};
