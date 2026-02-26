function createGame(gameCode) {
  return {
    gameCode,
    board: [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ],
    currentTurn: 'X',
    status: 'waiting',
    winner: null,
    players: { X: null, O: null },
  };
}

function checkWinner(board) {
  const lines = [
    // rows
    [[0,0],[0,1],[0,2]],
    [[1,0],[1,1],[1,2]],
    [[2,0],[2,1],[2,2]],
    // cols
    [[0,0],[1,0],[2,0]],
    [[0,1],[1,1],[2,1]],
    [[0,2],[1,2],[2,2]],
    // diagonals
    [[0,0],[1,1],[2,2]],
    [[0,2],[1,1],[2,0]],
  ];
  for (const line of lines) {
    const [a, b, c] = line;
    const v = board[a[0]][a[1]];
    if (v && v === board[b[0]][b[1]] && v === board[c[0]][c[1]]) {
      return v;
    }
  }
  return null;
}

function checkDraw(board) {
  return board.every(row => row.every(cell => cell !== ''));
}

function isValidMove(state, row, col, player) {
  if (state.status !== 'playing') return 'Game is not in progress';
  if (state.currentTurn !== player) return 'Not your turn';
  if (row < 0 || row > 2 || col < 0 || col > 2) return 'Invalid position';
  if (state.board[row][col] !== '') return 'Cell is already occupied';
  return null;
}

function makeMove(state, row, col, player) {
  const error = isValidMove(state, row, col, player);
  if (error) return { error };

  state.board[row][col] = player;

  const winner = checkWinner(state.board);
  if (winner) {
    state.status = 'won';
    state.winner = winner;
  } else if (checkDraw(state.board)) {
    state.status = 'draw';
  } else {
    state.currentTurn = player === 'X' ? 'O' : 'X';
  }

  return { state };
}

module.exports = { createGame, makeMove, checkWinner, checkDraw, isValidMove };
