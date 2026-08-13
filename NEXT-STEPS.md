# AgentBridge — What To Do Next

**Repo:** https://github.com/rudibrbot-cmyk/agentbridge (private, you're invited as collaborator)
**Status:** Product finished, E2E-tested 9/9 in real Chrome. Not yet published to the Chrome Web Store.

---

## Step 0 — Accept the GitHub invite (1 min)

You'll get an email from GitHub: "rudibrbot-cmyk invited you to agentbridge". Accept it, then you have full access to the code.

---

## Step 1 — Try it on your own machine (10 min, optional but recommended)

This is the fastest "is this real?" test — no store, no fee, no publishing.

1. **Get the code:**
   ```bash
   git clone https://github.com/rudibrbot-cmyk/agentbridge.git
   cd agentbridge
   ```

2. **Start the bridge server** (needs Node 22+):
   ```bash
   node bridge-server.mjs
   ```
   You should see: `bridge listening on ws://127.0.0.1:8788`

3. **Load the extension into Chrome:**
   - Open `chrome://extensions`
   - Turn on **Developer mode** (top-right)
   - Click **Load unpacked**
   - Select the `agentbridge` folder (the one with `manifest.json`)
   - You should see "AgentBridge — Connect AI Agents to Your Browser"
   - The popup icon appears next to the address bar. Click it — it should show **Bridge: connected**

4. **Send a test action** (second terminal):
   ```bash
   node test/agent-client.mjs
   ```
   This connects a demo agent and sends a `readTab` request.

5. **Approve it:** the popup opens showing "Action: readTab". Click **✅ Approve**. The agent receives the current tab's title + URL.

> Note: the popup opens as a small window near the toolbar. If it doesn't appear automatically, click the extension icon.
> If the popup doesn't show the request, reload the extension (`chrome://extensions` → refresh icon) and try again.

---

## Step 2 — The two decisions for Web Store launch

The code is done, but the Chrome Web Store requires two things from you:

### 1. The $5 developer fee (one-time)
Chrome Web Store registration costs **$5 once** (it also unlocks the YouTube API for your Google account, which is why Google charges it). You pay with a card on `chrome.google.com/webstore/devconsole`.
**Rudi will ask you explicitly before paying anything.** You can also pay yourself — same account either way.

### 2. A privacy-policy URL
The store requires a public URL where the privacy policy lives. The extension itself collects **nothing** (no analytics, no data leaving your machine — actions go only to the bridge you run). The policy text is a one-paragraph statement of that. Options:
- Host it on **yardwork.dev** or **vesivanov.com** (Rudi can draft + hand you ready-to-publish text)
- Or any URL you control

---

## Step 3 — Publish (after Step 2 decisions)

1. Create a developer account at https://chrome.google.com/webstore/devconsole (pay $5)
2. "New item" → upload `dist/agentbridge.zip` (already built and verified)
3. Fill in the listing — `STORE-LISTING.md` in the repo has ready-to-paste text (name, description, screenshots section)
4. Add the privacy-policy URL (Step 2.2)
5. Submit for review — typically 1–3 days

---

## What the product does (30-second version)

An AI agent connects to the bridge server and can act in your browser — **only with your approval**:

| Action | What it does |
|---|---|
| `readTab` | Agent sees the active tab's title + URL |
| `writeClipboard` | Agent puts text on your clipboard |
| `readClipboard` | Agent reads your clipboard |
| `inject` | Agent types into the focused field |

Each action shows a popup: **✅ Approve / ❌ Deny**. No approval = no action. Deny is final; ignoring it auto-denies after 60s. This is enforced in code, not by politeness.

---

## Later / optional

- **More actions** — mouse clicks, navigation, scrolling are easy to add to the protocol (see `PROTOCOL.md`)
- **Remote bridge** — let Rudi (VPS) control your browser: needs encrypted `wss://` + auth keys (option 1: tunnel to a bridge on your machine; option 2: bridge on the VPS). This is a security step — we'll do it deliberately, only with your go-ahead.
- **Packaging** — `dist/agentbridge.zip` is the store-ready package; rebuild with `python3 -m zipfile -c dist/agentbridge.zip <files>` (the `zip` binary isn't installed in the sandbox)

---

## Files in the repo

| File | What it is |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker: bridges WebSocket ↔ Chrome APIs, approval queue + 60s timeout |
| `content.js` | Injected into pages (only used by future page-context actions) |
| `popup.html` / `popup.js` | Approval UI |
| `bridge-server.mjs` | Zero-dependency Node server (ws://127.0.0.1:8788) |
| `PROTOCOL.md` | The wire protocol agents speak |
| `STORE-LISTING.md` | Ready-to-paste Web Store listing text |
| `test/` | E2E harness (9/9 PASS) + demo agent client + server self-test |
| `dist/agentbridge.zip` | Verified store-ready package |
