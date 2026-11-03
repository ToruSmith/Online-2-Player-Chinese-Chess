import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { BLACK, type Color, RED, createGame, moveFrom, moveTo, opposite } from '../../engine';
import { type ProposalKind, REACTIONS, type RoomView } from '../../shared/protocol';
import { ActionButton, GameTable } from '../components/GameTable';
import { Board } from '../components/Board';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { MoveLog } from '../components/MoveLog';
import { PageHeader } from '../components/PageHeader';
import { PlayerPlate } from '../components/PlayerPlate';
import { ResultDialog } from '../components/ResultDialog';
import { COLOR_NAME } from '../lib/copy';
import { askHint, toLine } from '../lib/engineClient';
import { capturedBy, trackPieces } from '../lib/pieces';
import { saveRecord } from '../lib/records';
import { Link, navigate } from '../lib/router';
import { updateSettings, useSettings } from '../lib/settings';
import { type RoomFailure, useRoom } from '../lib/useRoom';
import { useMoveFeedback } from '../lib/useMoveFeedback';

const FAILURE_TEXT: Record<RoomFailure, { title: string; text: string }> = {
  'not-found': {
    title: '找不到這個房間',
    text: '房間可能已經關閉，或是代碼輸入錯誤。可以請對方再開一間。',
  },
  full: { title: '房間已經坐滿', text: '這個房間的觀戰人數也滿了，請晚點再試。' },
  replaced: { title: '已在其他地方開啟', text: '你的座位已由另一個分頁或裝置接手。' },
  'rate-limited': { title: '操作太頻繁', text: '請稍等一分鐘後重新整理頁面。' },
};

const PROPOSAL_TEXT: Record<ProposalKind, string> = {
  undo: '想要悔棋',
  draw: '想要和棋',
  rematch: '想再來一局',
};

/** 還沒收到房間資料時的占位棋局。 */
const EMPTY_GAME = createGame();

function NameForm({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  };
  return (
    <main className="page page--narrow">
      <PageHeader title="加入對局" />
      <form className="sheet" onSubmit={submit}>
        <label className="field">
          <span className="field__label">你的名字</span>
          <input
            className="input"
            value={name}
            maxLength={12}
            autoFocus
            autoComplete="nickname"
            placeholder="例如：爸爸、小明"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button className="button button--primary" disabled={!name.trim()}>
          進入房間
        </button>
      </form>
    </main>
  );
}

function WaitingPanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/room/${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const canShare = typeof navigator.share === 'function';

  return (
    <div className="waiting">
      <p className="waiting__label">把這組代碼傳給對方</p>
      <p className="waiting__code" aria-label={`房間代碼 ${code.split('').join(' ')}`}>
        {code}
      </p>
      <div className="waiting__actions">
        <button type="button" className="button" onClick={() => void copy()}>
          <Icon name={copied ? 'check' : 'copy'} />
          {copied ? '已複製連結' : '複製邀請連結'}
        </button>
        {canShare && (
          <button
            type="button"
            className="button"
            onClick={() =>
              void navigator
                .share({ title: '親子象棋', text: `來下棋！房間代碼 ${code}`, url: link })
                .catch(() => undefined)
            }
          >
            <Icon name="share" />
            分享
          </button>
        )}
      </div>
      <p className="waiting__hint">對方加入後就會開局。</p>
    </div>
  );
}

function plateStatus(room: RoomView, color: Color, turn: Color): string | undefined {
  const seat = room.seats[color];
  if (!seat) return '等待加入';
  if (!seat.connected) return '離線中，座位保留';
  if (room.status === 'playing' && turn === color) return '輪到走棋';
  return undefined;
}

