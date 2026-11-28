#!/usr/bin/env python3
"""Writes the synthetic Copilot fixtures in fixtures/copilot/home.

Run from the repository root: python3 scripts/generate-copilot-fixtures.py fixtures/copilot/home
The output folder should be empty or missing. See fixtures/copilot/README.md."""
import json, os, sys

home = sys.argv[1]
state = os.path.join(home, "session-state")
ids = {
    "app": "1c000000-0000-4000-8000-000000000001",
    "cli": "1c000000-0000-4000-8000-000000000002",
    "unused": "1c000000-0000-4000-8000-000000000003",
    "empty": "1c000000-0000-4000-8000-000000000004",
}
counter = 0


def event(ts, type_, data, **extra):
    global counter
    counter += 1
    record = {"type": type_, "data": data, "id": f"00000000-0000-4000-8000-{counter:012d}", "timestamp": ts, "parentId": None}
    record.update(extra)
    return json.dumps(record, ensure_ascii=False, separators=(",", ":"))


def copilot_usage(input_tokens, cache_read, cache_write, output, nano):
    counts = [("input", input_tokens - cache_read - cache_write),
              ("cache_read", cache_read), ("cache_write", cache_write), ("output", output)]
    rate = nano * 1_000_000 / (input_tokens + output)
    return {"totalNanoAiu": nano, "tokenDetails": [
        {"tokenType": kind, "tokenCount": count, "batchSize": 1_000_000, "costPerBatch": rate}
        for kind, count in counts]}


def usage(ts, call_id, input_tokens, cache_read, cache_write, output, reasoning=0, model="gpt-6.2-astra", endpoint="/responses", nano=10_000_000_000, **extra):
    u = {"model": model, "responseModel": model, "provider": {"id": "copilot", "kind": "copilot", "label": "GitHub Copilot"},
         "inputTokens": input_tokens, "outputTokens": output, "cacheReadTokens": cache_read, "cacheWriteTokens": cache_write,
         "reasoningTokens": reasoning, "cost": 1.0, "duration": 2000, "initiator": "agent", "interactionType": "conversation-agent",
         "apiEndpoint": endpoint, "apiCallId": call_id, "toolTokenCount": 900, "availableToolCount": 4, "finishReason": "stop",
         "copilotUsage": copilot_usage(input_tokens, cache_read, cache_write, output, nano)}
    return event(ts, "session.usage_record", {"usage": u}, **extra)


def message(ts, call_id, content="", tools=(), model="gpt-6.2-astra", turn="0", agent_id=None, **fields):
    data = {"messageId": f"m-{call_id}", "model": model, "providerId": "copilot", "content": content,
            "toolRequests": [{"toolCallId": i, "name": n, "arguments": a, "type": "function"} for i, n, a in tools],
            "turnId": turn, "apiCallId": call_id}
    data.update(fields)
    extra = {"agentId": agent_id, "data": {**data, "parentToolCallId": "call-task"}} if agent_id else {}
    if agent_id:
        return event(ts, "assistant.message", extra.pop("data"), **extra)
    return event(ts, "assistant.message", data)


def tool(ts, call_id, name, arguments, content, success=True):
    data = {"toolCallId": call_id, "success": success, "result": {"content": content}}
    if not success:
        data = {"toolCallId": call_id, "success": False, "error": {"message": content}}
    return [event(ts, "tool.execution_start", {"toolCallId": call_id, "toolName": name, "arguments": arguments}),
            event(ts, "tool.execution_complete", data)]


def write(key, lines, workspace=None, unfinished=None):
    folder = os.path.join(state, ids[key])
    os.makedirs(folder, exist_ok=True)
    if lines is not None:
        text = "\n".join(lines) + "\n" + (unfinished or "")
        with open(os.path.join(folder, "events.jsonl"), "w", encoding="utf-8") as f:
            f.write(text)
    if workspace is not None:
        with open(os.path.join(folder, "workspace.yaml"), "w", encoding="utf-8") as f:
            f.write(workspace)


