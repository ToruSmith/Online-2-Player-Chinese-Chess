import { useEffect, useMemo, useState } from 'react';
import { replay } from '../../engine';
import { Board } from '../components/Board';
import { Glyph } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { Seal } from '../components/Seal';
import { DEMO_GAME, DEMO_MOVES } from '../lib/demoGame';
import { loadRecords } from '../lib/records';
import { trackPieces } from '../lib/pieces';
import { Link } from '../lib/router';

const HUB_URL = 'https://torusmith.github.io/QiguanGamets/';

const MODES = [
  {
    to: '/online',
    char: '連',
    title: '線上對戰',
    text: '開一個房間，把四位數代碼傳給家人',
    primary: true,
  },
  { to: '/ai', char: '機', title: '和電腦練習', text: '五種難度，從小樹苗到棋王' },
  { to: '/local', char: '同', title: '面對面下棋', text: '兩個人共用一台裝置' },
  { to: '/puzzles', char: '殘', title: '殘局挑戰', text: '十六道殺棋題，練習怎麼贏' },
  { to: '/learn', char: '學', title: '學下棋', text: '邊走邊學每個棋子的走法' },
  { to: '/records', char: '譜', title: '我的棋譜', text: '回看下過的每一盤棋' },
];

function DemoBoard() {
  const [ply, setPly] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPly(14);
      return;
    }
    const timer = window.setInterval(() => {
      setPly((current) => (current >= DEMO_MOVES.length ? 0 : current + 1));
    }, 1800);
    return () => window.clearInterval(timer);
  }, []);

  const board = useMemo(() => replay(DEMO_GAME.initialFen, DEMO_MOVES.slice(0, ply)).board, [ply]);
  return (
    <div className="home__board" aria-hidden="true" inert>
      <Board
        board={board}
        pieces={trackPieces(DEMO_GAME, ply)}
        turn="red"
        movable={null}
        lastMove={ply > 0 ? DEMO_GAME.moves[ply - 1] : undefined}
      />
    </div>
  );
}

export function Home() {
  const hasRecords = loadRecords().length > 0;
  const modes = MODES.filter((mode) => mode.to !== '/records' || hasRecords);

  return (
    <main className="home">
      <h1 className="home__title" aria-label="親子象棋">
        {['親', '子', '象', '棋'].map((char) => (
          <Glyph key={char} char={char} />
        ))}
        <Seal char="和" />
      </h1>

      <DemoBoard />

      <nav className="home__menu" aria-label="遊戲模式">
        {modes.map((mode) => (
          <Link key={mode.to} to={mode.to} className={mode.primary ? 'mode mode--primary' : 'mode'}>
            <span className="mode__disc">
              <span className="mode__ring">
                <Glyph char={mode.char} />
              </span>
            </span>
            <span className="mode__text">
              <strong>{mode.title}</strong>
              <span>{mode.text}</span>
            </span>
          </Link>
        ))}
        <Link to="/settings" className="home__settings">
          <Icon name="gear" size={18} />
          設定
        </Link>
        <a href={HUB_URL} className="home__settings">
          回手談棋館
        </a>
      </nav>
    </main>
  );
}
