import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });
  const PORT = process.env.PORT || 3000;

  // 儲存房間狀態
  const rooms = new Map();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // 建立房間
    socket.on("create_room", (roomId) => {
      if (rooms.has(roomId)) {
        socket.emit("error", "房間代碼已存在，請換一個");
        return;
      }
      socket.join(roomId);
      rooms.set(roomId, { 
        players: { red: socket.id, black: null }, 
        gameState: null // 儲存棋盤歷史與狀態
      });
      socket.emit("room_created", { roomId, color: 'red' });
    });

    // 加入房間
    socket.on("join_room", (roomId) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit("error", "找不到此房間");
        return;
      }
      if (room.players.black) {
        socket.emit("error", "房間已滿");
        return;
      }
      socket.join(roomId);
      room.players.black = socket.id;
      
      socket.emit("room_joined", { 
        roomId, 
        color: 'black', 
        gameState: room.gameState 
      });
      
      // 通知紅方，黑方已加入
      socket.to(roomId).emit("player_joined", "black");
    });

    // 同步遊戲狀態（移動棋子、悔棋、重置）
    socket.on("sync_state", ({ roomId, state }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.gameState = state;
        // 廣播給房間內的其他玩家
        socket.to(roomId).emit("state_updated", state);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      // 簡單清理：如果玩家斷線，尋找他所在的房間並通知對手
      for (const [roomId, room] of rooms.entries()) {
        if (room.players.red === socket.id || room.players.black === socket.id) {
          socket.to(roomId).emit("player_disconnected");
          rooms.delete(roomId); // 為了簡單起見，一人斷線就關閉房間
          break;
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
