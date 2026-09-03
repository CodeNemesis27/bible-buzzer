/* ============================================================
   Bible Buzzer — Host / Display logic
   ============================================================ */

const ROOM_CODE = generateRoomCode();
const JOIN_URL = location.origin + location.pathname.replace(/host\.html$/, "player.html") + "?room=" + ROOM_CODE;

let channel = null;
let players = {};           // playerId -> { name, score }
let currentQuestionIndex = -1;
let questionLocked = false;
let timerInterval = null;
const QUESTION_SECONDS = 15;
const NEXT_DELAY_MS = 3200;

// ---- DOM refs ----
const lobbyView = document.getElementById("lobbyView");
const playView = document.getElementById("playView");
const finalView = document.getElementById("finalView");

const roomCodeText = document.getElementById("roomCodeText");
const roomCodeSmall = document.getElementById("roomCodeSmall");
const qrImg = document.getElementById("qrImg");
const joinUrlText = document.getElementById("joinUrlText");
const playerList = document.getElementById("playerList");
const startBtn = document.getElementById("startBtn");

const questionCounter = document.getElementById("questionCounter");
const questionText = document.getElementById("questionText");
const tileGrid = document.getElementById("tileGrid");
const timerFill = document.getElementById("timerFill");
const activityFeed = document.getElementById("activityFeed");
const scoreBoard = document.getElementById("scoreBoard");

const winnerText = document.getElementById("winnerText");
const finalScores = document.getElementById("finalScores");
const playAgainBtn = document.getElementById("playAgainBtn");

// ---- Setup lobby UI ----
roomCodeText.textContent = ROOM_CODE;
roomCodeSmall.textContent = ROOM_CODE;
joinUrlText.textContent = JOIN_URL;
qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(JOIN_URL);

function renderPlayerList() {
  const ids = Object.keys(players);
  if (ids.length === 0) {
    playerList.innerHTML = '<li class="muted" style="background:transparent;border:none;">Waiting for players…</li>';
    startBtn.disabled = true;
    return;
  }
  playerList.innerHTML = ids.map(id => `<li>${escapeHtml(players[id].name)}</li>`).join("");
  startBtn.disabled = false;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}

function renderScoreBoard() {
  const ids = Object.keys(players);
  scoreBoard.innerHTML = ids.map(id => {
    return `<span class="score-pill"><span class="dot" style="background:var(--brass);"></span>${escapeHtml(players[id].name)}: ${players[id].score}</span>`;
  }).join("");
}

// ---- Connect ----
connectPieSocket(ROOM_CODE).then(ch => {
  channel = ch;

  channel.listen("join", data => {
    if (!players[data.playerId]) {
      players[data.playerId] = { name: data.playerName, score: 0 };
      renderPlayerList();
      renderScoreBoard();
    }
  });

  channel.listen("buzz", data => handleBuzz(data));
});

startBtn.addEventListener("click", () => startGame());
playAgainBtn.addEventListener("click", () => {
  Object.values(players).forEach(p => (p.score = 0));
  finalView.classList.add("hidden");
  lobbyView.classList.remove("hidden");
  renderPlayerList();
});

function startGame() {
  currentQuestionIndex = -1;
  lobbyView.classList.add("hidden");
  finalView.classList.add("hidden");
  playView.classList.remove("hidden");
  nextQuestion();
}

function nextQuestion() {
  clearInterval(timerInterval);
  currentQuestionIndex++;
  if (currentQuestionIndex >= QUESTIONS.length) {
    endGame();
    return;
  }
  questionLocked = false;
  activityFeed.textContent = "";

  const q = QUESTIONS[currentQuestionIndex];
  questionCounter.textContent = `Question ${currentQuestionIndex + 1} / ${QUESTIONS.length}`;
  questionText.textContent = q.q;

  tileGrid.innerHTML = q.options.map((opt, i) => `
    <div class="tile" data-slot="${i}">
      <span class="letter">${TILE_LETTERS[i]}</span>
      <span class="text">${escapeHtml(opt)}</span>
    </div>
  `).join("");

  if (channel) {
    channel.publish("question", {
      index: currentQuestionIndex,
      total: QUESTIONS.length,
      question: q.q,
      options: q.options,
      seconds: QUESTION_SECONDS,
    });
  }

  startTimer(QUESTION_SECONDS);
}

function startTimer(seconds) {
  let remaining = seconds;
  timerFill.style.transition = "none";
  timerFill.style.width = "100%";
  void timerFill.offsetWidth; // force reflow so the transition below restarts cleanly
  timerFill.style.transition = `width ${seconds}s linear`;
  timerFill.style.width = "0%";

  timerInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      if (!questionLocked) {
        questionLocked = true;
        revealAnswer(null);
        channel && channel.publish("result", {
          questionIndex: currentQuestionIndex,
          winnerId: null,
          winnerName: null,
          correctIndex: QUESTIONS[currentQuestionIndex].correct,
          scores: players,
        });
        activityFeed.textContent = "⏳ Time's up! Nobody scored this round.";
        setTimeout(nextQuestion, NEXT_DELAY_MS);
      }
    }
  }, 1000);
}

function handleBuzz(data) {
  if (data.questionIndex !== currentQuestionIndex || questionLocked) return;
  const q = QUESTIONS[currentQuestionIndex];
  const isCorrect = data.answerIndex === q.correct;
  const playerName = players[data.playerId] ? players[data.playerId].name : "Someone";

  if (isCorrect) {
    questionLocked = true;
    clearInterval(timerInterval);
    if (players[data.playerId]) players[data.playerId].score++;
    renderScoreBoard();
    revealAnswer(data.answerIndex);
    activityFeed.textContent = `🏆 ${playerName} answered first and got it right!`;
    channel && channel.publish("result", {
      questionIndex: currentQuestionIndex,
      winnerId: data.playerId,
      winnerName: playerName,
      correctIndex: q.correct,
      scores: players,
    });
    setTimeout(nextQuestion, NEXT_DELAY_MS);
  } else {
    const tile = tileGrid.querySelector(`[data-slot="${data.answerIndex}"]`);
    if (tile) tile.classList.add("is-wrong");
    activityFeed.textContent = `❌ ${playerName} guessed wrong — still open!`;
    channel && channel.publish("wrong_buzz", { questionIndex: currentQuestionIndex, playerId: data.playerId });
  }
}

function revealAnswer(winningSlot) {
  const correctSlot = QUESTIONS[currentQuestionIndex].correct;
  tileGrid.querySelectorAll(".tile").forEach(tile => {
    const slot = Number(tile.dataset.slot);
    if (slot === correctSlot) tile.classList.add("is-correct");
    else tile.classList.add("is-locked");
  });
}

function endGame() {
  playView.classList.add("hidden");
  finalView.classList.remove("hidden");

  const ids = Object.keys(players);
  const sorted = ids.sort((a, b) => players[b].score - players[a].score);
  if (sorted.length >= 2 && players[sorted[0]].score === players[sorted[1]].score) {
    winnerText.textContent = "🤝 It's a tie!";
  } else if (sorted.length >= 1) {
    winnerText.textContent = `🏆 ${players[sorted[0]].name} wins!`;
  } else {
    winnerText.textContent = "Game over";
  }

  finalScores.innerHTML = sorted.map(id => `
    <div class="final-score-card">
      <div class="n">${players[id].score}</div>
      <div>${escapeHtml(players[id].name)}</div>
    </div>
  `).join("");

  channel && channel.publish("game_over", { scores: players });
}
