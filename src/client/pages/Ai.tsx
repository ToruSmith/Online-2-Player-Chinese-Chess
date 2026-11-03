import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type Color,
  type Game,
  HANDICAPS,
  type HandicapKind,
  RED,
  BLACK,
  createGame,
  endGame,
  handicapFen,
  moveFrom,
  moveTo,
  opposite,
} from '../../engine';
import { LEVELS, type LevelId, levelById } from '../../engine/ai/levels';
import { ActionButton, GameTable } from '../components/GameTable';
import { Board } from '../components/Board';
import { Choice } from '../components/Choice';
import { Dialog } from '../components/Dialog';
import { MoveLog } from '../components/MoveLog';
import { PageHeader } from '../components/PageHeader';
import { PlayerPlate } from '../components/PlayerPlate';
import { ResultDialog } from '../components/ResultDialog';
import { askHint, askMove, toLine } from '../lib/engineClient';
import { capturedBy, trackPieces } from '../lib/pieces';
import { saveRecord } from '../lib/records';
import { useSettings } from '../lib/settings';
import { clearSavedGame, loadSavedGame, useLocalGame } from '../lib/useSavedGame';
import { useMoveFeedback } from '../lib/useMoveFeedback';

const SAVE_KEY = 'xiangqi.game.ai';
/** 電腦至少停頓這麼久才落子，孩子才看得清楚。 */
const MIN_THINK_MS = 500;

interface AiMeta {
  level: LevelId;
  color: Color;
  handicap: HandicapKind;
  gameId: string;
}

function Setup({ onStart }: { onStart: (meta: AiMeta) => void }) {
  const [level, setLevel] = useState<LevelId>('sprout');
  const [color, setColor] = useState<Color>('red');
  const [handicap, setHandicap] = useState<HandicapKind>('none');

  return (
    <main className="page page--narrow">
      <PageHeader title="和電腦練習" />
      <div className="sheet">
        <Choice
          legend="對手"
          value={level}
          options={LEVELS.map((item) => ({
            value: item.id,
            label: item.name,
            description: item.description,
          }))}
          onChange={setLevel}
        />
        <Choice
          legend="你要執"
          value={color}
          options={[
            { value: 'red', label: '紅方（先走）' },
            { value: 'black', label: '黑方' },
          ]}
          onChange={setColor}
        />
        <Choice
          legend="電腦要讓你"
          value={handicap}
          options={HANDICAPS.map((item) => ({ value: item.kind, label: item.label }))}
          onChange={setHandicap}
        />
        <button
          type="button"
          className="button button--primary"
          onClick={() =>
            onStart({ level, color, handicap, gameId: `ai-${Date.now().toString(36)}` })
          }
        >
          開始下棋
        </button>
      </div>
    </main>
  );
}

function AiGame({
  initial,
  meta,
  onNewGame,
}: {
  initial: Game;
  meta: AiMeta;
  onNewGame: () => void;
}) {
  const { name } = useSettings();
  const { game, setGame, play, undo } = useLocalGame(SAVE_KEY, initial, meta);
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [hinting, setHinting] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [resultClosed, setResultClosed] = useState(false);
  const level = levelById(meta.level);
  const you = meta.color;
  const youName = name.trim() || '你';
  const computerTurn = !game.outcome && game.turn !== you;
  const generation = useRef(0);

  useMoveFeedback(game, you);

  useEffect(() => {
    setHint(null);
    setResultClosed(false);
  }, [game.moves.length]);

  useEffect(() => {
    if (!computerTurn) return;
    const current = (generation.current += 1);
    const startedAt = Date.now();
    void askMove(toLine(game), meta.level).then((move) => {
      if (move === null) return;
      const wait = Math.max(0, MIN_THINK_MS - (Date.now() - startedAt));
      window.setTimeout(() => {
        if (generation.current === current) play(moveFrom(move), moveTo(move));
      }, wait);
    });
    return () => {
      generation.current += 1;
    };
  }, [computerTurn, game, meta.level, play]);

  useEffect(() => {
    if (!game.outcome) return;
    saveRecord({
      id: meta.gameId,
      mode: 'ai',
      red: you === 'red' ? youName : level.name,
      black: you === 'black' ? youName : level.name,
      yourColor: you,
      game,
    });
  }, [game, meta.gameId, you, youName, level.name]);

  const pieces = useMemo(() => trackPieces(game, game.moves.length), [game]);

  const plate = (color: Color) => (
    <PlayerPlate
      name={color === you ? youName : level.name}
      color={color}
      active={!game.outcome && game.turn === color}
      captured={capturedBy(game, color === 'red' ? RED : BLACK, game.moves.length)}
      status={
        game.outcome
          ? undefined
          : color !== you && computerTurn
            ? '思考中'
            : color === you && !computerTurn
              ? '輪到你了'
              : undefined
      }
    />
  );

  const undoPlies = game.turn === you ? 2 : 1;
  const canUndo = !computerTurn && game.moves.length >= undoPlies;

  const requestHint = async () => {
    setHinting(true);
    const move = await askHint(toLine(game));
    setHinting(false);
    if (move !== null) setHint({ from: moveFrom(move), to: moveTo(move) });
  };

  const startNew = () => {
    clearSavedGame(SAVE_KEY);
    onNewGame();
  };

  return (
    <>
      <GameTable
        title={`對手：${level.name}`}
        top={plate(opposite(you))}
        bottom={plate(you)}
        board={
          <Board
            board={game.board}
            pieces={pieces}
            turn={game.turn}
            movable={game.outcome ? null : you}
            flipped={you === 'black'}
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
              disabled={!canUndo}
              onClick={() => undo(undoPlies)}
            />
            <ActionButton
              icon="hint"
              label={hinting ? '思考中' : '提示'}
              disabled={computerTurn || hinting || Boolean(game.outcome)}
              onClick={() => void requestHint()}
            />
            <ActionButton
              icon="flag"
              label="認輸"
              disabled={Boolean(game.outcome)}
              onClick={() => setConfirmResign(true)}
            />
            <ActionButton icon="restart" label="新局" onClick={startNew} />
          </>
        }
      />
      {confirmResign && (
        <Dialog title="確認認輸" onClose={() => setConfirmResign(false)}>
          <div className="confirm">
            <h2 className="confirm__title">確定要認輸嗎？</h2>
            <div className="confirm__actions">
              <button type="button" className="button" onClick={() => setConfirmResign(false)}>
                繼續下棋
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  setConfirmResign(false);
                  setGame(endGame(game, { winner: opposite(you), reason: 'resign' }));
                }}
              >
                認輸
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {game.outcome && !resultClosed && (
        <ResultDialog outcome={game.outcome} you={you} onClose={() => setResultClosed(true)}>
          <button type="button" className="button button--primary" onClick={startNew}>
            再來一局
          </button>
          {game.outcome.reason !== 'resign' && canUndo && (
            <button type="button" className="button" onClick={() => undo(undoPlies)}>
              悔棋重下
            </button>
          )}
        </ResultDialog>
      )}
    </>
  );
}

export function Ai() {
  const [session, setSession] = useState(() => loadSavedGame<AiMeta>(SAVE_KEY));

  if (!session) {
    return (
      <Setup
        onStart={(meta) => {
          const giver = opposite(meta.color);
          setSession({ game: createGame(handicapFen(giver, meta.handicap)), meta });
        }}
      />
    );
  }
  return (
    <AiGame
      key={session.meta.gameId}
      initial={session.game}
      meta={session.meta}
      onNewGame={() => setSession(null)}
    />
  );
}
