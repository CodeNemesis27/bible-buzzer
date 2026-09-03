# Bible Buzzer 🎮✝️

A 2-player (or more) Bible trivia buzzer game. One device shows the question
on a shared screen; players race to tap the correct answer first on their
own phones.

- **No backend server required** — it's a plain static site (HTML/CSS/JS).
- Real-time sync between devices is handled by **PieSocket** (a hosted
  WebSocket service with a free tier), so it deploys to Vercel as-is.

## How it works

- `host.html` — put this on the shared screen / laptop / projector. It
  shows a room code, generates the questions, runs the 15-second timer per
  question, and decides who buzzed in first correctly.
- `player.html` — each player opens this on their own phone, joins with the
  room code + their name, and taps one of the 4 answer tiles.
- Both pages talk to each other live over a WebSocket channel named after
  the room code — no page needs to refresh or poll.

## 1. Get a free PieSocket key (2 minutes)

1. Go to **[piesocket.com](https://www.piesocket.com/pricing)** and sign up
   for the **free plan** (100 concurrent connections / 500k messages a day —
   plenty for a 2-player game).
2. In your PieSocket dashboard, create an API key and copy your **API Key**
   and **Cluster ID**.
3. Open `shared.js` and replace the placeholders near the top:

   ```js
   const PIESOCKET_CONFIG = {
     apiKey: "YOUR_PIESOCKET_API_KEY",
     clusterId: "YOUR_CLUSTER_ID",
   };
   ```

That's the only setup step — there's no server, database, or `.env` file.

## 2. Try it locally (optional)

Any static file server works, for example:

```bash
npx serve .
```

Then open `http://localhost:3000` on your laptop for the host, and on your
phone (same Wi-Fi) for the player — or just open two browser tabs to test
the flow yourself before deploying.

## 3. Deploy to Vercel

**Easiest way (no CLI):**
1. Go to [vercel.com/new](https://vercel.com/new).
2. Drag and drop this folder (or connect the GitHub repo it's pushed to).
3. Framework preset: **Other** — no build command, no output directory
   needed, since these are plain static files. Deploy.

**Or with the Vercel CLI:**
```bash
npm i -g vercel
cd bible-buzzer
vercel
```

Once deployed you'll get a URL like `https://your-game.vercel.app`.

## 4. Play

1. On the shared screen, open `https://your-game.vercel.app/host.html`.
2. It shows a 4-letter **room code** and a QR code.
3. Each player opens `https://your-game.vercel.app/player.html` on their
   phone (or scans the QR code, which fills the room code in automatically),
   types their name, and taps **Join Game**.
4. Once players show up in the lobby list, the host taps **Start Game**.
5. Each question flashes on the shared screen for 15 seconds with 4
   answers. Players tap their matching tile on their phones — **first
   correct tap wins the point**; a wrong tap doesn't end the round, so the
   other player can still buzz in correctly.
6. After 10 questions, the final scoreboard and winner are shown. Tap
   **Play Again** on the host screen to reset scores and go again with the
   same room code.

## Customizing the questions

Open `shared.js` and edit the `QUESTIONS` array — add, remove, or change
any of the 10 entries. `correct` is the index (0 = A, 1 = B, 2 = C, 3 = D)
of the right answer:

```js
{ q: "What day is the Sabbath day?", options: ["Friday", "Saturday", "Sunday", "Monday"], correct: 1 },
```

You can also change:
- `QUESTION_SECONDS` in `host.js` — how long each question stays open.
- `NEXT_DELAY_MS` in `host.js` — how long the correct answer is shown
  before the next question loads.

## Known limitations (kept simple on purpose)

- If the host screen is refreshed mid-game, the room code changes and
  players will need to rejoin — best to keep the host tab open for the
  whole game.
- More than 2 players can join the same room code and play too; the rule
  is always "first correct tap wins," regardless of how many players join.
- There's no persistent database — scores reset if everyone closes their
  tabs. This is meant for a live, in-person game night, not an async game.
