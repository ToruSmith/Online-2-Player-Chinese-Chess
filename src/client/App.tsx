import { Component, type ReactNode } from 'react';
import { PUZZLES } from '../engine';
import { PageHeader } from './components/PageHeader';
import { usePathname } from './lib/router';
import { Ai } from './pages/Ai';
import { Home } from './pages/Home';
import { Learn } from './pages/Learn';
import { Local } from './pages/Local';
import { Online } from './pages/Online';
import { PuzzleList, PuzzlePlay } from './pages/Puzzles';
import { Records, Replay } from './pages/Records';
import { Room } from './pages/Room';
import { Settings } from './pages/Settings';

function NotFound() {
  return (
    <main className="page page--narrow">
      <PageHeader title="找不到這一頁" />
      <p className="page__lead">這個網址沒有內容，回首頁重新選一個模式吧。</p>
    </main>
  );
}

function route(path: string): ReactNode {
  const roomMatch = /^\/room\/(\d{4})$/.exec(path);
  if (roomMatch) return <Room code={roomMatch[1]!} />;
  const puzzleMatch = /^\/puzzles\/([\w-]+)$/.exec(path);
  if (puzzleMatch) {
    const puzzle = PUZZLES.find((item) => item.id === puzzleMatch[1]);
    return puzzle ? <PuzzlePlay key={puzzle.id} puzzle={puzzle} /> : <NotFound />;
  }
  const recordMatch = /^\/records\/([\w-]+)$/.exec(path);
  if (recordMatch) return <Replay id={recordMatch[1]!} />;

  switch (path) {
    case '/':
      return <Home />;
    case '/online':
      return <Online />;
    case '/ai':
      return <Ai />;
    case '/local':
      return <Local />;
    case '/puzzles':
      return <PuzzleList />;
    case '/learn':
      return <Learn />;
    case '/records':
      return <Records />;
    case '/settings':
      return <Settings />;
    default:
      return <NotFound />;
  }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('畫面發生錯誤', error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page page--narrow">
        <h1 className="page__title">畫面出了點問題</h1>
        <p className="page__lead">重新整理通常就能恢復，你的棋局進度都還在。</p>
        <button type="button" className="button button--primary" onClick={() => location.reload()}>
          重新整理
        </button>
      </main>
    );
  }
}

export function App() {
  const path = usePathname();
  return <ErrorBoundary key={path}>{route(path)}</ErrorBoundary>;
}
