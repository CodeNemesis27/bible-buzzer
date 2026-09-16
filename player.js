/* ============================================================
   Song Scramble — Team logic
   ============================================================ */

const playerId = generatePlayerId();
let playerName = "";
let roomCode = "";
let channel = null;

let currentIndex = -1;
let tokens = [];        // canonical order for the current line
let pool = [];          // shuffled tokens still waiting to be tapped
let builtCount = 0;     // how many correct taps in a row so far
let locked = false;
let myScore = 0;

const WRONG_RESET_DELAY_MS = 500;

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
const sentenceBuilder = document.getElementById("sentenceBuilder");
const wordPool = document.getElementById("wordPool");
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
  if (!name) { joinError.textContent = "Please enter your team name."; return; }

  roomCode = code;
  playerName = name;
  joinBtn.disabled = true;
  joinBtn.textContent = "Joining…";

  connectPieSocket(roomCode).then(ch => {
    channel = ch;
    channel.publish("join", { playerId, playerName });

    channel.listen("round_start", data => {
      currentIndex = data.index;
      startRound();
    });

    channel.listen("round_result", data => renderRoundResult(data));
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

function startRound() {
  const song = SONGS[currentIndex];
  tokens = tokenizeLine(song.line);
  pool = shuffleTokens(tokens);
  builtCount = 0;
  locked = false;

  questionCounterP.textContent = `Song ${currentIndex + 1}/${SONGS.length}`;
  statusP.textContent = "Go! Tap the first word.";

  renderSentenceBuilder();
  renderPool();
  showView(questionView);
}

function renderSentenceBuilder() {
  sentenceBuilder.innerHTML = tokens.map((t, i) => {
    if (i < builtCount) return `<div class="slot filled">${escapeHtml(t.text)}</div>`;
    return `<div class="slot">&nbsp;</div>`;
  }).join("");
}

function renderPool() {
  wordPool.innerHTML = pool.map(t => `<button class="word-tile" data-id="${t.id}" type="button">${escapeHtml(t.text)}</button>`).join("");
  wordPool.querySelectorAll(".word-tile").forEach(btn => {
    btn.addEventListener("click", () => tapTile(Number(btn.dataset.id)));
  });
}

function tapTile(tileId) {
  if (locked) return;

  if (tileId === builtCount) {
    builtCount++;
    pool = pool.filter(t => t.id !== tileId);
    renderSentenceBuilder();
    renderPool();

    channel && channel.publish("progress", { playerId, current: builtCount, total: tokens.length, questionIndex: currentIndex });

    if (builtCount === tokens.length) {
      locked = true;
      lockPool();
      statusP.textContent = "✅ You solved it! Waiting for the host…";
      channel && channel.publish("solved", { playerId, playerName, questionIndex: currentIndex });
    } else {
      statusP.textContent = "Keep going!";
    }
  } else {
    const btn = wordPool.querySelector(`[data-id="${tileId}"]`);
    if (btn) btn.classList.add("is-wrong");
    lockPool();
    statusP.textContent = "❌ Not quite — resetting!";

    setTimeout(() => {
      if (locked) return; // round may have ended (someone else solved / time ran out) while we waited
      builtCount = 0;
      pool = shuffleTokens(tokens);
      renderSentenceBuilder();
      renderPool();
      statusP.textContent = "Start over — go!";
      channel && channel.publish("mistake", { playerId, questionIndex: currentIndex });
      channel && channel.publish("progress", { playerId, current: 0, total: tokens.length, questionIndex: currentIndex });
    }, WRONG_RESET_DELAY_MS);
  }
}

function lockPool() {
  wordPool.querySelectorAll(".word-tile").forEach(b => (b.disabled = true));
}

function renderRoundResult(data) {
  if (data.questionIndex !== currentIndex) return;
  locked = true;
  lockPool();

  const scores = data.teams || {};
  if (scores[playerId]) {
    myScore = scores[playerId].score;
    myScoreEl.textContent = myScore;
  }

  if (data.winnerId === playerId) {
    statusP.innerHTML = "🏆 Your team solved it first!";
  } else if (data.winnerId) {
    statusP.innerHTML = `👏 ${escapeHtml(data.winnerName)} solved it first.`;
  } else {
    statusP.innerHTML = "⏳ Time's up — nobody finished it.";
  }
}

function renderFinal(data) {
  const scores = data.teams || {};
  const ids = Object.keys(scores);
  const sorted = ids.sort((a, b) => scores[b].score - scores[a].score);

  if (sorted.length >= 2 && scores[sorted[0]].score === scores[sorted[1]].score) {
    finalResultP.textContent = "🤝 It's a tie!";
  } else if (sorted[0] === playerId) {
    finalResultP.textContent = "🏆 Your team won!";
  } else if (sorted.length) {
    finalResultP.textContent = `${scores[sorted[0]].name} won this round.`;
  } else {
    finalResultP.textContent = "Game over";
  }

  finalScoreLineP.textContent = sorted.map(id => `${scores[id].name}: ${scores[id].score}`).join("  ·  ");
  showView(finalViewP);
}