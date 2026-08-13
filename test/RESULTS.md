# AgentBridge E2E Results — 2026-08-13

Chrome: /tmp/chrome-cft/chrome/linux-152.0.7977.42/chrome-linux64/chrome
Extension: /root/.openclaw/workspace/businesses/yardwork/work/t4-build/agentbridge
Bridge: ws://127.0.0.1:8788

| Scenario | Result | Detail |
|---|---|---|
| server listening | PASS |  |
| extension SW attached | PASS | chrome-extension://mjhbmeiklgbkmbicepkhbdgfocidebdd/background.js |
| extension hello on bridge | PASS |  |
| main tab navigated to test page | PASS | http://127.0.0.1:8799/ |
| readTab approved -> {title,url} | PASS | ({"title":"AgentBridge E2E Test Page","url":"http://127.0.0.1:8799/"}) |
| deny -> denied by user | PASS | ({"type":"result","id":"e2e-1786658758736-08t1u","ok":false,"error":"denied by user"}) |
| writeClipboard approved -> ok | PASS | ({"ok":true}) |
| readClipboard roundtrip matches | PASS | ({"text":"agentbridge-e2e-roundtrip"}) |
| inject -> field contains text | PASS | (field="agentbridge-injected", res={"ok":true}) |

**TOTAL: 9/9 passed**
