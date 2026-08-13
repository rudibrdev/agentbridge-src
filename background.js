/**
 * AgentBridge — background service worker (MV3).
 * WebSocket CLIENT to ws://127.0.0.1:8788 (the local bridge server).
 * Receives action requests from AI agents, shows a human approval gate,
 * executes approved actions, and sends results back.
 *
 * Core value: NO action executes without explicit human approval.
 */

const BRIDGE_URL = "ws://127.0.0.1:8788";
const APPROVAL_TIMEOUT_MS = 60_000; // 60s -> auto-deny
const RECONNECT_BACKOFFS = [1000, 5000, 15000, 30000]; // then stays at 30s max
const KEEPALIVE_ALARM = "agentbridge-keepalive";
const APPROVALS_KEY = "approvals";

/** @type {WebSocket|null} */
let ws = null;
let reconnectAttempt = 0;
let reconnectTimer = null;

/** @type {{id: string, action: string, params: object}|null} */
let pendingApproval = null;
let approvalTimeoutTimer = null;

/**
 * Send a message to the bridge server.
 * @param {object} msg
 */
function sendToBridge(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/** Broadcast extension state to any attached agent. */
function broadcastStatus(state) {
  sendToBridge({ type: "status", state, ts: Date.now() });
}

/**
 * Connect (or reconnect) to the bridge server.
 */
function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(BRIDGE_URL);
  } catch (e) {
    scheduleReconnect();
    return;
  }

  ws.addEventListener("open", () => {
    reconnectAttempt = 0;
    sendToBridge({ type: "hello", role: "extension", name: "AgentBridge" });
    broadcastStatus("connected");
    updatePopup();
  });

  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    handleBridgeMessage(msg);
  });

  ws.addEventListener("close", () => {
    ws = null;
    broadcastStatus("disconnected");
    updatePopup();
    scheduleReconnect();
  });

  ws.addEventListener("error", () => {
    // close event follows; nothing to do here.
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = RECONNECT_BACKOFFS[Math.min(reconnectAttempt, RECONNECT_BACKOFFS.length - 1)];
  reconnectAttempt++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

/**
 * Handle a message from the bridge.
 * @param {object} msg
 */
async function handleBridgeMessage(msg) {
  console.log("[trace] bridge msg:", JSON.stringify(msg));
  if (msg.type === "action") {
    await handleActionRequest(msg);
  }
}

/**
 * Approval gate entry point.
 * One pending at a time; busy -> auto-deny; 60s timeout -> auto-deny.
 * @param {{id: string, action: string, params: object}} req
 */
async function handleActionRequest(req) {
  if (pendingApproval) {
    // Busy: a request is already awaiting approval.
    sendResult(req.id, false, "busy");
    return;
  }

  pendingApproval = req;
  console.log("[trace] pending set:", req.id, req.action);
  startApprovalTimeout(req.id);
  showApprovalNotification(req);
  updatePopup();

  // Fallback: also open the popup so the user sees the request.
  // E2E test mode (storage flag set by the test harness) skips this — the
  // action popup steals focus and breaks the harness's active-tab targeting.
  chrome.storage.local.get({ e2eMode: false }, (res) => {
    if (res.e2eMode) return;
    try {
      chrome.action.openPopup().catch(() => {});
    } catch {
      // openPopup may fail if a popup is already open or in some contexts.
    }
  });
}

function startApprovalTimeout(id) {
  clearTimeout(approvalTimeoutTimer);
  approvalTimeoutTimer = setTimeout(() => {
    if (pendingApproval && pendingApproval.id === id) {
      const req = pendingApproval;
      pendingApproval = null;
      clearTimeout(approvalTimeoutTimer);
      sendResult(req.id, false, "timeout");
      hideNotification();
      updatePopup();
    }
  }, APPROVAL_TIMEOUT_MS);
}

/** Show the approval notification with Approve/Deny buttons. */
function showApprovalNotification(req) {
  const actionLabel = req.action || "unknown action";
  const detail = describeAction(req);
  chrome.notifications.create(
    "agentbridge-approval",
    {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: `AgentBridge: ${actionLabel}?`,
      message: detail,
      buttons: [{ title: "✅ Approve" }, { title: "🚫 Deny" }],
      priority: 2,
      requireInteraction: true,
    },
    () => {
      if (chrome.runtime.lastError) {
        // Notification failed (e.g. permission) — popup fallback still visible.
      }
    }
  );
}

/** Human-readable description of what the agent wants. */
function describeAction(req) {
  switch (req.action) {
    case "readTab":
      return "Read the title and URL of the active tab";
    case "readClipboard":
      return "Read your clipboard text";
    case "writeClipboard":
      return `Write to clipboard: "${String(req.params?.text ?? "").slice(0, 80)}"`;
    case "inject":
      return `Type text into the focused field: "${String(req.params?.text ?? "").slice(0, 80)}"`;
    default:
      return `Unknown action "${req.action}"`;
  }
}

function hideNotification() {
  try {
    chrome.notifications.clear("agentbridge-approval");
  } catch {
    // ignore
  }
}

/**
 * Notification button click: index 0 = approve, 1 = deny.
 */
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId !== "agentbridge-approval") return;
  if (buttonIndex === 0) {
    approvePending();
  } else {
    denyPending();
  }
});

/**
 * Notification body click: open the popup showing the pending request.
 */
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId !== "agentbridge-approval") return;
  try {
    chrome.action.openPopup().catch(() => {});
  } catch {
    // ignore
  }
});

