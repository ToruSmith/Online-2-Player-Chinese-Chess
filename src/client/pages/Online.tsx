import { type FormEvent, useState } from 'react';
import { HANDICAPS, type HandicapKind } from '../../engine';
import {
  DEFAULT_ROOM_OPTIONS,
  ERROR_MESSAGES,
  type RoomOptions,
  TIME_CONTROLS,
  type TimeControlId,
} from '../../shared/protocol';
import { Choice } from '../components/Choice';
import { PageHeader } from '../components/PageHeader';
import { RealtimeClient, RequestError } from '../lib/realtime';
import { navigate } from '../lib/router';
import { saveSession } from '../lib/sessions';
import { updateSettings, useSettings } from '../lib/settings';

/** 建房只需要一次請求，完成後交給房間頁面接手連線。 */
function createRoom(name: string, options: RoomOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const realtime = new RealtimeClient({
      onState: (state) => {
        if (state === 'offline') {
          realtime.stop();
          reject(new RequestError('offline'));
        }
      },
      onMessage: () => undefined,
      onOpen: () => {
        realtime
          .request('createRoom', { name, options })
          .then(({ room, token }) => {
            saveSession(room.code, token);
            resolve(room.code);
          })
          .catch(reject)
          .finally(() => realtime.stop());
      },
    });
    realtime.start();
  });
}

export function Online() {
  const settings = useSettings();
  const [name, setName] = useState(settings.name);
  const [code, setCode] = useState('');
  const [options, setOptions] = useState(DEFAULT_ROOM_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  const patch = (change: Partial<RoomOptions>) => setOptions((value) => ({ ...value, ...change }));

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    updateSettings({ name: trimmed });
    try {
      navigate(`/room/${await createRoom(trimmed, options)}`);
    } catch (failure) {
      setBusy(false);
      setError(failure instanceof Error ? failure.message : ERROR_MESSAGES['bad-request']);
    }
  };

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || code.length !== 4) return;
    updateSettings({ name: trimmed });
    navigate(`/room/${code}`);
  };

  return (
    <main className="page">
      <PageHeader title="線上對戰" />

      <label className="field">
        <span className="field__label">你的名字</span>
        <input
          className="input"
          value={name}
          maxLength={12}
          autoComplete="nickname"
          placeholder="例如：爸爸、小明"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <div className="online">
        <form className="sheet" onSubmit={handleJoin}>
          <h2 className="sheet__title">加入房間</h2>
          <p className="sheet__text">輸入對方給你的四位數代碼。</p>
          <input
            className="input input--code"
            value={code}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            aria-label="房間代碼"
            placeholder="0000"
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          />
          <button className="button" disabled={!trimmed || code.length !== 4}>
            加入房間
          </button>
        </form>

        <form className="sheet" onSubmit={handleCreate}>
          <h2 className="sheet__title">建立房間</h2>
          <Choice
            legend="你要執"
            value={options.hostColor}
            options={[
              { value: 'red', label: '紅方' },
              { value: 'black', label: '黑方' },
              { value: 'random', label: '隨機' },
            ]}
            onChange={(hostColor) => patch({ hostColor })}
          />
          <Choice
            legend="時間"
            value={options.timeControl}
            options={TIME_CONTROLS.map((item) => ({ value: item.id, label: item.label }))}
            onChange={(timeControl: TimeControlId) => patch({ timeControl })}
          />
          <Choice
            legend="你要讓對方"
            value={options.handicap}
            options={HANDICAPS.map((item) => ({ value: item.kind, label: item.label }))}
            onChange={(handicap: HandicapKind) => patch({ handicap })}
          />
          <label className="toggle">
            <input
              type="checkbox"
              checked={options.allowHints}
              onChange={(event) => patch({ allowHints: event.target.checked })}
            />
            <span>雙方都可以使用電腦提示</span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button--primary" disabled={!canSubmit}>
            {busy ? '正在建立房間' : '建立房間'}
          </button>
        </form>
      </div>
    </main>
  );
}
