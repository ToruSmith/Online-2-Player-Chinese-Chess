import React, { useState, useEffect, useRef } from 'react';
import { Undo2, RotateCcw, AlertTriangle, Trophy, Users, LogOut } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { Piece, PieceColor, Position, getValidMoves, INITIAL_BOARD, getPieceAt, checkGameState, GameState } from './lib/chessRules';

// 輔助函數：取得棋子顯示文字
const getPieceText = (piece: Piece) => {
  const isRed = piece.color === 'red';
  switch (piece.type) {
    case 'general': return isRed ? '帥' : '將';
    case 'advisor': return isRed ? '仕' : '士';
    case 'elephant': return isRed ? '相' : '象';
    case 'horse': return '馬';
    case 'chariot': return isRed ? '俥' : '車';
    case 'cannon': return isRed ? '炮' : '砲';
    case 'soldier': return isRed ? '兵' : '卒';
    default: return '';
  }
};

// 繪製棋盤上的「花點」
const renderStarMarks = (x: number, y: number) => {
  const cx = x * 100;
  const cy = y * 100;
  const offset = 8;
  const len = 15;
  const marks = [];

  if (x > 0) marks.push(<path key={`tl-${x}-${y}`} d={`M ${cx - offset - len},${cy - offset} L ${cx - offset},${cy - offset} L ${cx - offset},${cy - offset - len}`} fill="none" stroke="#78350f" strokeWidth="3" />);
  if (x < 8) marks.push(<path key={`tr-${x}-${y}`} d={`M ${cx + offset + len},${cy - offset} L ${cx + offset},${cy - offset} L ${cx + offset},${cy - offset - len}`} fill="none" stroke="#78350f" strokeWidth="3" />);
  if (x > 0) marks.push(<path key={`bl-${x}-${y}`} d={`M ${cx - offset - len},${cy + offset} L ${cx - offset},${cy + offset} L ${cx - offset},${cy + offset + len}`} fill="none" stroke="#78350f" strokeWidth="3" />);
  if (x < 8) marks.push(<path key={`br-${x}-${y}`} d={`M ${cx + offset + len},${cy + offset} L ${cx + offset},${cy + offset} L ${cx + offset},${cy + offset + len}`} fill="none" stroke="#78350f" strokeWidth="3" />);

  return marks;
};

// 建立 Socket 連線 (只在需要時建立)
let socket: Socket | null = null;

