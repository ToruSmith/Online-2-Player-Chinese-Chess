export type PieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'chariot' | 'cannon' | 'soldier';
export type PieceColor = 'red' | 'black';

export interface Piece {
  id: string;
  type: PieceType;
  color: PieceColor;
  x: number;
  y: number;
}

export interface Position {
  x: number;
  y: number;
}

export type GameState = 'playing' | 'check' | 'checkmate' | 'stalemate';

// 取得特定位置的棋子
export const getPieceAt = (x: number, y: number, pieces: Piece[]): Piece | undefined => {
  return pieces.find(p => p.x === x && p.y === y);
};

// 檢查是否在棋盤內
const isOutOfBounds = (x: number, y: number) => {
  return x < 0 || x > 8 || y < 0 || y > 9;
};

// 檢查是否在九宮格內
const isInPalace = (x: number, y: number, color: PieceColor) => {
  if (x < 3 || x > 5) return false;
  if (color === 'red') {
    return y >= 7 && y <= 9;
  } else {
    return y >= 0 && y <= 2;
  }
};

// 檢查是否過河
const hasCrossedRiver = (y: number, color: PieceColor) => {
  if (color === 'red') return y <= 4;
  return y >= 5;
};

// 取得棋子「理論上」合法的移動位置（不考慮被將軍或王不見王）
const getPseudoValidMoves = (piece: Piece, pieces: Piece[]): Position[] => {
  const moves: Position[] = [];
  const { x, y, color, type } = piece;

  const addMoveIfValid = (targetX: number, targetY: number, checkPalace = false, checkRiver = false) => {
    if (isOutOfBounds(targetX, targetY)) return false;
    if (checkPalace && !isInPalace(targetX, targetY, color)) return false;
    
    // 象不能過河
    if (checkRiver) {
      if (color === 'red' && targetY <= 4) return false;
      if (color === 'black' && targetY >= 5) return false;
    }

    const targetPiece = getPieceAt(targetX, targetY, pieces);
    if (targetPiece?.color === color) return false; // 不能吃自己的棋子

    moves.push({ x: targetX, y: targetY });
    return true;
  };

  switch (type) {
    case 'general': // 將/帥
      addMoveIfValid(x, y - 1, true);
      addMoveIfValid(x, y + 1, true);
      addMoveIfValid(x - 1, y, true);
      addMoveIfValid(x + 1, y, true);
      break;

    case 'advisor': // 士/仕
      addMoveIfValid(x - 1, y - 1, true);
      addMoveIfValid(x + 1, y - 1, true);
      addMoveIfValid(x - 1, y + 1, true);
      addMoveIfValid(x + 1, y + 1, true);
      break;

    case 'elephant': // 象/相
      const elephantMoves = [
        { dx: -2, dy: -2, eyeX: -1, eyeY: -1 },
        { dx: 2, dy: -2, eyeX: 1, eyeY: -1 },
        { dx: -2, dy: 2, eyeX: -1, eyeY: 1 },
        { dx: 2, dy: 2, eyeX: 1, eyeY: 1 },
      ];
      for (const m of elephantMoves) {
        if (!getPieceAt(x + m.eyeX, y + m.eyeY, pieces)) {
          addMoveIfValid(x + m.dx, y + m.dy, false, true);
        }
      }
      break;

    case 'horse': // 馬
      const horseMoves = [
        { dx: -1, dy: -2, legX: 0, legY: -1 },
        { dx: 1, dy: -2, legX: 0, legY: -1 },
        { dx: -1, dy: 2, legX: 0, legY: 1 },
        { dx: 1, dy: 2, legX: 0, legY: 1 },
        { dx: -2, dy: -1, legX: -1, legY: 0 },
        { dx: -2, dy: 1, legX: -1, legY: 0 },
        { dx: 2, dy: -1, legX: 1, legY: 0 },
        { dx: 2, dy: 1, legX: 1, legY: 0 },
      ];
      for (const m of horseMoves) {
        if (!getPieceAt(x + m.legX, y + m.legY, pieces)) {
          addMoveIfValid(x + m.dx, y + m.dy);
        }
      }
      break;

    case 'chariot': // 車
      const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dx, dy] of directions) {
        let curX = x + dx;
        let curY = y + dy;
        while (!isOutOfBounds(curX, curY)) {
          const targetPiece = getPieceAt(curX, curY, pieces);
          if (!targetPiece) {
            moves.push({ x: curX, y: curY });
          } else {
            if (targetPiece.color !== color) {
              moves.push({ x: curX, y: curY }); // 可以吃子
            }
            break; // 遇到棋子就阻擋
          }
          curX += dx;
          curY += dy;
        }
      }
      break;

    case 'cannon': // 炮
      const cannonDirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dx, dy] of cannonDirs) {
        let curX = x + dx;
        let curY = y + dy;
        let jumped = false;
        while (!isOutOfBounds(curX, curY)) {
          const targetPiece = getPieceAt(curX, curY, pieces);
          if (!targetPiece) {
            if (!jumped) moves.push({ x: curX, y: curY });
          } else {
            if (!jumped) {
              jumped = true;
            } else {
              if (targetPiece.color !== color) {
                moves.push({ x: curX, y: curY });
              }
              break;
            }
          }
          curX += dx;
          curY += dy;
        }
      }
      break;

    case 'soldier': // 兵/卒
      const forward = color === 'red' ? -1 : 1;
      addMoveIfValid(x, y + forward);
      
      if (hasCrossedRiver(y, color)) {
        addMoveIfValid(x - 1, y);
        addMoveIfValid(x + 1, y);
      }
      break;
  }

  return moves;
};

