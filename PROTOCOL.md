# AgentBridge Protocol v1 — Contract for ALL fleet agents

The single source of truth. Every agent codes against THIS. Do not invent message shapes.

## Architecture

```
[AI Agent]  --ws-->  [bridge-server.mjs]  --ws-->  [Chrome Extension (MV3)]
   (client)         (Node, port 8788)             (service worker = ws CLIENT)
```

- `bridge-server.mjs` — zero-dependency Node WebSocket server on `127.0.0.1:8788`.
  Agents AND the extension connect to it. Server routes requests/responses by ID.
- Extension service worker connects OUT to the server as a WS client
  (MV3 service workers CAN be WS clients; they CANNOT be WS servers — hence the Node server).
- Every agent action requires an explicit human approval in the extension.
  No auto-execution. Ever. This is the product's core value.

## Message protocol (JSON text frames)

### 1. Hello (on connect)
Agent → Server:
```json
{"type": "hello", "role": "agent", "name": "my-agent"}
```
Extension → Server:
```json
{"type": "hello", "role": "extension", "name": "AgentBridge"}
```

### 2. Action request (agent → server → extension)
Agent → Server:
```json
{"type": "action", "id": "req-123", "action": "readTab", "params": {}}
```
Server → Extension (verbatim forward):
```json
{"type": "action", "id": "req-123", "action": "readTab", "params": {}}
```

### 3. Approval response (extension → server → agent)
Extension → Server:
```json
{"type": "result", "id": "req-123", "ok": true, "data": {"title": "...", "url": "..."}}
```
or on denial:
```json
{"type": "result", "id": "req-123", "ok": false, "error": "denied by user"}
```
Server → Agent (verbatim forward of the result).

### 4. Status (extension → server → agent, informational)
```json
{"type": "status", "state": "connected" | "disconnected", "ts": 1723600000000}
```

## Actions (v1 — exact names, exact data shapes)

| action | params | data on success |
|---|---|---|
| `readTab` | `{}` | `{"title": string, "url": string}` (active tab of current window) |
| `readClipboard` | `{}` | `{"text": string}` |
| `writeClipboard` | `{"text": string}` | `{"ok": true}` |
| `inject` | `{"text": string}` | `{"ok": true}` (type text into focused element) |

Error responses: `{"ok": false, "error": "denied by user"}` for denials,
`{"ok": false, "error": "<message>"}` for execution failures,
`{"ok": false, "error": "no extension connected"}` if no extension is attached.

## Approval gate rules (extension side — non-negotiable)

1. Every action → show approval UI FIRST (notification with ✅/🚫 buttons + popup fallback).
2. Execute ONLY after explicit approval.
3. One pending request at a time. If a new action arrives while one is pending → auto-deny it with `{"ok": false, "error": "busy"}`.
4. 60-second approval timeout → auto-deny `{"ok": false, "error": "timeout"}`.
5. Track approvals count in chrome.storage.local (`approvals`).

## Extension service worker lifecycle (MV3)

- Connect to `ws://127.0.0.1:8788` on startup (`chrome.runtime.onInstalled` + `onStartup`).
- Auto-reconnect with backoff (1s, 5s, 15s, max 30s) while bridge is reachable.
- `chrome.alarms` every 30s → if socket closed, reconnect (keeps SW alive).
- Keep `pendingApproval` in SW memory; notification button index 0 = approve, 1 = deny.
- On notification click (body) → open popup showing pending request.

## Implementation notes

- Server: single file, zero deps (Node ≥20 built-ins only: `http`, `crypto`, `fs`).
  Hand-rolled WS handshake (Sec-WebSocket-Accept = base64(sha1(key + magic GUID))),
  frame parse (FIN/opcode/mask/len), ping/pong keepalive every 30s, drop dead sockets.
- Extension manifest: MV3, permissions `["activeTab","clipboardRead","clipboardWrite","storage","scripting","notifications","alarms"]`,
  host_permissions `["<all_urls>"]`, service_worker `background.js`, action popup `popup.html`.
- Clipboard: `navigator.clipboard.readText()/writeText()` in page context via `chrome.scripting.executeScript`
  (needs focus; fallback to `document.execCommand('paste'/'copy')` in content script context).
- readTab: `chrome.tabs.query({active: true, currentWindow: true})`.
- inject: `chrome.scripting.executeScript` on active tab → set `document.activeElement.value` + dispatch input event.
- Server stdout: JSON lines `{"ts":..., "event":"connect|disconnect|action|result|approval|deny", "detail":...}` for testability.

## Testing contract (E2E harness, `test/` dir)

1. Start server (`node bridge-server.mjs`) → assert `listening on ws://127.0.0.1:8788`.
2. Launch Chrome with extension loaded (headful under xvfb OR Chrome for Testing headless).
3. Connect agent client (`test/agent-client.mjs`) → assert hello + attach.
4. Send `readTab` → approve via CDP click on notification button / popup button → assert result shape.
5. Send `deny` scenario → assert `{"ok": false, "error": "denied by user"}`.
6. Send `writeClipboard` then `readClipboard` → assert roundtrip text.
7. Send `inject` → assert page field contains text.
8. Report PASS/FAIL per scenario in `test/RESULTS.md`.

## File layout (all under `businesses/yardwork/work/t4-build/agentbridge/`)

```
bridge-server.mjs      — server (LANE A)
manifest.json          — extension manifest (LANE B)
background.js          — SW: ws client + approval gate + executors (LANE B)
content.js             — clipboard/inject helpers if needed (LANE B)
popup.html, popup.js   — approval + status UI (LANE B)
icons/icon16/48/128.png— icons (LANE C)
test/agent-client.mjs  — E2E agent client (LANE D)
test/e2e.mjs           — orchestrator: server+chrome+assert (LANE D)
test/RESULTS.md        — PASS/FAIL per scenario (LANE D)
README.md              — user docs (LANE E)
STORE-LISTING.md       — Chrome Web Store copy (LANE E)
```