export default function App() {
  // 遊戲狀態
  const [history, setHistory] = useState<Piece[][]>([INITIAL_BOARD]);
  const [currentStep, setCurrentStep] = useState(0);
  const [turn, setTurn] = useState<PieceColor>('red');
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [gameState, setGameState] = useState<GameState>('playing');

  // 連線狀態
  const [roomId, setRoomId] = useState<string>('');
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [playerColor, setPlayerColor] = useState<PieceColor | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const lastActionTime = useRef(0);
  const roomInfoRef = useRef({ id: '', color: null as PieceColor | null });

  const currentBoard = history[currentStep];
  const isGameOver = gameState === 'checkmate' || gameState === 'stalemate';

  // 更新 ref 以供 socket 監聽器使用
  useEffect(() => {
    roomInfoRef.current = { id: roomId, color: playerColor };
  }, [roomId, playerColor]);

  // 初始化 Socket 連線
  useEffect(() => {
    socket = io();

    socket.on('connect', () => {
      const { id, color } = roomInfoRef.current;
      if (id && color) {
        socket?.emit('rejoin_room', { roomId: id, color });
      }
    });

    socket.on('room_created', ({ roomId, color }) => {
      setRoomId(roomId);
      setPlayerColor(color);
      setErrorMsg('');
      resetGameLocally();
    });

    socket.on('room_joined', ({ roomId, color, gameState }) => {
      setRoomId(roomId);
      setPlayerColor(color);
      setOpponentConnected(true);
      setErrorMsg('');
      if (gameState) {
        syncStateFromNetwork(gameState);
      } else {
        resetGameLocally();
      }
    });

    socket.on('player_joined', () => {
      setOpponentConnected(true);
    });

    socket.on('player_disconnected', () => {
      setOpponentConnected(false);
      setErrorMsg('對手已斷線');
    });

    socket.on('state_updated', (newState) => {
      syncStateFromNetwork(newState);
    });

    socket.on('error', (msg) => {
      setErrorMsg(msg);
    });

    return () => {
      socket?.disconnect();
    };
  }, []);

  const syncStateFromNetwork = (state: any) => {
    setHistory(state.history);
    setCurrentStep(state.currentStep);
    setTurn(state.turn);
    setGameState(state.gameState);
    setSelectedPiece(null);
    setValidMoves([]);
  };

  const broadcastState = (newHistory: Piece[][], newStep: number, newTurn: PieceColor, newGameState: GameState) => {
    if (socket && roomId) {
      socket.emit('sync_state', {
        roomId,
        state: {
          history: newHistory,
          currentStep: newStep,
          turn: newTurn,
          gameState: newGameState
        }
      });
    }
  };

  const handleCreateRoom = () => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    socket?.emit('create_room', newRoomId);
  };

  const handleJoinRoom = () => {
    if (inputRoomId.trim()) {
      socket?.emit('join_room', inputRoomId.trim());
    }
  };

  const handleLeaveRoom = () => {
    socket?.disconnect();
    socket = io(); // 重新建立連線
    setRoomId('');
    setPlayerColor(null);
    setOpponentConnected(false);
    resetGameLocally();
    
    // 重新綁定事件
    socket.on('room_created', ({ roomId, color }) => { setRoomId(roomId); setPlayerColor(color); setErrorMsg(''); resetGameLocally(); });
    socket.on('room_joined', ({ roomId, color, gameState }) => { setRoomId(roomId); setPlayerColor(color); setOpponentConnected(true); setErrorMsg(''); if (gameState) syncStateFromNetwork(gameState); else resetGameLocally(); });
    socket.on('player_joined', () => setOpponentConnected(true));
    socket.on('player_disconnected', () => { setOpponentConnected(false); setErrorMsg('對手已斷線'); });
    socket.on('state_updated', syncStateFromNetwork);
    socket.on('error', setErrorMsg);
  };

  const resetGameLocally = () => {
    setHistory([INITIAL_BOARD]);
    setCurrentStep(0);
    setTurn('red');
    setSelectedPiece(null);
    setValidMoves([]);
    setGameState('playing');
  };

  const handleSquareClick = (x: number, y: number) => {
    if (isGameOver) return;
    // 連線模式下，只能在自己的回合移動
    if (roomId && turn !== playerColor) return;
    if (roomId && !opponentConnected) return; // 對手還沒加入不能下

    const clickedPiece = getPieceAt(x, y, currentBoard);
    const isMoveValid = validMoves.some(m => m.x === x && m.y === y);

    if (selectedPiece && isMoveValid) {
      const now = Date.now();
      if (now - lastActionTime.current < 500) return; // 防連點
      lastActionTime.current = now;

      const newBoard = currentBoard
        .filter(p => !(p.x === x && p.y === y))
        .map(p => p.id === selectedPiece.id ? { ...p, x, y } : p);

      const newHistory = history.slice(0, currentStep + 1);
      newHistory.push(newBoard);
      
      const nextTurn = turn === 'red' ? 'black' : 'red';
      const newGameState = checkGameState(nextTurn, newBoard);

      setHistory(newHistory);
      setCurrentStep(newHistory.length - 1);
      setTurn(nextTurn);
      setSelectedPiece(null);
      setValidMoves([]);
      setGameState(newGameState);

      broadcastState(newHistory, newHistory.length - 1, nextTurn, newGameState);
      return;
    }

    if (clickedPiece && clickedPiece.color === turn) {
      setSelectedPiece(clickedPiece);
      setValidMoves(getValidMoves(clickedPiece, currentBoard));
      return;
    }

    setSelectedPiece(null);
    setValidMoves([]);
  };

  const handleUndo = () => {
    // 連線模式下，只能在對手回合（也就是自己剛下完）悔棋
    if (roomId && turn === playerColor) return;

    if (currentStep > 0) {
      const now = Date.now();
      if (now - lastActionTime.current < 500) return;
      lastActionTime.current = now;

      const prevStep = currentStep - 1;
      const prevBoard = history[prevStep];
      const prevTurn = turn === 'red' ? 'black' : 'red';
      const prevGameState = checkGameState(prevTurn, prevBoard);

      setCurrentStep(prevStep);
      setTurn(prevTurn);
      setSelectedPiece(null);
      setValidMoves([]);
      setGameState(prevGameState);

      broadcastState(history, prevStep, prevTurn, prevGameState);
    }
  };

  const handleReset = () => {
    const now = Date.now();
    if (now - lastActionTime.current < 500) return;
    lastActionTime.current = now;

    resetGameLocally();
    broadcastState([INITIAL_BOARD], 0, 'red', 'playing');
  };

  // 渲染大廳畫面
  if (!roomId) {
    return (
      <div className="min-h-screen bg-[#f8f1e4] flex flex-col items-center justify-center py-4 px-4 font-sans">
        <div className="bg-[#E8C382] p-6 sm:p-8 rounded-3xl shadow-2xl border-[6px] border-[#8B4513] w-full max-w-md text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 mb-8 tracking-wider" style={{ fontFamily: '"Kaiti", "STKaiti", serif' }}>親子中國象棋</h1>
          
          <div className="space-y-6">
            <button
              onClick={handleCreateRoom}
              className="w-full py-4 sm:py-5 bg-red-700 text-white rounded-2xl font-bold text-lg sm:text-xl shadow-lg hover:bg-red-800 active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 border-red-900"
            >
              <Users size={24} />
              建立新房間 (我是紅方)
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t-2 border-amber-900/20"></div>
              <span className="flex-shrink-0 mx-4 text-amber-900/60 font-bold">或加入朋友的房間</span>
              <div className="flex-grow border-t-2 border-amber-900/20"></div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="輸入 4 碼代號"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
                className="flex-1 px-4 py-4 rounded-2xl border-2 border-amber-900/30 bg-white/90 text-center text-2xl font-bold text-amber-900 focus:outline-none focus:border-amber-900 focus:ring-4 focus:ring-amber-900/20 transition-all placeholder:text-amber-900/30 placeholder:text-lg"
                maxLength={4}
                inputMode="numeric"
              />
              <button
                onClick={handleJoinRoom}
                disabled={!inputRoomId || inputRoomId.length !== 4}
                className="py-4 px-8 bg-slate-800 text-white rounded-2xl font-bold text-lg sm:text-xl shadow-lg hover:bg-slate-900 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 border-b-4 border-slate-950"
              >
                加入
              </button>
            </div>
            
            {errorMsg && <p className="text-red-600 font-bold mt-2 bg-red-100 py-2 rounded-lg border border-red-200">{errorMsg}</p>}
          </div>
        </div>
      </div>
    );
  }

  // 渲染遊戲畫面
  return (
    <div className="min-h-screen bg-[#f8f1e4] flex flex-col items-center py-4 sm:py-8 font-sans relative px-2">
      <div className="mb-2 sm:mb-4 w-full max-w-[480px] flex justify-between items-center bg-white/40 p-2 rounded-xl border border-amber-200/50 shadow-sm">
        <button onClick={handleLeaveRoom} className="flex items-center gap-1 sm:gap-2 text-amber-900/70 hover:text-amber-900 transition-colors font-bold text-sm sm:text-base bg-white px-3 py-1.5 rounded-lg shadow-sm border border-amber-200">
          <LogOut size={16} /> 離開
        </button>
        <div className="text-amber-900 font-bold bg-amber-200/50 px-3 py-1.5 rounded-lg border border-amber-300 text-sm sm:text-base flex items-center gap-2">
          房間代碼 <span className="text-lg sm:text-xl tracking-widest bg-white px-2 rounded text-amber-700 shadow-inner">{roomId}</span>
        </div>
      </div>

      <div className="mb-3 sm:mb-4 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-amber-900 mb-2 tracking-wider">親子中國象棋</h1>
        <div className="flex items-center justify-center gap-3">
          <p className="text-sm sm:text-base font-medium text-amber-800 bg-amber-100/80 px-3 py-1 rounded-full border border-amber-300 shadow-sm">
            輪到：<span className={turn === 'red' ? 'text-red-600 font-bold text-base sm:text-lg' : 'text-slate-900 font-bold text-base sm:text-lg'}>{turn === 'red' ? '紅方' : '黑方'}</span>
          </p>
          <p className="text-sm sm:text-base font-medium text-amber-800 bg-white/60 px-3 py-1 rounded-full border border-amber-200 shadow-sm">
            你是：<span className={playerColor === 'red' ? 'text-red-600 font-bold' : 'text-slate-900 font-bold'}>{playerColor === 'red' ? '紅方' : '黑方'}</span>
          </p>
        </div>
        {!opponentConnected && <p className="mt-2 text-sm font-bold text-red-600 animate-pulse bg-red-100 inline-block px-3 py-1 rounded-full border border-red-200">等待對手連線中...</p>}
      </div>

      {gameState === 'check' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-full shadow-xl font-bold text-lg sm:text-xl flex items-center gap-2 animate-bounce z-50 border-2 border-red-200">
          <AlertTriangle size={20} />
          將軍！
        </div>
      )}

      <div className="flex gap-2 sm:gap-4 mb-4 w-full max-w-[340px] sm:max-w-[480px]">
        <button
          onClick={handleUndo}
          disabled={currentStep === 0 || turn === playerColor || !opponentConnected}
          className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 py-2.5 sm:py-3 bg-white border-2 border-amber-300 rounded-xl shadow-sm hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-amber-900 font-bold text-sm sm:text-base"
          title={turn === playerColor ? "只能在對手回合悔棋" : ""}
        >
          <Undo2 size={18} />
          悔棋
        </button>
        <button
          onClick={handleReset}
          disabled={!opponentConnected}
          className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 py-2.5 sm:py-3 bg-white border-2 border-red-200 rounded-xl shadow-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-red-700 font-bold text-sm sm:text-base"
        >
          <RotateCcw size={18} />
          重新開始
        </button>
      </div>

      {/* 棋盤外框 */}
      <div className={`relative bg-[#E8C382] p-3 sm:p-5 rounded-xl shadow-2xl border-[6px] border-[#8B4513] transition-opacity ${!opponentConnected ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* 內框 */}
        <div className="relative border-2 border-[#8B4513] p-[20px] sm:p-[25px]">
          
          <div className={`relative w-[320px] h-[360px] sm:w-[480px] sm:h-[540px] transition-transform duration-500 ${playerColor === 'black' ? 'rotate-180' : ''}`}>
            
            {/* SVG 繪製的完美棋盤線條 */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 800 900" preserveAspectRatio="none">
              {Array.from({ length: 10 }).map((_, i) => (
                <line key={`h-${i}`} x1="0" y1={i * 100} x2="800" y2={i * 100} stroke="#78350f" strokeWidth="3" />
              ))}
              
              {Array.from({ length: 9 }).map((_, i) => {
                if (i === 0 || i === 8) return <line key={`v-${i}`} x1={i * 100} y1="0" x2={i * 100} y2="900" stroke="#78350f" strokeWidth="3" />;
                return (
                  <g key={`v-${i}`}>
                    <line x1={i * 100} y1="0" x2={i * 100} y2="400" stroke="#78350f" strokeWidth="3" />
                    <line x1={i * 100} y1="500" x2={i * 100} y2="900" stroke="#78350f" strokeWidth="3" />
                  </g>
                );
              })}

              <line x1="300" y1="0" x2="500" y2="200" stroke="#78350f" strokeWidth="2" />
              <line x1="500" y1="0" x2="300" y2="200" stroke="#78350f" strokeWidth="2" />
              <line x1="300" y1="700" x2="500" y2="900" stroke="#78350f" strokeWidth="2" />
              <line x1="500" y1="700" x2="300" y2="900" stroke="#78350f" strokeWidth="2" />

              {[
                {x: 1, y: 2}, {x: 7, y: 2}, {x: 0, y: 3}, {x: 2, y: 3}, {x: 4, y: 3}, {x: 6, y: 3}, {x: 8, y: 3},
                {x: 1, y: 7}, {x: 7, y: 7}, {x: 0, y: 6}, {x: 2, y: 6}, {x: 4, y: 6}, {x: 6, y: 6}, {x: 8, y: 6},
              ].map(pos => renderStarMarks(pos.x, pos.y))}
            </svg>

            {/* 楚河漢界文字 */}
            <div className="absolute top-[44.44%] left-0 right-0 h-[11.11%] flex items-center justify-around z-0 pointer-events-none">
              <span className={`text-[#78350f] text-3xl sm:text-4xl font-bold tracking-[1.5em] ml-12 opacity-80 ${playerColor === 'black' ? 'rotate-180' : ''}`} style={{ fontFamily: '"Kaiti", "STKaiti", serif' }}>楚河</span>
              <span className={`text-[#78350f] text-3xl sm:text-4xl font-bold tracking-[1.5em] opacity-80 ${playerColor === 'black' ? 'rotate-180' : ''}`} style={{ fontFamily: '"Kaiti", "STKaiti", serif' }}>漢界</span>
            </div>

            {/* 互動網格 */}
            <div className="absolute inset-0 grid grid-cols-9 grid-rows-10 z-10 -m-[20px] sm:-m-[25px] w-[calc(100%+40px)] h-[calc(100%+50px)] sm:w-[calc(100%+50px)] sm:h-[calc(100%+50px)]">
              {Array.from({ length: 90 }).map((_, i) => {
                const x = i % 9;
                const y = Math.floor(i / 9);
                const isMoveValid = validMoves.some(m => m.x === x && m.y === y);
                
                return (
                  <div
                    key={`cell-${x}-${y}`}
                    onClick={() => handleSquareClick(x, y)}
                    className="relative flex items-center justify-center cursor-pointer group"
                  >
                    <div className="absolute w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/0 group-hover:bg-white/30 transition-colors z-10" />
                    {isMoveValid && (
                      <div className="absolute w-5 h-5 bg-green-500 rounded-full z-20 shadow-[0_0_10px_rgba(34,197,94,0.6)] border-2 border-white animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* 渲染棋子 */}
            {currentBoard.map((piece) => {
              const isSelected = selectedPiece?.id === piece.id;
              const left = `${piece.x * 12.5}%`;
              const top = `${piece.y * 11.11}%`;

              return (
                <div
                  key={piece.id}
                  className={`absolute w-[36px] h-[36px] sm:w-[50px] sm:h-[50px] -ml-[18px] -mt-[18px] sm:-ml-[25px] sm:-mt-[25px] rounded-full flex items-center justify-center font-bold text-xl sm:text-3xl shadow-[0_4px_6px_rgba(0,0,0,0.3),inset_0_-4px_4px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,0.5)] border-2 transition-all duration-200 z-30 pointer-events-none
                    ${piece.color === 'red' 
                      ? 'bg-gradient-to-b from-[#FFF5E1] to-[#F5DEB3] text-[#C8102E] border-[#A00000]' 
                      : 'bg-gradient-to-b from-[#FFF5E1] to-[#F5DEB3] text-[#1A1A1A] border-[#1A1A1A]'}
                    ${isSelected ? 'ring-4 ring-green-400 ring-offset-2 ring-offset-[#E8C382] scale-110 shadow-2xl z-40' : ''}
                  `}
                  style={{ 
                    left, 
                    top,
                    fontFamily: '"Kaiti", "STKaiti", serif',
                    textShadow: piece.color === 'red' ? '0 1px 1px rgba(200,16,46,0.2)' : '0 1px 1px rgba(0,0,0,0.2)'
                  }}
                >
                  <div className={`w-[82%] h-[82%] rounded-full border-[1.5px] flex items-center justify-center ${playerColor === 'black' ? 'rotate-180' : ''}
                    ${piece.color === 'red' ? 'border-[#C8102E]/40' : 'border-[#1A1A1A]/40'}
                  `}>
                    {getPieceText(piece)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isGameOver && (
          <div className="absolute inset-0 bg-black/50 z-50 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <div className="bg-[#f8f1e4] p-8 rounded-2xl shadow-2xl text-center transform scale-110 border-4 border-amber-700">
              <Trophy className={`w-20 h-20 mx-auto mb-4 ${turn === 'red' ? 'text-slate-800' : 'text-red-600'}`} />
              <h2 className="text-4xl font-bold mb-3 text-amber-900 tracking-widest">遊戲結束</h2>
              <p className="text-2xl font-bold mb-8">
                {gameState === 'checkmate' ? (
                  <span className={turn === 'red' ? 'text-slate-800' : 'text-red-600'}>
                    {turn === 'red' ? '黑方' : '紅方'} 絕殺獲勝！
                  </span>
                ) : (
                  <span className="text-amber-700">雙方平手（困斃）</span>
                )}
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleUndo}
                  disabled={turn === playerColor}
                  className="px-6 py-3 bg-white border-2 border-amber-300 text-amber-900 rounded-xl font-bold hover:bg-amber-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  悔棋重下
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-md"
                >
                  再來一局
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-8 bg-white/60 px-6 py-4 rounded-xl border border-amber-200 text-amber-800/80 text-sm max-w-md text-center shadow-sm">
        <p className="mb-1 font-medium">💡 將房間代碼告訴對手，即可開始連線對戰。</p>
        <p>只有在自己的回合才能移動棋子喔！</p>
      </div>
    </div>
  );
}