// 檢查王不見王（飛將）
export const isGeneralsFacing = (pieces: Piece[]) => {
  const redG = pieces.find(p => p.type === 'general' && p.color === 'red');
  const blackG = pieces.find(p => p.type === 'general' && p.color === 'black');
  if (!redG || !blackG) return false;
  
  if (redG.x !== blackG.x) return false; // 不在同一直線
  
  const minY = Math.min(redG.y, blackG.y);
  const maxY = Math.max(redG.y, blackG.y);
  
  // 檢查中間是否有棋子阻擋
  for (let y = minY + 1; y < maxY; y++) {
    if (getPieceAt(redG.x, y, pieces)) return false; // 有阻擋
  }
  
  return true; // 沒有阻擋，王見王
};

// 檢查某方是否被將軍
export const isCheck = (color: PieceColor, pieces: Piece[]) => {
  const general = pieces.find(p => p.type === 'general' && p.color === color);
  if (!general) return false; // 理論上不會發生

  const opponentColor = color === 'red' ? 'black' : 'red';
  const opponentPieces = pieces.filter(p => p.color === opponentColor);

  for (const op of opponentPieces) {
    const moves = getPseudoValidMoves(op, pieces);
    if (moves.some(m => m.x === general.x && m.y === general.y)) {
      return true;
    }
  }
  return false;
};

// 取得真正合法的移動（過濾掉會導致自己被將軍或王見王的步數）
export const getValidMoves = (piece: Piece, pieces: Piece[]): Position[] => {
  const pseudoMoves = getPseudoValidMoves(piece, pieces);
  
  return pseudoMoves.filter(move => {
    // 模擬移動後的棋盤狀態
    const simulatedPieces = pieces
      .filter(p => !(p.x === move.x && p.y === move.y)) // 移除被吃的子
      .map(p => p.id === piece.id ? { ...p, x: move.x, y: move.y } : p); // 更新移動的子
    
    // 規則 1：移動後不能導致王見王
    if (isGeneralsFacing(simulatedPieces)) return false;
    
    // 規則 2：移動後不能讓自己處於被將軍的狀態
    if (isCheck(piece.color, simulatedPieces)) return false;

    return true;
  });
};

