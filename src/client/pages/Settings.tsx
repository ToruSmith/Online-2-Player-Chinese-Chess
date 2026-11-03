import { Choice } from '../components/Choice';
import { PageHeader } from '../components/PageHeader';
import { THEMES, type ThemeId, updateSettings, useSettings } from '../lib/settings';

export function Settings() {
  const settings = useSettings();
  return (
    <main className="page page--narrow">
      <PageHeader title="設定" />
      <div className="sheet">
        <label className="field">
          <span className="field__label">你的名字</span>
          <input
            className="input"
            value={settings.name}
            maxLength={12}
            autoComplete="nickname"
            onChange={(event) => updateSettings({ name: event.target.value })}
          />
        </label>
        <Choice
          legend="棋桌風格"
          value={settings.theme}
          options={THEMES.map((theme) => ({
            value: theme.id,
            label: theme.label,
            description: theme.description,
          }))}
          onChange={(theme: ThemeId) => updateSettings({ theme })}
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(event) => updateSettings({ sound: event.target.checked })}
          />
          <span>播放音效</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showMoves}
            onChange={(event) => updateSettings({ showMoves: event.target.checked })}
          />
          <span>選棋時顯示可以走的位置</span>
        </label>
      </div>
    </main>
  );
}
