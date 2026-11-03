import { Glyph } from './Glyph';

const CELL = 100;
const LEFT = 50;
const TOP = 50;
const RIGHT = LEFT + 8 * CELL;
const BOTTOM = TOP + 9 * CELL;

const STAR_POINTS: readonly [number, number][] = [
  [1, 2],
  [7, 2],
  [0, 3],
  [2, 3],
  [4, 3],
  [6, 3],
  [8, 3],
  [0, 6],
  [2, 6],
  [4, 6],
  [6, 6],
  [8, 6],
  [1, 7],
  [7, 7],
];

function starPath([col, row]: readonly [number, number]): string {
  const x = LEFT + col * CELL;
  const y = TOP + row * CELL;
  const gap = 9;
  const arm = 20;
  const corners: [number, number][] = [];
  if (col > 0) corners.push([-1, -1], [-1, 1]);
  if (col < 8) corners.push([1, -1], [1, 1]);
  return corners
    .map(([sx, sy]) => {
      const cx = x + sx * gap;
      const cy = y + sy * gap;
      return `M${cx + sx * arm} ${cy}H${cx}V${cy + sy * arm}`;
    })
    .join('');
}

const horizontal = Array.from({ length: 10 }, (_, row) => `M${LEFT} ${TOP + row * CELL}H${RIGHT}`);
const vertical = Array.from({ length: 7 }, (_, index) => {
  const x = LEFT + (index + 1) * CELL;
  return `M${x} ${TOP}V${TOP + 4 * CELL}M${x} ${TOP + 5 * CELL}V${BOTTOM}`;
});
const palace = [
  `M${LEFT + 3 * CELL} ${TOP}L${LEFT + 5 * CELL} ${TOP + 2 * CELL}`,
  `M${LEFT + 5 * CELL} ${TOP}L${LEFT + 3 * CELL} ${TOP + 2 * CELL}`,
  `M${LEFT + 3 * CELL} ${TOP + 7 * CELL}L${LEFT + 5 * CELL} ${BOTTOM}`,
  `M${LEFT + 5 * CELL} ${TOP + 7 * CELL}L${LEFT + 3 * CELL} ${BOTTOM}`,
];
const grid = [
  ...horizontal,
  ...vertical,
  `M${LEFT} ${TOP}V${BOTTOM}`,
  `M${RIGHT} ${TOP}V${BOTTOM}`,
  ...palace,
].join('');

const RIVER = [
  { char: '楚', x: 150 },
  { char: '河', x: 270 },
  { char: '漢', x: 570 },
  { char: '界', x: 690 },
];

/** 棋盤線條。上下左右對稱，所以翻轉棋盤時不需要重畫。 */
export function BoardLines() {
  return (
    <div className="board__surface" aria-hidden="true">
      <svg className="board__lines" viewBox="0 0 900 1000">
        <rect x={LEFT - 16} y={TOP - 16} width={832} height={932} className="board__frame" />
        <path d={grid} className="board__grid-lines" />
        <path d={STAR_POINTS.map(starPath).join('')} className="board__stars" />
      </svg>
      {RIVER.map(({ char, x }) => (
        <span key={char} className="board__river" style={{ left: `${x / 9}%` }}>
          <Glyph char={char} />
        </span>
      ))}
    </div>
  );
}