// 檢查遊戲狀態（是否將軍、絕殺、困斃）
export const checkGameState = (turn: PieceColor, pieces: Piece[]): GameState => {
  const isCurrentlyCheck = isCheck(turn, pieces);
  
  // 檢查當前玩家是否還有任何合法的步數
  const currentPlayerPieces = pieces.filter(p => p.color === turn);
  let hasAnyValidMove = false;
  for (const p of currentPlayerPieces) {
    if (getValidMoves(p, pieces).length > 0) {
      hasAnyValidMove = true;
      break;
    }
  }

  if (!hasAnyValidMove) {
    return isCurrentlyCheck ? 'checkmate' : 'stalemate'; // 絕殺 或 困斃
  }
  
  return isCurrentlyCheck ? 'check' : 'playing';
};

// 初始棋盤設定
export const INITIAL_BOARD: Piece[] = [
  // 黑方 (Black) - 上半部
  { id: 'b_c_1', type: 'chariot', color: 'black', x: 0, y: 0 },
  { id: 'b_h_1', type: 'horse', color: 'black', x: 1, y: 0 },
  { id: 'b_e_1', type: 'elephant', color: 'black', x: 2, y: 0 },
  { id: 'b_a_1', type: 'advisor', color: 'black', x: 3, y: 0 },
  { id: 'b_g', type: 'general', color: 'black', x: 4, y: 0 },
  { id: 'b_a_2', type: 'advisor', color: 'black', x: 5, y: 0 },
  { id: 'b_e_2', type: 'elephant', color: 'black', x: 6, y: 0 },
  { id: 'b_h_2', type: 'horse', color: 'black', x: 7, y: 0 },
  { id: 'b_c_2', type: 'chariot', color: 'black', x: 8, y: 0 },
  { id: 'b_ca_1', type: 'cannon', color: 'black', x: 1, y: 2 },
  { id: 'b_ca_2', type: 'cannon', color: 'black', x: 7, y: 2 },
  { id: 'b_s_1', type: 'soldier', color: 'black', x: 0, y: 3 },
  { id: 'b_s_2', type: 'soldier', color: 'black', x: 2, y: 3 },
  { id: 'b_s_3', type: 'soldier', color: 'black', x: 4, y: 3 },
  { id: 'b_s_4', type: 'soldier', color: 'black', x: 6, y: 3 },
  { id: 'b_s_5', type: 'soldier', color: 'black', x: 8, y: 3 },

  // 紅方 (Red) - 下半部
  { id: 'r_c_1', type: 'chariot', color: 'red', x: 0, y: 9 },
  { id: 'r_h_1', type: 'horse', color: 'red', x: 1, y: 9 },
  { id: 'r_e_1', type: 'elephant', color: 'red', x: 2, y: 9 },
  { id: 'r_a_1', type: 'advisor', color: 'red', x: 3, y: 9 },
  { id: 'r_g', type: 'general', color: 'red', x: 4, y: 9 },
  { id: 'r_a_2', type: 'advisor', color: 'red', x: 5, y: 9 },
  { id: 'r_e_2', type: 'elephant', color: 'red', x: 6, y: 9 },
  { id: 'r_h_2', type: 'horse', color: 'red', x: 7, y: 9 },
  { id: 'r_c_2', type: 'chariot', color: 'red', x: 8, y: 9 },
  { id: 'r_ca_1', type: 'cannon', color: 'red', x: 1, y: 7 },
  { id: 'r_ca_2', type: 'cannon', color: 'red', x: 7, y: 7 },
  { id: 'r_s_1', type: 'soldier', color: 'red', x: 0, y: 6 },
  { id: 'r_s_2', type: 'soldier', color: 'red', x: 2, y: 6 },
  { id: 'r_s_3', type: 'soldier', color: 'red', x: 4, y: 6 },
  { id: 'r_s_4', type: 'soldier', color: 'red', x: 6, y: 6 },
  { id: 'r_s_5', type: 'soldier', color: 'red', x: 8, y: 6 },
];
