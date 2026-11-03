import { useEffect, useMemo, useState } from 'react';
import {
  BLACK,
  type Color,
  type Game,
  INITIAL_FEN,
  RED,
  createGame,
  moveFrom,
  moveTo,
} from '../../engine';
import { ActionButton, GameTable } from '../components/GameTable';
import { Board } from '../components/Board';
import { MoveLog } from '../components/MoveLog';
import { PlayerPlate } from '../components/PlayerPlate';
import { ResultDialog } from '../components/ResultDialog';
import { askHint, toLine } from '../lib/engineClient';
import { capturedBy, trackPieces } from '../lib/pieces';
import { saveRecord } from '../lib/records';
import { loadSavedGame, useLocalGame } from '../lib/useSavedGame';
import { useMoveFeedback } from '../lib/useMoveFeedback';

const SAVE_KEY = 'xiangqi.game.local';

interface LocalMeta {
  gameId: string;
  facing: boolean;
}

const newMeta = (facing: boolean): LocalMeta => ({
  gameId: `local-${Date.now().toString(36)}`,
  facing,
});

function LocalGame({ initial, initialMeta }: { initial: Game; initialMeta: LocalMeta }) {
  const [meta, setMeta] = useState(initialMeta);
  const { game, play, undo, restart } = useLocalGame(SAVE_KEY, initial, meta);
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [resultClosed, setResultClosed] = useState(false);

  useMoveFeedback(game, null);

  useEffect(() => {
    setHint(null);
    setResultClosed(false);
  }, [game.moves.length]);

  useEffect(() => {
    if (!game.outcome) return;
    saveRecord({
      id: meta.gameId,
      mode: 'local',
      red: '紅方',
      black: '黑方',
      yourColor: null,
      game,
    });
  }, [game, meta.gameId]);

  const pieces = useMemo(() => trackPieces(game, game.moves.length), [game]);

  const plate = (color: Color) => (
    <PlayerPlate
      name={color === 'red' ? '紅方' : '黑方'}
      color={color}
      active={!game.outcome && game.turn === color}
      captured={capturedBy(game, color === 'red' ? RED : BLACK, game.moves.length)}
      status={!game.outcome && game.turn === color ? '輪到走棋' : undefined}
    />
  );

  const requestHint = async () => {
    const move = await askHint(toLine(game));
    if (move !== null) setHint({ from: moveFrom(move), to: moveTo(move) });
  };

  const startNew = () => {
    setMeta(newMeta(meta.facing));
    restart(INITIAL_FEN);
  };

  return (
    <>
      <GameTable
        title="面對面下棋"
        top={plate('black')}
        bottom={plate('red')}
        board={
          <Board
            board={game.board}
            pieces={pieces}
            turn={game.turn}
            movable={game.outcome ? null : 'both'}
            facing={meta.facing}
            lastMove={game.moves[game.moves.length - 1]}
            inCheck={game.inCheck && !game.outcome}
            hint={hint}
            onMove={play}
          />
        }
        log={<MoveLog moves={game.moves} />}
        actions={
          <>
            <ActionButton
              icon="undo"
              label="悔棋"
              disabled={game.moves.length === 0}
              onClick={() => undo(1)}
            />
            <ActionButton
              icon="hint"
              label="提示"
              disabled={Boolean(game.outcome)}
              onClick={() => void requestHint()}
            />
            <ActionButton icon="restart" label="新局" onClick={startNew} />
            <label className="toggle toggle--wide">
              <input
                type="checkbox"
                checked={meta.facing}
                onChange={(event) => setMeta({ ...meta, facing: event.target.checked })}
              />
              <span>對坐模式：黑方的字朝向對面</span>
            </label>
          </>
        }
      />
      {game.outcome && !resultClosed && (
        <ResultDialog outcome={game.outcome} you={null} onClose={() => setResultClosed(true)}>
          <button type="button" className="button button--primary" onClick={startNew}>
            再來一局
          </button>
        </ResultDialog>
      )}
    </>
  );
}

export function Local() {
  const [session] = useState(
    () => loadSavedGame<LocalMeta>(SAVE_KEY) ?? { game: createGame(), meta: newMeta(false) },
  );
  return <LocalGame initial={session.game} initialMeta={session.meta} />;
}
