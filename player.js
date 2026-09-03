/* ============================================================
   Bible Buzzer — Player logic
   ============================================================ */

const playerId = generatePlayerId();
let playerName = "";
let roomCode = "";
let channel = null;
let currentQuestionIndex = -1;
let hasAnsweredThisRound = false;
let myScore = 0;

// ---- DOM refs ----
const joinView = document.getElementById("joinView");
const waitingView = document.getElementById("waitingView");
const questionView = document.getElementById("questionView");
const finalViewP = document.getElementById("finalViewP");

const roomInput = document.getElementById("roomInput");
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const joinError = document.getElementById("joinError");

const waitingRoom = document.getElementById("waitingRoom");
const waitingName = document.getElementById("waitingName");

const questionCounterP = document.getElementById("questionCounterP");
const myScoreEl = document.getElementById("myScore");
const questionTextP = document.getElementById("questionTextP");
const tileGridP = document.getElementById("tileGridP");
const statusP = document.getElementById("statusP");

const finalResultP = document.getElementById("finalResultP");
const finalScoreLineP = document.getElementById("finalScoreLineP");

// Prefill room code from ?room=XXXX in the join URL / QR code
const params = new URLSearchParams(location.search);
if (params.get("room")) roomInput.value = params.get("room").toUpperCase();

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}

function showView(view) {
  [joinView, waitingView, questionView, finalViewP].forEach(v => v.classList.add("hidden"));
  view.classList.remove("hidden");
}

joinBtn.addEventListener("click", () => join());
roomInput.addEventListener("keydown", e => { if (e.key === "Enter") nameInput.focus(); });
nameInput.addEventListener("keydown", e => { if (e.key === "Enter") join(); });

function join() {
  const code = roomInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();
  joinError.textContent = "";

  if (code.length !== 4) { joinError.textContent = "Room code should be 4 letters."; return; }
  if (!name) { joinError.textContent = "Please enter your name."; return; }

  roomCode = code;
  playerName = name;
  joinBtn.disabled = true;
  joinBtn.textContent = "Joining…";

  connectPieSocket(roomCode).then(ch => {
    channel = ch;
    channel.publish("join", { playerId, playerName });

    channel.listen("question", data => {
      currentQuestionIndex = data.index;
      hasAnsweredThisRound = false;
      renderQuestion(data);
    });

    channel.listen("result", data => renderResult(data));
    channel.listen("game_over", data => renderFinal(data));

    waitingRoom.textContent = roomCode;
    waitingName.textContent = playerName;
    showView(waitingView);
  }).catch(() => {
    joinError.textContent = "Couldn't connect. Check the room code and your internet connection.";
    joinBtn.disabled = false;
    joinBtn.textContent = "Join Game";
  });
}

function renderQuestion(data) {
  questionCounterP.textContent = `Q ${data.index + 1}/${data.total}`;
  questionTextP.textContent = data.question;
  statusP.textContent = "Tap the correct answer!";

  tileGridP.innerHTML = data.options.map((opt, i) => `
    <button class="tile" data-slot="${i}" type="button">
      <span class="letter">${TILE_LETTERS[i]}</span>
      <span class="text">${escapeHtml(opt)}</span>
    </button>
  `).join("");

  tileGridP.querySelectorAll(".tile").forEach(btn => {
    btn.addEventListener("click", () => answer(Number(btn.dataset.slot)));
  });

  showView(questionView);
}

function answer(slotIndex) {
  if (hasAnsweredThisRound || !channel) return;
  hasAnsweredThisRound = true;

  tileGridP.querySelectorAll(".tile").forEach(btn => {
    btn.disabled = true;
    if (Number(btn.dataset.slot) !== slotIndex) btn.classList.add("is-locked");
  });
  statusP.textContent = "Waiting to see if you were first…";

  channel.publish("buzz", {
    playerId,
    playerName,
    answerIndex: slotIndex,
    questionIndex: currentQuestionIndex,
  });
}

function renderResult(data) {
  if (data.questionIndex !== currentQuestionIndex) return;

  const scores = data.scores || {};
  if (scores[playerId]) {
    myScore = scores[playerId].score;
    myScoreEl.textContent = myScore;
  }

  tileGridP.querySelectorAll(".tile").forEach(btn => {
    const slot = Number(btn.dataset.slot);
    if (slot === data.correctIndex) btn.classList.add("is-correct");
    else btn.classList.add("is-locked");
  });

  if (data.winnerId === playerId) {
    statusP.textContent = "✅ Correct! You scored the point.";
  } else if (data.winnerId) {
    statusP.textContent = `👏 ${data.winnerName} got it first.`;
  } else {
    statusP.textContent = "⏳ Time's up — nobody scored.";
  }
}

function renderFinal(data) {
  const scores = data.scores || {};
  const ids = Object.keys(scores);
  const sorted = ids.sort((a, b) => scores[b].score - scores[a].score);

  if (sorted.length >= 2 && scores[sorted[0]].score === scores[sorted[1]].score) {
    finalResultP.textContent = "🤝 It's a tie!";
  } else if (sorted[0] === playerId) {
    finalResultP.textContent = "🏆 You won!";
  } else if (sorted.length) {
    finalResultP.textContent = `${scores[sorted[0]].name} won this round.`;
  } else {
    finalResultP.textContent = "Game over";
  }

  finalScoreLineP.textContent = sorted.map(id => `${scores[id].name}: ${scores[id].score}`).join("  ·  ");
  showView(finalViewP);
}
