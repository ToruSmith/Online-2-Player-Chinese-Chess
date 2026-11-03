export interface Puzzle {
  id: string;
  title: string;
  /** 紅方要在幾步之內取勝。 */
  moves: 1 | 2 | 3;
  fen: string;
  /** 解題遇到困難時才顯示的提示，不直接說出答案。 */
  hint: string;
}

/**
 * 每一題都由 tests/engine/puzzles.test.ts 以窮舉求解器驗證：
 * 確實能在指定步數內取勝，而且無法更快。
 */
export const PUZZLES: readonly Puzzle[] = [
  {
    id: 'facing-generals',
    title: '白臉將',
    moves: 1,
    fen: '3k5/9/9/9/9/8R/p8/9/9/4K4 w',
    hint: '帥守住了中路，黑將不敢往中間走。把車移到將所在的直線上。',
  },
  {
    id: 'cannon-behind-horse',
    title: '馬後炮',
    moves: 1,
    fen: '4k4/9/4N4/9/9/9/9/2C6/9/3K5 w',
    hint: '馬把將的左右都看住了，再讓炮把馬當成炮架。',
  },
  {
    id: 'double-cannons',
    title: '重炮',
    moves: 1,
    fen: '3aka3/9/9/9/9/1C7/9/4C4/9/3K5 w',
    hint: '兩門炮排在同一條線上，前炮就是後炮的炮架。',
  },
  {
    id: 'corner-horse',
    title: '掛角馬',
    moves: 1,
    fen: '3aka3/9/4P4/9/6N2/9/9/9/9/3K5 w',
    hint: '黑將被自己的士擋住，兵又守著將的前方。馬要跳到九宮的角上。',
  },
  {
    id: 'crouching-horse',
    title: '臥槽馬',
    moves: 1,
    fen: '3aka3/9/4P3N/9/9/9/9/9/9/3K5 w',
    hint: '馬跳到靠近將的「槽」位，就能從側面將軍。',
  },
  {
    id: 'double-check',
    title: '雙將',
    moves: 1,
    fen: '3aka3/9/9/9/4N4/9/9/4R4/9/3K5 w',
    hint: '馬跳開時車會將軍，馬自己也同時將軍。黑方一次擋不了兩個攻擊。',
  },
  {
    id: 'two-ghosts',
    title: '二鬼拍門',
    moves: 1,
    fen: '4k4/3P1P3/9/9/9/9/p8/9/9/3K5 w',
    hint: '兩個兵貼著九宮，帥也守著其中一條直線。讓一個兵來敲門。',
  },
  {
    id: 'double-rooks',
    title: '雙車錯',
    moves: 2,
    fen: '9/4k4/8b/9/R8/9/9/9/9/5K1R1 w',
    hint: '一輛車先將軍，把將趕到底線；另一輛車再接力。',
  },
  {
    id: 'stacked-cannons',
    title: '疊炮連將',
    moves: 2,
    fen: '5k3/9/b7b/9/4C4/9/3C5/9/9/4K4 w',
    hint: '把兩門炮都移到將的那一路。第一門炮要先走，第二門才有炮架。',
  },
  {
    id: 'general-takes-center',
    title: '帥佔中路',
    moves: 2,
    fen: '3a5/9/3k5/8R/9/9/2N6/9/9/5K3 w',
    hint: '先別急著將軍。帥往中間走一步，黑將就少了一半的活路。',
  },
  {
    id: 'horse-opens-file',
    title: '馬炮開路',
    moves: 2,
    fen: '9/9/b3k3b/9/9/1N4C2/9/9/9/R4K3 w',
    hint: '馬先將軍逼將退回，最後由車完成絕殺。',
  },
  {
    id: 'cannon-swap',
    title: '雙炮換位',
    moves: 2,
    fen: '9/9/3k5/6C2/9/8p/9/4C4/4K4/9 w',
    hint: '中間那門炮先移到將的直線上，再把另一門炮也拉過來。',
  },
  {
    id: 'rook-soldier-net',
    title: '車兵收網',
    moves: 3,
    fen: '5a3/4ak3/4b3b/9/5P3/9/9/9/R8/4K4 w',
    hint: '車要繞到將的那一側，最後一擊留給小兵。',
  },
  {
    id: 'rook-horse-cannon',
    title: '三軍齊發',
    moves: 3,
    fen: '9/3Ck4/b3N4/9/5R3/9/9/9/9/5K3 w',
    hint: '馬先跳開讓路，炮和車才能接著上場。',
  },
  {
    id: 'rooks-on-the-back-rank',
    title: '雙車破宮',
    moves: 3,
    fen: '9/3ka4/4b4/4R4/9/9/p8/9/9/4K2R1 w',
    hint: '後面那輛車才是主角，先把它開到黑方的底線。',
  },
  {
    id: 'twin-horses',
    title: '雙馬連環',
    moves: 3,
    fen: '9/9/3a1k1N1/9/7P1/9/9/6N2/9/3K5 w',
    hint: '遠處那匹馬要連跳兩次趕到前線，兩匹馬輪流把將逼進死角。',
  },
];
