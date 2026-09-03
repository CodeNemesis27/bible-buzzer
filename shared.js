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

// Edit, remove, or add questions here. `correct` is the index (0-3) into `options`.
const QUESTIONS = [
  { q: "What day is the Sabbath day?", options: ["Friday", "Saturday", "Sunday", "Monday"], correct: 1 },
  { q: "Who built the ark?", options: ["Moses", "Abraham", "Noah", "David"], correct: 2 },
  { q: "How many days did God take to create the world?", options: ["5", "6", "7", "8"], correct: 1 },
  { q: "What is the first book of the Bible?", options: ["Exodus", "Genesis", "Leviticus", "Numbers"], correct: 1 },
  { q: "Who led the Israelites out of Egypt?", options: ["Joshua", "Aaron", "Moses", "Elijah"], correct: 2 },
  { q: "Who betrayed Jesus?", options: ["Peter", "Judas Iscariot", "Thomas", "John"], correct: 1 },
  { q: "What is the last book of the Bible?", options: ["Jude", "Acts", "Revelation", "Hebrews"], correct: 2 },
  { q: "How many disciples did Jesus have?", options: ["10", "11", "12", "13"], correct: 2 },
  { q: "Who was swallowed by a great fish?", options: ["Jonah", "Daniel", "Elijah", "Job"], correct: 0 },
  { q: "Where was Jesus born?", options: ["Nazareth", "Jerusalem", "Bethlehem", "Jericho"], correct: 2 },
];

const TILE_LETTERS = ["A", "B", "C", "D"];

function generateRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O, avoids confusion
  let code = "";
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

function generatePlayerId() {
  return "p-" + Math.random().toString(36).slice(2, 10);
}

function channelName(roomCode) {
  return "bible-buzzer-" + roomCode.toUpperCase();
}

function connectPieSocket(roomCode) {
  const piesocket = new PieSocket.default(PIESOCKET_CONFIG);
  return piesocket.subscribe(channelName(roomCode));
}
