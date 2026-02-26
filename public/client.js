// ── Socket.IO Connection ────────────────────────────
const socket = io();

// ── DOM References ──────────────────────────────────
const lobbyScreen = document.getElementById("lobby");
const gameScreen = document.getElementById("game");
const createBtn = document.getElementById("create-btn");
const joinBtn = document.getElementById("join-btn");
const codeInput = document.getElementById("code-input");
const lobbyError = document.getElementById("lobby-error");
const gameCodeEl = document.getElementById("game-code");
const playerSymbolEl = document.getElementById("player-symbol");
const statusBar = document.getElementById("status-bar");
const boardEl = document.getElementById("board");
const cells = boardEl.querySelectorAll(".cell");
const backBtn = document.getElementById("back-btn");
const findMatchBtn = document.getElementById("find-match-btn");
const cancelMatchBtn = document.getElementById("cancel-match-btn");
const matchmakingStatus = document.getElementById("matchmaking-status");

// ── Client State ────────────────────────────────────
let mySymbol = null; // 'X' or 'O'
let gameState = null; // latest game-update payload
let gameOver = false;

// ── Session Persistence ─────────────────────────────
function saveSession(gameCode, symbol, playerId) {
  sessionStorage.setItem("ttt_gameCode", gameCode);
  sessionStorage.setItem("ttt_symbol", symbol);
  sessionStorage.setItem("ttt_playerId", playerId);
}

function clearSession() {
  sessionStorage.removeItem("ttt_gameCode");
  sessionStorage.removeItem("ttt_symbol");
  sessionStorage.removeItem("ttt_playerId");
}

function getSavedSession() {
  const gameCode = sessionStorage.getItem("ttt_gameCode");
  const symbol = sessionStorage.getItem("ttt_symbol");
  const playerId = sessionStorage.getItem("ttt_playerId");
  if (gameCode && symbol && playerId) {
    return { gameCode, symbol, playerId };
  }
  return null;
}

// ── Attempt Rejoin on Load ──────────────────────────
function attemptRejoin() {
  const session = getSavedSession();
  if (!session) return;

  socket.emit("rejoin-game", { gameCode: session.gameCode, playerId: session.playerId }, (response) => {
    if (response.error) {
      clearSession();
      return;
    }
    mySymbol = response.symbol;
    gameCodeEl.textContent = session.gameCode;
    updateSymbolDisplay();
    showGame();
  });
}

socket.on("connect", () => {
  attemptRejoin();
});

// ── Screen Switching ────────────────────────────────
function showLobby() {
  lobbyScreen.hidden = false;
  gameScreen.hidden = true;
  lobbyError.hidden = true;
  lobbyError.textContent = "";
  codeInput.value = "";
  mySymbol = null;
  gameState = null;
  gameOver = false;
  clearSession();
  clearBoard();
  // Reset matchmaking UI and cancel if queued
  socket.emit("cancel-match");
  findMatchBtn.hidden = false;
  matchmakingStatus.hidden = true;
}

function showGame() {
  lobbyScreen.hidden = true;
  gameScreen.hidden = false;
}

// ── Lobby Actions ───────────────────────────────────
createBtn.addEventListener("click", () => {
  createBtn.disabled = true;
  socket.emit("create-game", (response) => {
    createBtn.disabled = false;
    if (response && response.gameCode) {
      mySymbol = "X"; // creator is always X
      saveSession(response.gameCode, "X", response.playerId);
      gameCodeEl.textContent = response.gameCode;
      updateSymbolDisplay();
      showGame();
      setStatus("Waiting for opponent...", "waiting");
    }
  });
});

joinBtn.addEventListener("click", () => {
  const gameCode = codeInput.value.trim().toUpperCase();
  if (!gameCode) {
    showLobbyError("Please enter a game code.");
    return;
  }

  joinBtn.disabled = true;
  socket.emit("join-game", { gameCode }, (response) => {
    joinBtn.disabled = false;
    if (response && response.error) {
      showLobbyError(response.error);
    } else {
      mySymbol = "O"; // joiner is always O
      saveSession(gameCode, "O", response.playerId);
      gameCodeEl.textContent = gameCode;
      updateSymbolDisplay();
      showGame();
    }
  });
});

codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    joinBtn.click();
  }
});

// ── Matchmaking ────────────────────────────────────
findMatchBtn.addEventListener("click", () => {
  findMatchBtn.hidden = true;
  matchmakingStatus.hidden = false;
  socket.emit("find-match", (response) => {
    if (response && response.error) {
      findMatchBtn.hidden = false;
      matchmakingStatus.hidden = true;
      showLobbyError(response.error);
    }
  });
});

cancelMatchBtn.addEventListener("click", () => {
  socket.emit("cancel-match");
  findMatchBtn.hidden = false;
  matchmakingStatus.hidden = true;
});

socket.on("match-found", (data) => {
  findMatchBtn.hidden = false;
  matchmakingStatus.hidden = true;
  mySymbol = data.symbol;
  saveSession(data.gameCode, data.symbol, data.playerId);
  gameCodeEl.textContent = data.gameCode;
  updateSymbolDisplay();
  showGame();
});

function showLobbyError(msg) {
  lobbyError.textContent = msg;
  lobbyError.hidden = false;
}

// ── Board Interaction ───────────────────────────────
cells.forEach((cell) => {
  cell.addEventListener("click", () => {
    if (!mySymbol || gameOver) return;
    if (!gameState || gameState.status !== "playing") return;
    if (gameState.currentTurn !== mySymbol) return;

    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);

    // Don't click on occupied cells
    if (gameState.board[row][col] !== "") return;

    socket.emit("make-move", { row, col });
  });
});

// ── Server Event Handlers ───────────────────────────
socket.on("game-update", (data) => {
  gameState = data;
  renderBoard(data.board);
  updateStatus(data);
});

socket.on("move-error", (data) => {
  // Briefly flash the status bar with the error
  const prev = statusBar.textContent;
  const prevClass = statusBar.className;
  setStatus(data.message, "lost");
  setTimeout(() => {
    statusBar.textContent = prev;
    statusBar.className = prevClass;
  }, 1500);
});

socket.on("opponent-disconnected", () => {
  setStatus("Opponent disconnected. Waiting for reconnect...", "disconnected");
  disableAllCells();
});

// ── Rendering ───────────────────────────────────────
function renderBoard(board) {
  cells.forEach((cell) => {
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    const val = board[r][c]; // '', 'X', or 'O'

    cell.textContent = val;
    cell.classList.remove("x", "o", "taken", "disabled");

    if (val) {
      cell.classList.add(val.toLowerCase(), "taken");
    }
  });

  // Disable cells if not our turn or game is over
  if (gameOver || !gameState || gameState.status !== "playing" || gameState.currentTurn !== mySymbol) {
    disableAllCells();
  }
}

function clearBoard() {
  cells.forEach((cell) => {
    cell.textContent = "";
    cell.classList.remove("x", "o", "taken", "disabled");
  });
}

function disableAllCells() {
  cells.forEach((cell) => cell.classList.add("disabled"));
}

function updateStatus(data) {
  const { status, currentTurn, winner } = data;

  switch (status) {
    case "waiting":
      setStatus("Waiting for opponent...", "waiting");
      break;

    case "playing":
      if (currentTurn === mySymbol) {
        setStatus("Your turn!", "turn-mine");
      } else {
        setStatus("Opponent's turn...", "turn-opponent");
      }
      break;

    case "won":
      gameOver = true;
      if (winner === mySymbol) {
        setStatus("You win!", "won");
      } else {
        setStatus(`You lose. ${winner} wins!`, "lost");
      }
      disableAllCells();
      break;

    case "draw":
      gameOver = true;
      setStatus("It's a draw!", "draw");
      disableAllCells();
      break;
  }
}

function setStatus(text, className) {
  statusBar.textContent = text;
  statusBar.className = "status-bar";
  if (className) {
    statusBar.classList.add(className);
  }
}

function updateSymbolDisplay() {
  playerSymbolEl.textContent = mySymbol;
  playerSymbolEl.className = "symbol " + mySymbol.toLowerCase();
}

// ── Back to Lobby ───────────────────────────────────
backBtn.addEventListener("click", () => {
  socket.emit("leave-game");
  showLobby();
});
