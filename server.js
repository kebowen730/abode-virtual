const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const { createGame, makeMove } = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const games = new Map();
const playerGameMap = new Map(); // socketId -> { gameCode, symbol, playerId }
const disconnectTimers = new Map(); // playerId -> timeout

const DISCONNECT_GRACE_MS = 30_000;

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

function generatePlayerId() {
  return crypto.randomBytes(8).toString('hex');
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
    const playerId = generatePlayerId();
    const game = createGame(gameCode);
    game.players.X = playerId;
    game.socketIds = { X: socket.id, O: null };
    games.set(gameCode, game);
    playerGameMap.set(socket.id, { gameCode, symbol: 'X', playerId });
    socket.join(gameCode);
    callback({ gameCode, playerId });
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

    const playerId = generatePlayerId();
    game.players.O = playerId;
    game.socketIds.O = socket.id;
    game.status = 'playing';
    playerGameMap.set(socket.id, { gameCode: code, symbol: 'O', playerId });
    socket.join(code);
    callback({ playerId });
    io.to(code).emit('game-update', getGameUpdate(game));
  });

  socket.on('rejoin-game', ({ gameCode, playerId }, callback) => {
    const code = (gameCode || '').toUpperCase().trim();
    const game = games.get(code);

    if (!game) {
      return callback({ error: 'Game not found' });
    }

    // Find which symbol this player was
    let symbol = null;
    if (game.players.X === playerId) symbol = 'X';
    else if (game.players.O === playerId) symbol = 'O';

    if (!symbol) {
      return callback({ error: 'Player not in this game' });
    }

    // Cancel any pending disconnect timer
    const timer = disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimers.delete(playerId);
    }

    // Reassociate socket
    game.socketIds[symbol] = socket.id;
    playerGameMap.set(socket.id, { gameCode: code, symbol, playerId });
    socket.join(code);
    callback({ symbol });
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
    playerGameMap.delete(socket.id);

    if (!game) return;

    // Clear the socket reference
    if (game.socketIds) {
      game.socketIds[info.symbol] = null;
    }

    // Notify opponent that player disconnected (they may reconnect)
    socket.to(info.gameCode).emit('opponent-disconnected', {});

    // Start grace period — delete game if player doesn't reconnect
    const timer = setTimeout(() => {
      disconnectTimers.delete(info.playerId);
      const currentGame = games.get(info.gameCode);
      if (!currentGame) return;

      // Check if the player actually reconnected (socketId would be set again)
      if (currentGame.socketIds && currentGame.socketIds[info.symbol]) return;

      // Player didn't reconnect — clean up game
      games.delete(info.gameCode);
    }, DISCONNECT_GRACE_MS);

    disconnectTimers.set(info.playerId, timer);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
