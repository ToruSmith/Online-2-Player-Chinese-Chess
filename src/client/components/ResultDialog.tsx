import type { ReactNode } from 'react';
import type { Color, Outcome } from '../../engine';
import { outcomeTitle, reasonText } from '../lib/copy';
import { Dialog } from './Dialog';
import { Seal } from './Seal';

interface ResultDialogProps {
  outcome: Outcome;
  you: Color | null;
  onClose: () => void;
  children: ReactNode;
}

export function ResultDialog({ outcome, you, onClose, children }: ResultDialogProps) {
  const title = outcomeTitle(outcome, you);
  const char = !outcome.winner ? '和' : you && outcome.winner !== you ? '負' : '勝';
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="result">
        <Seal char={char} stamp />
        <h2 className="result__title">{title}</h2>
        <p className="result__reason">{reasonText(outcome.reason)}</p>
        <div className="result__actions">{children}</div>
        <button type="button" className="text-button" onClick={onClose}>
          看看棋盤
        </button>
      </div>
    </Dialog>
  );
}
