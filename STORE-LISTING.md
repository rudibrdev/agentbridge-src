# AgentBridge — Chrome Web Store Listing Copy

- **Version:** 0.1.0
- **Price:** Free
- **Developer:** YardWork (Ves Ivanov) — https://yardwork.dev

## Proposed name

**AgentBridge — Connect AI Agents to Your Browser**

(Matches the manifest `name` field.)

## Short description (132 chars max — Chrome requirement)

```
Connect AI agents to your browser: read the tab, read/write the clipboard, inject text — every action needs your approval.
```

**122 characters** — within the 132-char limit.

## Detailed description (~1200 chars, benefit-led, plain English)

```
AgentBridge is a free, local bridge between AI agents and your Chrome browser.

It gives your AI assistant a safe, approved way to see and act in your browser:

• Read the active tab — see the page title and URL
• Read the clipboard — grab the text you copied
• Write the clipboard — put text there ready to paste
• Inject text — type into the focused field on any page

Every single action needs your approval. Nothing runs automatically. When an agent asks for something, you get a notification with Approve and Deny buttons. No approval, no action — ever.

Why you would want it: your AI agent can check which page you are on, prepare an email, a form answer, or a code snippet, and place it into the right field — with you approving each step.

How it works: the extension connects to a tiny local bridge server on your own machine (127.0.0.1:8788). Your agent connects to the same server. The server only routes messages between the two — it never sends anything to the internet.

Private by design: all traffic stays on your computer, on the loopback interface. No accounts, no cloud, no telemetry, no data collection.

Free, and compatible with any agent that speaks WebSocket — the message protocol is simple and documented.
```

*(~1,180 characters — verify before submitting.)*

## Category

**Productivity**

## Tags (max 5)

1. AI
2. browser automation
3. clipboard
4. productivity
5. agents

## Screenshot plan (3–5 shots)

1. **Extension popup — connected state:** shows the bridge status (connected) and the
   approval count. Establishes what the extension looks like.
2. **Approval notification:** Chrome notification with ✅ Approve / 🚫 Deny buttons for
   an incoming agent request. This is the product's core moment — the human gate.
3. **Agent client terminal:** a terminal running a small WebSocket client that sends a
   `readTab` request and prints the approved result (title + URL). Shows the developer
   / agent-facing side.
4. *(optional)* **Clipboard roundtrip:** agent writes text, agent reads it back —
   showing read/write clipboard working.
5. *(optional)* **Inject demo:** agent text typed into a focused form field after
   approval.

## Single-purpose statement (Chrome requires it)

AgentBridge exists for one purpose: to let AI agents read your active tab and
clipboard and inject text into a page, with your explicit approval on every action.
It does nothing else — no ads, no accounts, no tracking, no other features.

## Permissions justification

| Permission | Why it is needed |
|---|---|
| `activeTab` | Read the title/URL of the active tab when an approved `readTab` action runs. |
| `clipboardRead` | Read clipboard text for the approved `readClipboard` action. |
| `clipboardWrite` | Write text to the clipboard for the approved `writeClipboard` action. |
| `scripting` | Inject text into the focused element on a page for the approved `inject` action. |
| `storage` | Store the approval count and bridge status locally. |
| `notifications` | Show the approval notification with ✅/🚫 buttons. |
| `alarms` | Keep the service worker alive so the extension stays connected to the bridge. |
| `host_permissions: <all_urls>` | Agents act without a user gesture, so the extension must be able to reach any page the user has open. The approval gate is the control that makes this safe. |

## Privacy

- **Data stays local.** The bridge binds to `127.0.0.1` (loopback only). There are no
  remote servers involved — no cloud, no accounts.
- **No telemetry, no data collection.** The extension sends nothing anywhere.
- **What it touches:** tab titles/URLs, clipboard text, and injected text — all of it
  is processed on your own machine only.
- **Approval count** is stored in local browser storage (`chrome.storage.local`),
  on your device only.

## Privacy policy URL ✅

**https://rudibrdev.github.io/agentbridge-site/privacy.html** — live, hosted on
GitHub Pages. Use this in the Chrome Web Store listing's Privacy Policy field.