/** Approve the pending request (from notification button or popup). */
function approvePending() {
  console.log("[trace] approvePending called, pending =", pendingApproval ? pendingApproval.id : null);
  if (!pendingApproval) return;
  const req = pendingApproval;
  pendingApproval = null;
  clearTimeout(approvalTimeoutTimer);
  hideNotification();
  updatePopup();

  executeAction(req)
    .then((data) => {
      incrementApprovals();
      sendResult(req.id, true, data);
    })
    .catch((err) => {
      sendResult(req.id, false, err?.message || "execution failed");
    });
}

/** Deny the pending request. */
function denyPending() {
  console.log("[trace] denyPending called, pending =", pendingApproval ? pendingApproval.id : null);
  if (!pendingApproval) return;
  const req = pendingApproval;
  pendingApproval = null;
  clearTimeout(approvalTimeoutTimer);
  hideNotification();
  updatePopup();
  sendResult(req.id, false, "denied by user");
}

/**
 * Execute an approved action.
 * @returns {Promise<object>} data for the result message
 */
async function executeAction(req) {
  switch (req.action) {
    case "readTab":
      return readActiveTab();
    case "readClipboard":
      return readClipboard();
    case "writeClipboard":
      await writeClipboard(String(req.params?.text ?? ""));
      return { ok: true };
    case "inject":
      await injectText(String(req.params?.text ?? ""));
      return { ok: true };
    default:
      throw new Error(`unknown action: ${req.action}`);
  }
}

/** Send a result back to the bridge (which routes it to the agent). */
function sendResult(id, ok, dataOrError) {
  console.log("[trace] sendResult:", id, ok, JSON.stringify(dataOrError));
  if (ok) {
    sendToBridge({ type: "result", id, ok: true, data: dataOrError });
  } else {
    sendToBridge({ type: "result", id, ok: false, error: dataOrError });
  }
}

/** Get the active tab of the current window. */
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) throw new Error("no active tab");
  return tabs[0];
}

async function readActiveTab() {
  const tab = await getActiveTab();
  return { title: tab.title || "", url: tab.url || "" };
}

/**
 * Read clipboard text from the active tab's page context.
 * Fallback: execCommand('paste') in the content script.
 */
async function readClipboard() {
  const tab = await getActiveTab();
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return new Promise((resolve) => {
          try {
            navigator.clipboard
              .readText()
              .then((t) => resolve({ ok: true, text: t }))
              .catch(() => resolve({ ok: false }));
          } catch {
            resolve({ ok: false });
          }
        });
      },
    });
    if (results?.[0]?.result?.ok) {
      return { text: results[0].result.text };
    }
  } catch {
    // fall through to content script path
  }
  // Fallback via content script (execCommand paste).
  const res = await chrome.tabs.sendMessage(tab.id, { type: "agentbridge:readClipboard" });
  if (res?.ok) return { text: res.text };
  throw new Error("clipboard read failed");
}

/**
 * Write text to the clipboard from the active tab's page context.
 * Fallback: execCommand('copy') in the content script.
 */
async function writeClipboard(text) {
  const tab = await getActiveTab();
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (value) => {
        return new Promise((resolve) => {
          try {
            navigator.clipboard
              .writeText(value)
              .then(() => resolve({ ok: true }))
              .catch(() => resolve({ ok: false }));
          } catch {
            resolve({ ok: false });
          }
        });
      },
      args: [text],
    });
    if (results?.[0]?.result?.ok) return;
  } catch {
    // fall through
  }
  const res = await chrome.tabs.sendMessage(tab.id, { type: "agentbridge:writeClipboard", text });
  if (res?.ok) return;
  throw new Error("clipboard write failed");
}

/**
 * Type text into the focused element of the active tab.
 */
async function injectText(text) {
  const tab = await getActiveTab();
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (value) => {
        const el = document.activeElement;
        if (!el || typeof el.value !== "string") return false;
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      },
      args: [text],
    });
  } catch (e) {
    throw new Error(`inject failed: ${e.message}`);
  }
}

/** Increment the approvals counter in chrome.storage.local. */
async function incrementApprovals() {
  try {
    const { [APPROVALS_KEY]: count = 0 } = await chrome.storage.local.get(APPROVALS_KEY);
    await chrome.storage.local.set({ [APPROVALS_KEY]: (count || 0) + 1 });
  } catch {
    // storage failure is non-fatal
  }
}

/**
 * Popup communication: popup asks for state / sends approve-deny.
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return;

  switch (msg.type) {
    case "agentbridge:getState":
      chrome.storage.local.get(APPROVALS_KEY).then(({ [APPROVALS_KEY]: approvals = 0 }) => {
        sendResponse({
          connected: !!(ws && ws.readyState === WebSocket.OPEN),
          pending: pendingApproval
            ? { id: pendingApproval.id, action: pendingApproval.action, detail: describeAction(pendingApproval) }
            : null,
          approvals: approvals || 0,
        });
      });
      return true; // async response
    case "agentbridge:approve":
      approvePending();
      sendResponse({ ok: true });
      return false;
    case "agentbridge:deny":
      denyPending();
      sendResponse({ ok: true });
      return false;
    default:
      return false;
  }
});

/** Keep the service worker alive; reconnect if the socket dropped. */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connect();
    }
  }
});

function updatePopup() {
  try {
    chrome.runtime.sendMessage({ type: "agentbridge:stateChanged" }).catch(() => {});
  } catch {
    // popup may not be open
  }
}

// Startup: connect + keepalive alarm.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  connect();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  connect();
});

// Try to connect immediately (SW may be woken by an event).
connect();
