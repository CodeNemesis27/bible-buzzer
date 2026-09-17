/* ============================================================
   Bible Buzzer — shared config, question bank, helpers
   ============================================================ */

// 1. Sign up free at https://piesocket.com  →  create an API key
// 2. Paste your API key + Cluster ID below
// 3. That's it — no other server setup needed.
const PIESOCKET_CONFIG = {
  apiKey: "7Av6Y5RGTotqTkKiC5u631G0subC9WP5sA0KlLgR",
  clusterId: "free.blr2",
};

// Each round: `line` is the scrambled sentence, `title` is revealed after the round.
// All of these are public-domain hymn lines (1700s–1800s), safe to reuse freely.
// Add, remove, or edit rounds here — the game just loops through however many you list.
const SONGS = [
  { line: "I sing the goodness of the Lord who filled the Earth with food", title: "I Sing the Mighty Power of God" },
  { line: "Amazing grace how sweet the sound that saved a wretch like me", title: "Amazing Grace" },
  { line: "Holy holy holy merciful and mighty", title: "Holy, Holy, Holy" },
  { line: "When peace like a river attendeth my way", title: "It Is Well with My Soul" },
  { line: "Blessed assurance Jesus is mine oh what a foretaste of glory divine", title: "Blessed Assurance" },
];

const NEXT_ROUND_DELAY_MS = 5000;

function generateRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O, avoids confusion
  let code = "";
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

function generatePlayerId() {
  return "t-" + Math.random().toString(36).slice(2, 10);
}

function channelName(roomCode) {
  return "song-scramble-" + roomCode.toUpperCase();
}

function connectPieSocket(roomCode) {
  const piesocket = new PieSocket.default(PIESOCKET_CONFIG);
  return piesocket.subscribe(channelName(roomCode));
}

// Turns a line into tokens carrying their correct position, so duplicate
// words (e.g. "holy holy holy") are still tracked as distinct tiles.
function tokenizeLine(line) {
  return line.split(" ").map((text, index) => ({ id: index, text }));
}

function shuffleTokens(tokens) {
  const arr = tokens.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}