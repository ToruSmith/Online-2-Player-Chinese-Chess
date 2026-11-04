import { MATE } from './search';

/** 賽後分析：比較走子前後的局面分，判斷每一步的好壞。 */
export type MoveQuality = 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/** 分數以一個兵約 20 分計，車約 210 分。 */
const INACCURACY = 40;
const MISTAKE = 90;
const BLUNDER = 180;
/** 將死的分數很大，先壓到這個範圍，勝率與差距才有意義。 */
const SCORE_CAP = 600;

const clamp = (score: number): number => Math.max(-SCORE_CAP, Math.min(SCORE_CAP, score));

/** `MATE` 附近的分數代表已經看到殺棋，一律視為封頂。 */
const normalise = (score: number): number =>
  Math.abs(score) > MATE - 400 ? Math.sign(score) * SCORE_CAP : clamp(score);

/**
 * 每個局面的分數都是走子方的視角；`null` 代表對局已結束或沒有其他選擇。
 * 第 i 步從局面 i 走到局面 i + 1，下一個局面的分數要反過來看。
 */
export function judgeMoves(scores: readonly (number | null)[]): MoveQuality[] {
  const qualities: MoveQuality[] = [];
  for (let index = 0; index + 1 < scores.length; index += 1) {
    const before = scores[index] ?? null;
    const after = scores[index + 1] ?? null;
    if (before === null || after === null) {
      qualities.push('good');
      continue;
    }
    const loss = normalise(before) + normalise(after);
    if (loss >= BLUNDER) qualities.push('blunder');
    else if (loss >= MISTAKE) qualities.push('mistake');
    else if (loss >= INACCURACY) qualities.push('inaccuracy');
    else qualities.push('good');
  }
  return qualities;
}

/** 紅方勝率（0 到 100）。`redToMove` 是這個局面輪到紅方。 */
export function redWinPercent(score: number, redToMove: boolean): number {
  const red = normalise(redToMove ? score : -score);
  return 50 + 50 * Math.tanh(red / 200);
}
