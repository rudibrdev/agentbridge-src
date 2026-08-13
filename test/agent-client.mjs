#!/usr/bin/env node
/**
 * AgentBridge E2E — agent client.
 * Connects to the bridge server as an AI agent (ws://127.0.0.1:8788),
 * sends actions, prints results. Zero dependencies (Node >= 22 global WebSocket).
 *
 * Usage:
 *   node test/agent-client.mjs                       # interactive: send readTab
 *   node test/agent-client.mjs readTab
 *   node test/agent-client.mjs writeClipboard "hello"
 *   node test/agent-client.mjs inject "text"
 *   node test/agent-client.mjs readClipboard
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_URL = "ws://127.0.0.1:8788";

const action = process.argv[2] || "readTab";
const param = process.argv[3] || "";

const params =
  action === "writeClipboard" || action === "inject" ? { text: param } : {};

const ws = new WebSocket(BRIDGE_URL);
const id = `cli-${Date.now()}`;

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ type: "hello", role: "agent", name: "cli-agent" }));
  setTimeout(() => {
    console.log(`> sending ${action} (id=${id})`);
    ws.send(JSON.stringify({ type: "action", id, action, params }));
  }, 200);
});

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  console.log(`< ${JSON.stringify(msg)}`);
  if (msg.type === "result" && msg.id === id) {
    ws.close();
    process.exit(msg.ok ? 0 : 1);
  }
});

ws.addEventListener("close", () => {
  console.log("bridge closed");
  process.exit(1);
});

setTimeout(() => {
  console.log("TIMEOUT waiting for result");
  process.exit(2);
}, 15_000);
