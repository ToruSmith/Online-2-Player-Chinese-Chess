import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Link } from '../lib/router';

interface GameTableProps {
  title: string;
  top: ReactNode;
  board: ReactNode;
  bottom: ReactNode;
  log: ReactNode;
  actions: ReactNode;
  notice?: ReactNode;
  backTo?: string;
}

/** 所有對局共用的版面：手機直向堆疊，桌機棋盤靠左、棋譜靠右。 */
export function GameTable({
  title,
  top,
  board,
  bottom,
  log,
  actions,
  notice,
  backTo = '/',
}: GameTableProps) {
  return (
    <main className="table">
      <header className="table__bar">
        <Link to={backTo} className="icon-button" aria-label="返回">
          <Icon name="back" />
        </Link>
        <h1 className="table__title">{title}</h1>
      </header>
      <div className="table__play">
        {top}
        {board}
        {bottom}
      </div>
      <aside className="table__side">
        {notice && <div className="table__notice">{notice}</div>}
        <div className="table__log">{log}</div>
        <div className="table__actions">{actions}</div>
      </aside>
    </main>
  );
}

interface ActionButtonProps {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ActionButton({ icon, label, onClick, disabled }: ActionButtonProps) {
  return (
    <button type="button" className="action" onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}
