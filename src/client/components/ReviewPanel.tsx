import { type Game, moveFrom, moveNotation, moveTo, replay } from '../../engine';
import { type MoveQuality, redWinPercent } from '../../engine/ai/review';
import type { ReviewState } from '../lib/useReview';

export const QUALITY_NAME: Record<Exclude<MoveQuality, 'good'>, string> = {
  inaccuracy: '緩手',
  mistake: '失誤',
  blunder: '大失誤',
};

const CHART_WIDTH = 300;
const CHART_HEIGHT = 64;

function bestText(game: Game, review: ReviewState, position: number): string | null {
  const best = review.best[position];
  if (best === null || best === undefined) return null;
  const line = game.moves.slice(0, position).map((move) => [move.from, move.to] as const);
  const { board } = replay(game.initialFen, line);
  return moveNotation(board, moveFrom(best), moveTo(best));
}

function WinChart({ game, review }: { game: Game; review: ReviewState }) {
  const redStarts = game.moves[0] ? game.moves[0].piece > 0 : true;
  const points = review.scores.flatMap((score, ply) => {
    if (score === null) return [];
    const redToMove = ply % 2 === 0 ? redStarts : !redStarts;
    const x = (ply / Math.max(1, review.scores.length - 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - (redWinPercent(score, redToMove) / 100) * CHART_HEIGHT;
    return [`${x.toFixed(1)},${y.toFixed(1)}`];
  });
  return (
    <svg
      className="review__chart"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="紅方勝率走勢"
    >
      <line x1="0" y1={CHART_HEIGHT / 2} x2={CHART_WIDTH} y2={CHART_HEIGHT / 2} />
      <polyline points={points.join(' ')} />
    </svg>
  );
}

interface ReviewPanelProps {
  game: Game;
  review: ReviewState;
  /** 目前看到第幾步 */
  ply: number;
  onStart: () => void;
}

/** 棋譜回看旁的賽後分析。分析在 Worker 中逐局面進行。 */
export function ReviewPanel({ game, review, ply, onStart }: ReviewPanelProps) {
  if (review.status === 'idle') {
    return (
      <button type="button" className="button" onClick={onStart} data-testid="review-start">
        賽後分析
      </button>
    );
  }
  if (review.status === 'running') {
    return (
      <p className="notice" role="status">
        分析中 {review.done}／{review.total}
      </p>
    );
  }

  const quality = ply > 0 ? review.qualities[ply - 1] : undefined;
  const best = ply > 0 ? bestText(game, review, ply - 1) : null;
  const count = (kind: MoveQuality): number =>
    review.qualities.filter((item) => item === kind).length;

  return (
    <div className="review" data-testid="review-result">
      <WinChart game={game} review={review} />
      <p className="notice">
        緩手 {count('inaccuracy')}，失誤 {count('mistake')}，大失誤 {count('blunder')}
      </p>
      {quality && quality !== 'good' && (
        <p className="notice notice--strong">
          這一步是{QUALITY_NAME[quality]}
          {best ? `，電腦建議${best}` : ''}
        </p>
      )}
    </div>
  );
}
