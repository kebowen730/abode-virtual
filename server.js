const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createGame, makeMove } = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const games = new Map();
const playerGameMap = new Map(); // socketId -> { gameCode, symbol }

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (games.has(code));
  return code;
}

function getGameUpdate(game) {
  return {
    board: game.board,
    currentTurn: game.currentTurn,
    status: game.status,
    winner: game.winner,
    players: {
      X: game.players.X ? true : false,
      O: game.players.O ? true : false,
    },
    gameCode: game.gameCode,
  };
}

io.on('connection', (socket) => {
  socket.on('create-game', (callback) => {
    const gameCode = generateCode();
    const game = createGame(gameCode);
    game.players.X = socket.id;
    games.set(gameCode, game);
    playerGameMap.set(socket.id, { gameCode, symbol: 'X' });
    socket.join(gameCode);
    callback({ gameCode });
    io.to(gameCode).emit('game-update', getGameUpdate(game));
  });

  socket.on('join-game', ({ gameCode }, callback) => {
    const code = (gameCode || '').toUpperCase().trim();
    const game = games.get(code);

    if (!game) {
      return callback({ error: 'Game not found' });
    }
    if (game.players.O) {
      return callback({ error: 'Game is full' });
    }

    game.players.O = socket.id;
    game.status = 'playing';
    playerGameMap.set(socket.id, { gameCode: code, symbol: 'O' });
    socket.join(code);
    callback({});
    io.to(code).emit('game-update', getGameUpdate(game));
  });

  socket.on('make-move', ({ row, col }) => {
    const info = playerGameMap.get(socket.id);
    if (!info) return;

    const game = games.get(info.gameCode);
    if (!game) return;

    const result = makeMove(game, row, col, info.symbol);
    if (result.error) {
      socket.emit('move-error', { message: result.error });
      return;
    }

    io.to(info.gameCode).emit('game-update', getGameUpdate(game));
  });

  socket.on('disconnect', () => {
    const info = playerGameMap.get(socket.id);
    if (!info) return;

    const game = games.get(info.gameCode);
    if (game) {
      socket.to(info.gameCode).emit('opponent-disconnected', {});
      games.delete(info.gameCode);
    }
    playerGameMap.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
