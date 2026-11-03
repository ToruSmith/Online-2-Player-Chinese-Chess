import { useMemo, useRef, useState } from 'react';
import {
  PUZZLES,
  type Puzzle,
  createGame,
  moveFrom,
  moveTo,
  playMove,
  takeBack,
} from '../../engine';
import { ActionButton, GameTable } from '../components/GameTable';
import { Board } from '../components/Board';
import { Icon } from '../components/Icon';
import { MoveLog } from '../components/MoveLog';
import { PageHeader } from '../components/PageHeader';
import { PlayerPlate } from '../components/PlayerPlate';
import { Seal } from '../components/Seal';
import { askPuzzleCheck, askPuzzleHint, askPuzzleReply, toLine } from '../lib/engineClient';
import { trackPieces } from '../lib/pieces';
import { markPuzzleSolved, solvedPuzzles } from '../lib/records';
import { Link } from '../lib/router';
import { useMoveFeedback } from '../lib/useMoveFeedback';

const TIERS = [
  { moves: 1, title: '一步殺', text: '找到那一步，直接將死對方。' },
  { moves: 2, title: '兩步殺', text: '先逼對方走投無路，再完成絕殺。' },
  { moves: 3, title: '三步殺', text: '多想幾步，每一步都要想好對方怎麼應。' },
] as const;

export function PuzzleList() {
  const solved = useMemo(() => new Set(solvedPuzzles()), []);
  return (
    <main className="page">
      <PageHeader title="殘局挑戰" />
      <p className="page__lead">
        已解開 {solved.size} / {PUZZLES.length} 題。你執紅方，先走。
      </p>
      {TIERS.map((tier) => (
        <section key={tier.moves} className="tier">
          <h2 className="tier__title">{tier.title}</h2>
          <p className="tier__text">{tier.text}</p>
          <ul className="tier__list">
            {PUZZLES.filter((puzzle) => puzzle.moves === tier.moves).map((puzzle) => (
              <li key={puzzle.id}>
                <Link
                  to={`/puzzles/${puzzle.id}`}
                  className={
                    solved.has(puzzle.id) ? 'puzzle-tile puzzle-tile--solved' : 'puzzle-tile'
                  }
                >
                  <span>{puzzle.title}</span>
                  {solved.has(puzzle.id) && <Icon name="check" size={18} />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

type Phase = 'your-move' | 'checking' | 'reply' | 'wrong' | 'solved';

const PHASE_TEXT: Record<Phase, string> = {
  'your-move': '輪到你了',
  checking: '看看這步棋',
  reply: '對方應著',
  wrong: '這步棋來不及將死對方，再想想。',
  solved: '解開了！',
};

export function PuzzlePlay({ puzzle }: { puzzle: Puzzle }) {
  const [game, setGame] = useState(() => createGame(puzzle.fen));
  const [phase, setPhase] = useState<Phase>('your-move');
  const [hintLevel, setHintLevel] = useState(0);
  const [arrow, setArrow] = useState<{ from: number; to: number } | null>(null);
  const attempt = useRef(0);

  useMoveFeedback(game, 'red');

  const redMovesPlayed = Math.ceil(game.moves.length / 2);
  const left = puzzle.moves - redMovesPlayed;
  const index = PUZZLES.indexOf(puzzle);
  const next = PUZZLES[index + 1];
  const pieces = useMemo(() => trackPieces(game, game.moves.length), [game]);

  const onMove = async (from: number, to: number) => {
    const played = playMove(game, from, to);
    if (!played) return;
    const current = (attempt.current += 1);
    setGame(played);
    setArrow(null);

    if (played.outcome?.winner === 'red') {
      setPhase('solved');
      markPuzzleSolved(puzzle.id);
      return;
    }

    setPhase('checking');
    const line = toLine(played);
    const stillWinning = await askPuzzleCheck(line, left - 1);
    if (attempt.current !== current) return;
    if (stillWinning !== 1) {
      setPhase('wrong');
      window.setTimeout(() => {
        if (attempt.current !== current) return;
        setGame((value) => takeBack(value, 1));
        setPhase('your-move');
      }, 1100);
      return;
    }

    setPhase('reply');
    const reply = await askPuzzleReply(line, left - 1);
    if (attempt.current !== current || reply === null) return;
    window.setTimeout(() => {
      if (attempt.current !== current) return;
      setGame((value) => playMove(value, moveFrom(reply), moveTo(reply)) ?? value);
      setPhase('your-move');
    }, 450);
  };

  const reset = () => {
    attempt.current += 1;
    setGame(createGame(puzzle.fen));
    setPhase('your-move');
    setArrow(null);
  };

  const showHint = async () => {
    if (hintLevel === 0) {
      setHintLevel(1);
      return;
    }
    const move = await askPuzzleHint(toLine(game), left);
    if (move !== null) setArrow({ from: moveFrom(move), to: moveTo(move) });
    setHintLevel(2);
  };

  return (
    <GameTable
      title={puzzle.title}
      backTo="/puzzles"
      top={
        <PlayerPlate
          name="黑方"
          color="black"
          active={phase === 'reply'}
          captured={[]}
          status={phase === 'reply' ? PHASE_TEXT.reply : undefined}
        />
      }
      bottom={
        <PlayerPlate
          name={`紅方，${puzzle.moves} 步殺`}
          color="red"
          active={phase === 'your-move'}
          captured={[]}
          status={phase === 'your-move' || phase === 'checking' ? PHASE_TEXT[phase] : undefined}
        />
      }
      board={
        <Board
          board={game.board}
          pieces={pieces}
          turn={game.turn}
          movable={phase === 'your-move' ? 'red' : null}
          lastMove={game.moves[game.moves.length - 1]}
          inCheck={game.inCheck && !game.outcome}
          hint={arrow}
          onMove={(from, to) => void onMove(from, to)}
        />
      }
      log={<MoveLog moves={game.moves} />}
      notice={
        <>
          {phase === 'wrong' && (
            <p className="notice notice--strong" role="status">
              {PHASE_TEXT.wrong}
            </p>
          )}
          {phase === 'solved' && (
            <div className="solved" role="status">
              <Seal char="解" stamp />
              <p>{PHASE_TEXT.solved}</p>
              {next ? (
                <Link to={`/puzzles/${next.id}`} className="button button--primary">
                  下一題：{next.title}
                </Link>
              ) : (
                <Link to="/puzzles" className="button button--primary">
                  回到題目列表
                </Link>
              )}
            </div>
          )}
          {phase !== 'solved' && hintLevel > 0 && <p className="notice">{puzzle.hint}</p>}
        </>
      }
      actions={
        <>
          <ActionButton
            icon="hint"
            label={hintLevel === 0 ? '提示' : '告訴我答案'}
            disabled={phase !== 'your-move' || Boolean(arrow)}
            onClick={() => void showHint()}
          />
          <ActionButton icon="restart" label="重來" onClick={reset} />
        </>
      }
    />
  );
}
