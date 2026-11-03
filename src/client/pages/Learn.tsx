import { useEffect, useMemo, useState } from 'react';
import { GENERAL, parseFen } from '../../engine';
import { Board } from '../components/Board';
import { PageHeader } from '../components/PageHeader';
import type { TrackedPiece } from '../lib/pieces';

interface Lesson {
  id: string;
  title: string;
  fen: string;
  body: string;
  /** 建議孩子試試看的動作。 */
  task: string;
}

const LESSONS: readonly Lesson[] = [
  {
    id: 'general',
    title: '帥',
    fen: '5k3/9/9/9/9/9/9/9/4K4/9 w',
    body: '帥是最重要的棋子，被吃掉就輸了。它只能待在九宮裡（畫著叉叉的地方），每次走一格，只能直走或橫走。',
    task: '點一下帥，試著走到九宮的角落。走得出九宮嗎？',
  },
  {
    id: 'advisor',
    title: '仕',
    fen: '5k3/9/9/9/9/9/9/9/4A4/3K5 w',
    body: '仕是帥的貼身護衛，也不能離開九宮。它每次斜走一格。',
    task: '讓仕斜走到九宮的四個角。',
  },
  {
    id: 'elephant',
    title: '相',
    fen: '5k3/9/9/9/9/9/9/9/9/2B1K4 w',
    body: '相走「田」字，一次斜走兩格。相不能過河，所以是專門守家的棋子。',
    task: '讓相一路走到河邊。它能過河嗎？',
  },
  {
    id: 'horse',
    title: '馬',
    fen: '5k3/9/9/9/9/4N4/9/9/9/3K5 w',
    body: '馬走「日」字：先直走一格，再斜走一格。站在棋盤中央時，馬最多有八個方向可以跳。',
    task: '點一下馬，數數看它有幾個落點。',
  },
  {
    id: 'chariot',
    title: '俥',
    fen: '5k3/9/9/9/9/9/9/9/9/R2K5 w',
    body: '俥是最強的棋子，直走或橫走都可以，想走幾格都行，只要路上沒有棋子擋住。',
    task: '讓俥從角落開到對面。',
  },
  {
    id: 'cannon',
    title: '炮',
    fen: '5k3/9/4r4/9/9/4P4/9/4C4/9/3K5 w',
    body: '炮平常走法和俥一樣，但吃子時一定要隔著一顆棋子，這顆棋子叫「炮架」，敵我都可以。',
    task: '點一下炮，看看它怎麼隔著自己的兵，吃掉對面的車。',
  },
  {
    id: 'soldier',
    title: '兵',
    fen: '5k3/9/9/9/9/2P3P2/9/9/9/3K5 w',
    body: '兵只能往前走一格，不能後退。過了河之後變得更厲害，可以往左或往右走。',
    task: '把兵往前推過河，再點一次，看看多了哪些走法。',
  },
  {
    id: 'horse-leg',
    title: '蹩馬腿',
    fen: '5k3/9/9/9/4p4/4N4/9/9/9/3K5 w',
    body: '馬要跳之前，先走的那一格如果有棋子，往那邊就跳不過去，這叫「蹩馬腿」。',
    task: '馬正前方有一個卒。點一下馬，往前的兩個落點不見了。',
  },
  {
    id: 'elephant-eye',
    title: '塞象眼',
    fen: '5k3/9/9/9/9/9/9/9/3p5/2B1K4 w',
    body: '相走田字時，田字正中央的格子叫「象眼」。象眼被擋住，相就不能往那邊走。',
    task: '點一下相，右上方的路被卒塞住了。',
  },
  {
    id: 'cannon-screen',
    title: '炮打隔子',
    fen: '5k3/9/9/1r5r1/9/9/1P7/1C5C1/9/3K5 w',
    body: '左邊的炮有炮架，能吃車；右邊的炮前面沒有棋子，直接碰到車，反而不能吃。',
    task: '比較左右兩門炮的落點。',
  },
  {
    id: 'facing',
    title: '王不見王',
    fen: '4k4/9/9/9/9/4R4/9/9/9/4K4 w',
    body: '將和帥不能在同一條直線上直接面對面，中間一定要有棋子擋著。所以這輛俥不能離開中路。',
    task: '點一下俥，它只能在中路上走，不能往旁邊。',
  },
  {
    id: 'winning',
    title: '怎麼算贏',
    fen: '3k5/R8/9/9/9/9/9/9/9/1R2K4 w',
    body: '對方的將無路可逃叫「絕殺」，你就贏了。要注意，就算沒有被將軍，只要輪到對方時無棋可走，叫「困斃」，也算你贏，不是平手。',
    task: '把下面的俥開到黑方底線，完成絕殺。',
  },
];

interface Sandbox {
  board: Int8Array;
  pieces: TrackedPiece[];
}

function sandboxFrom(fen: string): Sandbox {
  const { board } = parseFen(fen);
  const pieces: TrackedPiece[] = [];
  board.forEach((piece, square) => {
    if (piece !== 0) pieces.push({ id: square, piece, square });
  });
  return { board, pieces };
}

export function Learn() {
  const [lessonId, setLessonId] = useState(LESSONS[0]!.id);
  const lesson = LESSONS.find((item) => item.id === lessonId) ?? LESSONS[0]!;
  const initial = useMemo(() => sandboxFrom(lesson.fen), [lesson]);
  const [sandbox, setSandbox] = useState(initial);

  useEffect(() => setSandbox(initial), [initial]);

  /** 練習時對方不走棋，紅方可以一直走，方便反覆嘗試。 */
  const onMove = (from: number, to: number) => {
    setSandbox((current) => {
      if (Math.abs(current.board[to]!) === GENERAL) return current;
      const board = current.board.slice();
      board[to] = board[from]!;
      board[from] = 0;
      const pieces = current.pieces
        .filter((item) => item.square !== to)
        .map((item) => (item.square === from ? { ...item, square: to } : item));
      return { board, pieces };
    });
  };

  return (
    <main className="page learn">
      <PageHeader title="學下棋" />
      <nav className="learn__tabs" aria-label="課程">
        {LESSONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="learn__tab"
            aria-current={item.id === lesson.id ? 'true' : undefined}
            onClick={() => setLessonId(item.id)}
          >
            {item.title}
          </button>
        ))}
      </nav>
      <div className="learn__body">
        <div className="learn__board">
          <Board
            key={lesson.id}
            board={sandbox.board}
            pieces={sandbox.pieces}
            turn="red"
            movable="red"
            onMove={onMove}
            label={`${lesson.title}練習棋盤`}
          />
        </div>
        <section className="sheet learn__text">
          <h2 className="sheet__title">{lesson.title}</h2>
          <p>{lesson.body}</p>
          <p className="learn__task">{lesson.task}</p>
          <button type="button" className="button" onClick={() => setSandbox(initial)}>
            擺回原位
          </button>
        </section>
      </div>
    </main>
  );
}