function RoomGame({ code, name }: { code: string; name: string }) {
  const { connection, room, game, failure, notice, bubble, actions } = useRoom(code, name);
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [hinting, setHinting] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [resultClosed, setResultClosed] = useState(false);
  const [shownBubble, setShownBubble] = useState<typeof bubble>(null);

  const role = room?.role ?? 'spectator';
  const you: Color | null = role === 'spectator' ? null : role;
  const ply = game?.moves.length ?? 0;
  const round = room?.round ?? 1;

  useMoveFeedback(game ?? EMPTY_GAME, you);

  useEffect(() => setHint(null), [ply]);
  useEffect(() => setResultClosed(false), [round, ply]);

  useEffect(() => {
    if (!bubble) return;
    setShownBubble(bubble);
    const timer = window.setTimeout(() => setShownBubble(null), 3500);
    return () => window.clearTimeout(timer);
  }, [bubble]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(actions.clearNotice, 4000);
    return () => window.clearTimeout(timer);
  }, [notice, actions]);

  useEffect(() => {
    if (!room || !game?.outcome || !you) return;
    saveRecord({
      id: `online-${code}-${round}`,
      mode: 'online',
      red: room.seats.red?.name ?? '紅方',
      black: room.seats.black?.name ?? '黑方',
      yourColor: you,
      game,
    });
  }, [room, game, you, code, round]);

  const pieces = useMemo(() => (game ? trackPieces(game, game.moves.length) : []), [game]);

  if (failure) {
    const { title, text } = FAILURE_TEXT[failure];
    return (
      <main className="page page--narrow">
        <PageHeader title={title} />
        <p className="page__lead">{text}</p>
        <Link to="/online" className="button button--primary">
          回到線上對戰
        </Link>
      </main>
    );
  }

  if (!room || !game) {
    return (
      <main className="page page--narrow">
        <PageHeader title={`房間 ${code}`} />
        <p className="page__lead" role="status">
          {connection === 'offline' ? '連不上伺服器，正在重試。' : '正在進入房間。'}
        </p>
      </main>
    );
  }

  const bottomColor: Color = you ?? 'red';
  const topColor = opposite(bottomColor);
  const playing = room.status === 'playing';
  const proposal = room.proposal;
  const incoming = proposal && you && proposal.from !== you ? proposal : null;
  const outgoing = proposal && proposal.from === you ? proposal : null;

  const plate = (color: Color) => (
    <PlayerPlate
      name={room.seats[color]?.name ?? '空位'}
      color={color}
      active={playing && game.turn === color}
      captured={capturedBy(game, color === 'red' ? RED : BLACK, game.moves.length)}
      status={plateStatus(room, color, game.turn)}
      clock={
        room.clock ? { remaining: room.clock[color], running: room.clock.running === color } : null
      }
      bubble={shownBubble?.from === color ? shownBubble.text : null}
    />
  );

  const requestHint = async () => {
    setHinting(true);
    const move = await askHint(toLine(game));
    setHinting(false);
    if (move !== null) setHint({ from: moveFrom(move), to: moveTo(move) });
  };

  // 認輸、超時與議和都是雙方的決定，結束後不能再悔棋。
  const endedOnBoard =
    game.outcome && !['resign', 'timeout', 'agreement'].includes(game.outcome.reason);
  const canUndo = (playing || endedOnBoard) && ply > (game.turn === you ? 1 : 0);

  const log = <MoveLog moves={game.moves} blackFirst={game.initialFen.endsWith(' b')} />;
  const statusLine =
    connection !== 'online'
      ? '連線中斷，正在重新連線。棋局會保留。'
      : room.spectators > 0
        ? `${room.spectators} 人觀戰中`
        : null;

  return (
    <>
      <GameTable
        title={`房間 ${code}`}
        backTo="/online"
        top={plate(topColor)}
        bottom={plate(bottomColor)}
        board={
          <div className="board-wrap">
            <Board
              board={game.board}
              pieces={pieces}
              turn={game.turn}
              movable={playing && you && connection === 'online' ? you : null}
              flipped={bottomColor === 'black'}
              lastMove={game.moves[ply - 1]}
              inCheck={game.inCheck && !game.outcome}
              hint={hint}
              onMove={actions.move}
            />
            {room.status === 'waiting' && <WaitingPanel code={code} />}
          </div>
        }
        log={log}
        notice={
          <>
            {statusLine && <p className="notice">{statusLine}</p>}
            {notice && (
              <p className="notice notice--strong" role="status">
                {notice}
              </p>
            )}
            {outgoing && (
              <p className="notice notice--strong" role="status">
                等待對方回覆
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void actions.cancelProposal()}
                >
                  取消
                </button>
              </p>
            )}
          </>
        }
        actions={
          you ? (
            <>
              <div className="reactions" role="group" aria-label="送出訊息">
                {REACTIONS.map((reaction) => (
                  <button
                    key={reaction.id}
                    type="button"
                    className="reaction"
                    onClick={() => void actions.react(reaction.id)}
                  >
                    {reaction.label}
                  </button>
                ))}
              </div>
              <ActionButton
                icon="undo"
                label="悔棋"
                disabled={!canUndo || Boolean(proposal)}
                onClick={() => void actions.propose('undo')}
              />
              {room.options.allowHints && (
                <ActionButton
                  icon="hint"
                  label={hinting ? '思考中' : '提示'}
                  disabled={!playing || game.turn !== you || hinting}
                  onClick={() => void requestHint()}
                />
              )}
              <ActionButton
                icon="handshake"
                label="求和"
                disabled={!playing || Boolean(proposal)}
                onClick={() => void actions.propose('draw')}
              />
              <ActionButton
                icon="flag"
                label="認輸"
                disabled={!playing}
                onClick={() => setConfirmResign(true)}
              />
              <ActionButton icon="back" label="離開" onClick={() => setConfirmLeave(true)} />
            </>
          ) : (
            <p className="notice">
              <Icon name="eye" size={18} /> 你正在觀戰
            </p>
          )
        }
      />

      {incoming && (
        <Dialog title="對方的請求">
          <div className="confirm">
            <h2 className="confirm__title">
              {room.seats[incoming.from]?.name ?? COLOR_NAME[incoming.from]}
              {PROPOSAL_TEXT[incoming.kind]}
            </h2>
            <div className="confirm__actions">
              <button type="button" className="button" onClick={() => void actions.respond(false)}>
                不要
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => void actions.respond(true)}
              >
                好
              </button>
            </div>
          </div>
        </Dialog>
      )}

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
                  void actions.resign();
                }}
              >
                認輸
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {confirmLeave && (
        <Dialog title="確認離開" onClose={() => setConfirmLeave(false)}>
          <div className="confirm">
            <h2 className="confirm__title">要離開房間嗎？</h2>
            <p className="confirm__text">座位會保留一段時間，用同一個連結就能回來。</p>
            <div className="confirm__actions">
              <button type="button" className="button" onClick={() => setConfirmLeave(false)}>
                留下來
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  void actions.leave().finally(() => navigate('/'));
                }}
              >
                離開
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {game.outcome && !resultClosed && !incoming && (
        <ResultDialog outcome={game.outcome} you={you} onClose={() => setResultClosed(true)}>
          {you && (
            <button
              type="button"
              className="button button--primary"
              disabled={Boolean(proposal)}
              onClick={() => void actions.propose('rematch')}
            >
              {outgoing?.kind === 'rematch' ? '等待對方回覆' : '再來一局（換邊）'}
            </button>
          )}
          {you && canUndo && !proposal && (
            <button type="button" className="button" onClick={() => void actions.propose('undo')}>
              悔棋
            </button>
          )}
        </ResultDialog>
      )}
    </>
  );
}

export function Room({ code }: { code: string }) {
  const { name } = useSettings();
  if (!name.trim()) return <NameForm onSubmit={(value) => updateSettings({ name: value })} />;
  return <RoomGame key={code} code={code} name={name} />;
}
