import { useEffect, useMemo, useState } from 'react';
import { type Game, replay } from '../../engine';
import { ActionButton, GameTable } from '../components/GameTable';
import { Board } from '../components/Board';
import { Icon } from '../components/Icon';
import { MoveLog } from '../components/MoveLog';
import { PageHeader } from '../components/PageHeader';
import { PlayerPlate } from '../components/PlayerPlate';
import { COLOR_NAME, outcomeTitle, reasonText } from '../lib/copy';
import { boardAt, capturedBy, trackPieces } from '../lib/pieces';
import {
  type GameRecord,
  type RecordMode,
  deleteRecord,
  findRecord,
  loadRecords,
} from '../lib/records';
import { Link, navigate } from '../lib/router';

const MODE_NAME: Record<RecordMode, string> = {
  online: '線上',
  ai: '電腦',
  local: '面對面',
};

const dateText = (time: number): string =>
  new Date(time).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });

function resultText(record: GameRecord): string {
  return outcomeTitle({ winner: record.winner, reason: record.reason }, record.yourColor);
}

export function Records() {
  const [records] = useState(loadRecords);
  const decided = records.filter((record) => record.yourColor);
  const wins = decided.filter((record) => record.winner === record.yourColor).length;
  const draws = decided.filter((record) => record.winner === null).length;

  return (
    <main className="page">
      <PageHeader title="我的棋譜" />
      {records.length === 0 ? (
        <>
          <p className="page__lead">下完一盤棋後，棋譜會出現在這裡。</p>
          <Link to="/ai" className="button button--primary">
            和電腦下一盤
          </Link>
        </>
      ) : (
        <>
          <p className="page__lead">
            {wins} 勝 {decided.length - wins - draws} 負 {draws} 和
          </p>
          <ul className="records">
            {records.map((record) => (
              <li key={record.id}>
                <Link to={`/records/${record.id}`} className="record">
                  <span className="record__players">
                    {record.red} 對 {record.black}
                  </span>
                  <span className="record__result">{resultText(record)}</span>
                  <span className="record__meta">
                    {dateText(record.playedAt)}，{MODE_NAME[record.mode]}，{record.moves.length} 步
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function notationText(record: GameRecord, game: Game): string {
  const lines = [`${record.red}（紅）對 ${record.black}（黑）`];
  game.moves.forEach((move, index) => {
    if (index % 2 === 0) lines.push(`${index / 2 + 1}. ${move.notation}`);
    else lines[lines.length - 1] += ` ${move.notation}`;
  });
  lines.push(`結果：${resultText(record)}（${reasonText(record.reason)}）`);
  return lines.join('\n');
}

export function Replay({ id }: { id: string }) {
  const record = useMemo(() => findRecord(id), [id]);
  const game = useMemo(() => (record ? replay(record.initialFen, record.moves) : null), [record]);
  const [ply, setPly] = useState(0);
  const [copied, setCopied] = useState(false);
  const total = game?.moves.length ?? 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setPly((value) => Math.max(0, value - 1));
      if (event.key === 'ArrowRight') setPly((value) => Math.min(total, value + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  if (!record || !game) {
    return (
      <main className="page page--narrow">
        <PageHeader title="找不到這盤棋" backTo="/records" />
        <p className="page__lead">這份棋譜可能已被刪除。</p>
      </main>
    );
  }

  const bottom = record.yourColor ?? 'red';
  const plate = (color: 'red' | 'black') => (
    <PlayerPlate
      name={`${record[color]}（${COLOR_NAME[color]}）`}
      color={color}
      active={false}
      captured={capturedBy(game, color === 'red' ? 1 : -1, ply)}
    />
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notationText(record, game));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <GameTable
      title={resultText(record)}
      backTo="/records"
      top={plate(bottom === 'red' ? 'black' : 'red')}
      bottom={plate(bottom)}
      board={
        <Board
          board={boardAt(game, ply)}
          pieces={trackPieces(game, ply)}
          turn={game.turn}
          movable={null}
          flipped={bottom === 'black'}
          lastMove={game.moves[ply - 1]}
        />
      }
      log={<MoveLog moves={game.moves} current={ply} onSelect={setPly} />}
      notice={<p className="notice">{reasonText(record.reason)}</p>}
      actions={
        <>
          <div className="replay">
            <button
              type="button"
              className="icon-button"
              aria-label="回到開局"
              onClick={() => setPly(0)}
            >
              <Icon name="first" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="上一步"
              onClick={() => setPly(Math.max(0, ply - 1))}
            >
              <Icon name="prev" />
            </button>
            <input
              type="range"
              className="replay__slider"
              aria-label="棋局進度"
              min={0}
              max={total}
              value={ply}
              onChange={(event) => setPly(Number(event.target.value))}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="下一步"
              onClick={() => setPly(Math.min(total, ply + 1))}
            >
              <Icon name="next" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="跳到終局"
              onClick={() => setPly(total)}
            >
              <Icon name="last" />
            </button>
          </div>
          <ActionButton
            icon={copied ? 'check' : 'copy'}
            label={copied ? '已複製' : '複製棋譜'}
            onClick={() => void copy()}
          />
          <ActionButton
            icon="trash"
            label="刪除"
            onClick={() => {
              deleteRecord(record.id);
              navigate('/records', { replace: true });
            }}
          />
        </>
      }
    />
  );
}