system = "You are GitHub Copilot, a synthetic coding agent for fixtures."
skill = "# Synthetic skill\n\nFollow these synthetic steps."

# A Copilot app session read in full. Calls: 1 runs a command, 2 loads a skill, 3 answers with
# reasoning. A subagent's events are left out. A compaction starts in the background after
# call 3 and is applied after the second request: its own call (4) is sent the context it
# started from, and it keeps the last two of the eight messages it started from (the skill's
# message, and call 3's response with its reasoning) and the request added while it ran.
# The second request repeats the system message, which is not a new item, and changes to a
# Claude model for call 5.
app = [
    event("2026-11-01T00:00:00.000Z", "session.start", {"sessionId": ids["app"], "version": 1, "producer": "copilot-agent",
          "copilotVersion": "1.0.106", "startTime": "2026-11-01T00:00:00.000Z", "selectedModel": "gpt-6.2-astra",
          "context": {"cwd": "/synthetic/project"}}),
    event("2026-11-01T00:00:10.000Z", "user.message", {"content": "List the files", "transformedContent": "<current_datetime>2026-11-01</current_datetime>\n\nList the files", "turnId": "0"}),
    event("2026-11-01T00:00:10.001Z", "system.message", {"role": "system", "content": system}),
    event("2026-11-01T00:00:10.002Z", "assistant.turn_start", {"turnId": "0"}),
    usage("2026-11-01T00:00:12.000Z", "api-1", 1200, 0, 1000, 20),
    message("2026-11-01T00:00:12.001Z", "api-1", tools=[("call-1", "bash", {"command": "ls src\nwc -l src/*"})]),
    *tool("2026-11-01T00:00:12.100Z", "call-1", "bash", {"command": "ls src\nwc -l src/*"}, "main.rs\nlib.rs"),
    event("2026-11-01T00:00:12.200Z", "assistant.turn_end", {"turnId": "0"}),
    event("2026-11-01T00:00:12.201Z", "assistant.turn_start", {"turnId": "1"}),
    usage("2026-11-01T00:00:14.000Z", "api-2", 1300, 1000, 280, 30),
    message("2026-11-01T00:00:14.001Z", "api-2", "I'll load the skill.", [("call-2", "skill", {"skill": "synthetic"}), ("call-3", "view", {"path": "/synthetic/project/missing.rs"})], turn="1"),
    *tool("2026-11-01T00:00:14.100Z", "call-2", "skill", {"skill": "synthetic"}, "Skill \"synthetic\" loaded successfully."),
    event("2026-11-01T00:00:14.101Z", "skill.invoked", {"name": "synthetic", "path": "/synthetic/skills/synthetic/SKILL.md", "content": skill}),
    *tool("2026-11-01T00:00:14.102Z", "call-3", "view", {"path": "/synthetic/project/missing.rs"}, "Path does not exist", success=False),
    event("2026-11-01T00:00:14.103Z", "skill.context_delivered_ref", {"source": "skill-synthetic", "contentId": "sha256:0", "prefix": "<skill-context name=\"synthetic\">\n", "suffix": "\n</skill-context>"}),
    event("2026-11-01T00:00:14.200Z", "assistant.turn_end", {"turnId": "1"}),
    event("2026-11-01T00:00:14.201Z", "assistant.turn_start", {"turnId": "2"}),
    # A subagent's call, recorded in the same file.
    usage("2026-11-01T00:00:15.000Z", "api-sub", 500, 0, 0, 10, agentId="agent-1"),
    message("2026-11-01T00:00:15.001Z", "api-sub", "Subagent answer", agent_id="agent-1"),
    usage("2026-11-01T00:00:18.000Z", "api-3", 1450, 1280, 170, 60, reasoning=40),
    message("2026-11-01T00:00:18.001Z", "api-3", "There are two files.", turn="2", reasoningOpaque="opaque", encryptedContent="encrypted", reasoningText=""),
    event("2026-11-01T00:00:18.100Z", "assistant.turn_end", {"turnId": "2"}),
    event("2026-11-01T00:00:30.000Z", "session.compaction_start", {"compactionAttemptId": "attempt-1", "execution": "background"}),
    event("2026-11-01T00:01:00.000Z", "session.model_change", {"previousModel": "gpt-6.2-astra", "newModel": "claude-sonnet-5.5"}),
    event("2026-11-01T00:01:10.000Z", "user.message", {"content": "Summarise", "transformedContent": "Summarise", "turnId": "0"}),
    event("2026-11-01T00:01:10.001Z", "system.message", {"role": "system", "content": system}),
    event("2026-11-01T00:01:10.002Z", "session.compaction_complete", {"success": True, "compactionAttemptId": "attempt-1",
          "trigger": "threshold", "execution": "background",
          "preCompactionMessagesLength": 8, "messagesRemoved": 6, "preCompactionTokens": 1600,
          "postCompactionTokens": 1100, "systemTokens": 600, "toolDefinitionsTokens": 400, "conversationTokens": 100,
          "summarizerProgress": {"durationMs": 6000},
          "compactionTokensUsed": {"requestCount": 1, "model": "gpt-6.2-astra", "inputTokens": 1600, "outputTokens": 90,
                                   "cacheReadTokens": 1450, "cacheWriteTokens": 0, "duration": 5000,
                                   "copilotUsage": copilot_usage(1600, 1450, 0, 90, 30000000000)},
          "summaryContent": "The user asked for the files; there are two."}),
    event("2026-11-01T00:01:10.003Z", "assistant.turn_start", {"turnId": "0"}),
    usage("2026-11-01T00:01:12.000Z", "api-4", 1400, 0, 1400, 15, model="claude-sonnet-5.5", endpoint="/v1/messages"),
    message("2026-11-01T00:01:12.001Z", "api-4", "Two files.", model="claude-sonnet-5.5"),
    event("2026-11-01T00:01:12.100Z", "assistant.turn_end", {"turnId": "0"}),
]
write("app", app, workspace=f"id: {ids['app']}\ncwd: /synthetic/project\nclient_name: github/autopilot\nname: \"Synthetic: app session\"\nuser_named: true\ncreated_at: 2026-11-01T00:00:00.000Z\n")

