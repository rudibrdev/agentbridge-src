# AgentBridge — Connect AI Agents to Your Browser

Free local bridge: AI agents attach to your Chrome browser and read the active tab,
read/write the clipboard, and inject text — with your explicit approval on every action.
Version 0.1.0. Made by YardWork (https://yardwork.dev).

## What it is

AgentBridge is a Chrome extension (MV3) plus a tiny, zero-dependency Node WebSocket
server. AI agents connect to the server, and the extension connects to the same server.
Once attached, an agent can:

- **readTab** — see the title and URL of the active tab.
- **readClipboard** — read the current clipboard text.
- **writeClipboard** — write text into your clipboard.
- **inject** — type text into the focused field on the active page.

Every agent action requires an explicit human approval in the extension.
**No auto-execution. Ever.** This is the product's core value.

## How it works

```
[AI Agent]  --ws-->  [bridge-server.mjs]  --ws-->  [Chrome Extension (MV3)]
   (client)         (Node, port 8788)             (service worker = ws CLIENT)
```

- `bridge-server.mjs` — a zero-dependency Node WebSocket server on
  `ws://127.0.0.1:8788`. Agents **and** the extension connect to it. The server routes
  requests and responses by ID.
- The extension service worker connects **out** to the server as a WebSocket client.
  MV3 service workers can be WebSocket clients; they cannot be WebSocket servers —
  that is why the Node server exists.
- Every agent action flows through the approval gate in the extension. The human
  approves or denies each request. Nothing executes automatically.

## Install

1. **Load the unpacked extension**
   - Open `chrome://extensions`.
   - Enable **Developer mode** (top right).
   - Click **Load unpacked** and select the `agentbridge` folder.
2. **Start the bridge server**
   - Requires Node.js 20 or newer. No dependencies to install.
   - Run: `node bridge-server.mjs`
   - You should see: `listening on ws://127.0.0.1:8788`.
3. **Confirm the connection** — open the AgentBridge popup. It shows the bridge
   status and any pending approval requests.

## Connect an agent

Any WebSocket client can act as an agent. Connect to `ws://127.0.0.1:8788`, send a
`hello`, then send `action` requests. The extension answers each request with a
`result` — but only after a human approves it.

Minimal agent client (Node 22+, built-in WebSocket):

```js
const ws = new WebSocket("ws://127.0.0.1:8788");

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "hello", role: "agent", name: "my-agent" }));
  ws.send(JSON.stringify({ type: "action", id: "req-123", action: "readTab", params: {} }));
};

ws.onmessage = (e) => {
  console.log(JSON.parse(e.data)); // the approval result
};
```

### Message protocol (JSON text frames)

1. **Hello** — on connect:

   Agent → Server:
   ```json
   {"type": "hello", "role": "agent", "name": "my-agent"}
   ```
   Extension → Server:
   ```json
   {"type": "hello", "role": "extension", "name": "AgentBridge"}
   ```

2. **Action request** (agent → server → extension, forwarded verbatim):
   ```json
   {"type": "action", "id": "req-123", "action": "readTab", "params": {}}
   ```

3. **Approval result** (extension → server → agent, forwarded verbatim):
   ```json
   {"type": "result", "id": "req-123", "ok": true, "data": {"title": "...", "url": "..."}}
   ```
   Denied:
   ```json
   {"type": "result", "id": "req-123", "ok": false, "error": "denied by user"}
   ```

4. **Status** (extension → server → agent, informational):
   ```json
   {"type": "status", "state": "connected", "ts": 1723600000000}
   ```
   `state` is `"connected"` or `"disconnected"`.

## Actions v1

| action | params | data on success |
|---|---|---|
| `readTab` | `{}` | `{"title": string, "url": string}` — active tab of the current window |
| `readClipboard` | `{}` | `{"text": string}` |
| `writeClipboard` | `{"text": string}` | `{"ok": true}` |
| `inject` | `{"text": string}` | `{"ok": true}` — types text into the focused element |

Errors return `{"ok": false, "error": "<message>"}`:

- `"denied by user"` — the human denied the request.
- `"busy"` — another request was already pending.
- `"timeout"` — no approval within 60 seconds.
- `"no extension connected"` — no extension is attached to the bridge.
- any other message — an execution failure.

## Approval flow

1. Every action shows an approval UI **first** — a Chrome notification with
   ✅/🚫 buttons, with the popup as fallback.
2. Execution happens **only after** explicit approval.
3. **One pending request at a time.** If a new action arrives while one is pending,
   it is auto-denied with `{"ok": false, "error": "busy"}`.
4. **60-second timeout.** If the human does not answer in 60 seconds, the request is
   auto-denied with `{"ok": false, "error": "timeout"}`.
5. The approval count is tracked in `chrome.storage.local` (`approvals`).

## Security model

- **Loopback only.** The bridge binds to `127.0.0.1:8788`. Nothing is exposed to the
  network or the internet.
- **Approval gate in code.** The extension never executes an action without an
  explicit human approval. There is no auto-execution path.
- **Why `host_permissions: ["<all_urls>"]`?** Agents act without a user gesture — they
  do not click or type themselves. The extension therefore needs broad host access to
  query the active tab, read/write the clipboard, and inject text into any page the
  user has open. The approval gate is the control that makes this safe.

## Troubleshooting

- **Bridge not running** — start it with `node bridge-server.mjs`. Expect
  `listening on ws://127.0.0.1:8788`. The server logs JSON lines
  (`connect`, `disconnect`, `action`, `result`, `approval`, `deny`) to stdout.
- **Extension not connecting** — reload the extension in `chrome://extensions`, then
  reopen the popup. The service worker auto-reconnects with backoff
  (1s, 5s, 15s, max 30s) and a 30s `chrome.alarms` tick keeps it alive.
- **Agent gets `no extension connected`** — the extension is not attached. Check the
  server log for an extension `hello`.

## Development

File layout (all under `agentbridge/`):

```
bridge-server.mjs      — WebSocket server (Node, port 8788)
manifest.json          — MV3 manifest
background.js          — service worker: WS client + approval gate + executors
content.js             — clipboard/inject helpers
popup.html, popup.js   — approval + status UI
icons/                 — icon16/48/128
test/agent-client.mjs  — E2E agent client
test/e2e.mjs           — orchestrator: server + Chrome + assertions
test/RESULTS.md        — PASS/FAIL per scenario
```

Running the E2E tests: start the server, launch Chrome with the extension loaded,
and run the `test/e2e.mjs` harness. It connects the agent client, exercises each
action, covers the deny and timeout paths, and reports PASS/FAIL per scenario in
`test/RESULTS.md`.
