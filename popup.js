/**
 * AgentBridge — popup UI.
 * Shows bridge status, pending request, approvals count.
 * Approve/Deny buttons message the service worker.
 */

const $ = (id) => document.getElementById(id);

function render(state) {
  const statusEl = $("status");
  if (state.connected) {
    statusEl.textContent = "Bridge: connected";
    statusEl.className = "status connected";
  } else {
    statusEl.textContent = "Bridge: disconnected";
    statusEl.className = "status disconnected";
  }

  $("approvals").textContent = `Approvals: ${state.approvals}`;

  const pending = state.pending;
  if (pending) {
    $("pendingWrap").hidden = false;
    $("noPending").hidden = true;
    $("pendingAction").textContent = `Action: ${pending.action}`;
    $("pendingDetail").textContent = pending.detail || "";
  } else {
    $("pendingWrap").hidden = true;
    $("noPending").hidden = false;
  }
}

function refresh() {
  chrome.runtime.sendMessage({ type: "agentbridge:getState" }, (state) => {
    if (chrome.runtime.lastError || !state) return;
    render(state);
  });
}

$("approveBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "agentbridge:approve" }, () => refresh());
});
$("denyBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "agentbridge:deny" }, () => refresh());
});

// Live-update when the SW broadcasts a state change.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "agentbridge:stateChanged") {
    refresh();
  }
});

refresh();