# A CLI session whose last line is still being written.
cli = [
    event("2026-11-02T00:00:00.000Z", "session.start", {"sessionId": ids["cli"], "copilotVersion": "1.0.91", "selectedModel": "gpt-6.2-astra", "context": {"cwd": "/synthetic/other"}}),
    event("2026-11-02T00:00:01.000Z", "user.message", {"content": "Hello"}),
    event("2026-11-02T00:00:01.001Z", "system.message", {"role": "system", "content": system}),
    event("2026-11-02T00:00:01.002Z", "assistant.turn_start", {"turnId": "0"}),
    usage("2026-11-02T00:00:02.000Z", "api-1", 1100, 0, 0, 5),
    message("2026-11-02T00:00:02.001Z", "api-1", "Hello"),
]
write("cli", cli, workspace=f"id: {ids['cli']}\ncwd: /synthetic/other\nclient_name: github/cli\ncreated_at: 2026-11-02T00:00:00.000Z\n",
      unfinished='{"type":"assistant.turn_end","data":{"tur')

# A session Copilot opened for its own use, with no calls: not listed.
write("unused", [event("2026-11-03T00:00:00.000Z", "session.start", {"sessionId": ids["unused"], "copilotVersion": "1.0.106"})],
      workspace=f"id: {ids['unused']}\ncwd: /\nclient_name: github-copilot-app-plugin-management\n")

# A session folder with no event log: not listed.
write("empty", None, workspace=f"id: {ids['empty']}\ncwd: /\n")
