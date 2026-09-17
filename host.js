/* ============================================================
   Song Scramble — Host / Display logic
   ============================================================ */

const ROOM_CODE = generateRoomCode();
const JOIN_URL = location.origin + location.pathname.replace(/host\.html$/, "player.html") + "?room=" + ROOM_CODE;

let channel = null;
let teams = {};             // playerId -> { name, score, progress, total }
let currentIndex = -1;
let currentTokens = [];     // tokenized words for the round in progress, so boards can mirror them
let roundLocked = false;
let recentMistake = {};     // playerId -> timestamp of last mistake, drives the board flash

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
const teamBoards = document.getElementById("teamBoards");
const revealWrap = document.getElementById("revealWrap");
const resultBanner = document.getElementById("resultBanner");
const revealLine = document.getElementById("revealLine");
const revealTitle = document.getElementById("revealTitle");
const activityFeed = document.getElementById("activityFeed");
const skipBtn = document.getElementById("skipBtn");

const winnerText = document.getElementById("winnerText");
const finalScores = document.getElementById("finalScores");
const playAgainBtn = document.getElementById("playAgainBtn");

// ---- Setup lobby UI ----
roomCodeText.textContent = ROOM_CODE;
roomCodeSmall.textContent = ROOM_CODE;
joinUrlText.textContent = JOIN_URL;
qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(JOIN_URL);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}

function renderPlayerList() {
  const ids = Object.keys(teams);
  if (ids.length === 0) {
    playerList.innerHTML = '<li class="muted" style="background:transparent;border:none;">Waiting for teams…</li>';
    startBtn.disabled = true;
    return;
  }
  playerList.innerHTML = ids.map(id => `<li>${escapeHtml(teams[id].name)}</li>`).join("");
  startBtn.disabled = false;
}

function renderTeamBoards() {
  const ids = Object.keys(teams);
  teamBoards.innerHTML = ids.map(id => {
    const t = teams[id];
    const isFlashing = recentMistake[id] && (Date.now() - recentMistake[id] < 600);
    const slotsHtml = currentTokens.map((tok, i) => {
      return i < t.progress
        ? `<div class="slot filled">${escapeHtml(tok.text)}</div>`
        : `<div class="slot">&nbsp;</div>`;
    }).join("");
    return `
      <div class="team-board${isFlashing ? " flash-wrong" : ""}" data-team="${id}">
        <div class="name">${escapeHtml(t.name)} <span class="muted" style="font-size:0.8rem;">· Score ${t.score}</span></div>
        <div class="sentence-builder">${slotsHtml}</div>
        <div class="progress-label">${t.progress}/${t.total} words</div>
      </div>`;
  }).join("");
}

// ---- Connect ----
connectPieSocket(ROOM_CODE).then(ch => {
  channel = ch;

  channel.listen("join", data => {
    if (!teams[data.playerId]) {
      teams[data.playerId] = { name: data.playerName, score: 0, progress: 0, total: 0 };
      renderPlayerList();
    }
  });

  channel.listen("progress", data => {
    if (data.questionIndex !== currentIndex || !teams[data.playerId]) return;
    teams[data.playerId].progress = data.current;
    teams[data.playerId].total = data.total;
    renderTeamBoards();
  });

  channel.listen("mistake", data => {
    if (data.questionIndex !== currentIndex || !teams[data.playerId]) return;
    activityFeed.textContent = `❌ ${teams[data.playerId].name} slipped up and had to restart!`;
    recentMistake[data.playerId] = Date.now();
    renderTeamBoards();
    setTimeout(renderTeamBoards, 650); // clears the flash once recentMistake ages out
  });

  channel.listen("solved", data => handleSolved(data));
});

startBtn.addEventListener("click", () => startGame());
playAgainBtn.addEventListener("click", () => {
  Object.values(teams).forEach(t => { t.score = 0; t.progress = 0; t.total = 0; });
  finalView.classList.add("hidden");
  lobbyView.classList.remove("hidden");
  renderPlayerList();
});

function startGame() {
  currentIndex = -1;
  lobbyView.classList.add("hidden");
  finalView.classList.add("hidden");
  playView.classList.remove("hidden");
  nextRound();
}

function nextRound() {
  currentIndex++;
  if (currentIndex >= SONGS.length) {
    endGame();
    return;
  }
  roundLocked = false;
  activityFeed.textContent = "";
  revealWrap.classList.add("hidden");

  const song = SONGS[currentIndex];
  currentTokens = tokenizeLine(song.line);
  Object.values(teams).forEach(t => { t.progress = 0; t.total = currentTokens.length; });
  renderTeamBoards();

  questionCounter.textContent = `Song ${currentIndex + 1} / ${SONGS.length}`;

  if (channel) {
    channel.publish("round_start", { index: currentIndex, total: SONGS.length });
  }
}

skipBtn.addEventListener("click", () => {
  if (roundLocked) return;
  roundLocked = true;
  const song = SONGS[currentIndex];
  showReveal("⏭️ Skipped — moving on.", song);
  channel && channel.publish("round_result", {
    questionIndex: currentIndex,
    winnerId: null,
    winnerName: null,
    line: song.line,
    title: song.title,
    teams,
  });
  setTimeout(nextRound, NEXT_ROUND_DELAY_MS);
});

function handleSolved(data) {
  if (data.questionIndex !== currentIndex || roundLocked || !teams[data.playerId]) return;
  roundLocked = true;

  teams[data.playerId].score++;
  teams[data.playerId].progress = teams[data.playerId].total;
  renderTeamBoards();

  const song = SONGS[currentIndex];
  const winnerName = teams[data.playerId].name;
  showReveal(`🏆 ${winnerName} solved it first!`, song);

  channel && channel.publish("round_result", {
    questionIndex: currentIndex,
    winnerId: data.playerId,
    winnerName,
    line: song.line,
    title: song.title,
    teams,
  });

  setTimeout(nextRound, NEXT_ROUND_DELAY_MS);
}

function showReveal(banner, song) {
  resultBanner.textContent = banner;
  revealLine.textContent = `“${song.line}”`;
  revealTitle.textContent = `🎵 ${song.title}`;
  revealWrap.classList.remove("hidden");
}

function endGame() {
  playView.classList.add("hidden");
  finalView.classList.remove("hidden");

  const ids = Object.keys(teams);
  const sorted = ids.sort((a, b) => teams[b].score - teams[a].score);
  if (sorted.length >= 2 && teams[sorted[0]].score === teams[sorted[1]].score) {
    winnerText.textContent = "🤝 It's a tie!";
  } else if (sorted.length >= 1) {
    winnerText.textContent = `🏆 ${teams[sorted[0]].name} wins!`;
  } else {
    winnerText.textContent = "Game over";
  }

  finalScores.innerHTML = sorted.map(id => `
    <div class="final-score-card">
      <div class="n">${teams[id].score}</div>
      <div>${escapeHtml(teams[id].name)}</div>
    </div>
  `).join("");

  channel && channel.publish("game_over", { teams });
}