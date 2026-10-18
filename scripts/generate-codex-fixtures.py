#!/usr/bin/env python3
"""Writes the synthetic Codex fixtures in fixtures/codex/home. Needs the zstd command.

Run from the repository root: python3 scripts/generate-codex-fixtures.py fixtures/codex/home
The output folder should be empty or missing. See fixtures/codex/README.md."""
import json, os, sys, subprocess, struct
home = sys.argv[1]
def rec(ts, type_, payload): return json.dumps({"timestamp": ts, "type": type_, "payload": payload}, ensure_ascii=False, separators=(',', ':'))
def meta(id_, ts, cwd, source="vscode", thread_source="user", **extra):
    p = {"session_id": extra.pop("session_id", id_), "id": id_, "timestamp": ts, "cwd": cwd, "originator": "Codex Desktop",
         "cli_version": "0.153.4", "source": source, "thread_source": thread_source, "model_provider": "openai",
         "base_instructions": {"text": "You are Codex, a synthetic coding agent for fixtures."}, "history_mode": "paginated"}
    p.update(extra)
    return rec(ts, "session_meta", p)
def turn(ts, usage=True, text="Synthetic request"):
    out = [rec(ts, "event_msg", {"type": "task_started", "turn_id": "turn-1"}),
           rec(ts, "turn_context", {"turn_id": "turn-1", "cwd": "/synthetic/project", "model": "gpt-5.5", "effort": "medium", "summary": "auto"}),
           rec(ts, "response_item", {"type": "message", "role": "user", "content": [{"type": "input_text", "text": text}]}),
           rec(ts, "response_item", {"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "Synthetic answer"}]})]
    if usage:
        u = {"input_tokens": 1200, "cached_input_tokens": 0, "cache_write_input_tokens": 0, "output_tokens": 20, "reasoning_output_tokens": 0, "total_tokens": 1220}
        out.append(rec(ts, "event_msg", {"type": "token_count", "info": {"total_token_usage": u, "last_token_usage": u, "model_context_window": 258400}}))
    out.append(rec(ts, "event_msg", {"type": "task_complete", "turn_id": "turn-1"}))
    return out
ids = {
  "main": "01a10000-0000-7000-8000-000000000001",
  "compressed": "01a10000-0000-7000-8000-000000000002",
  "guardian": "01a10000-0000-7000-8000-000000000003",
  "spawned": "01a10000-0000-7000-8000-000000000004",
  "unused": "01a10000-0000-7000-8000-000000000005",
  "archived": "01a10000-0000-7000-8000-000000000006",
}
day = os.path.join(home, "sessions", "2026", "10", "01")
os.makedirs(day, exist_ok=True); os.makedirs(os.path.join(home, "archived_sessions"), exist_ok=True)
def write(name, lines, folder=day):
    path = os.path.join(folder, name)
    with open(path, "w", encoding="utf-8") as f: f.write("\n".join(lines) + "\n")
    return path
name = lambda key, t: f"rollout-2026-10-01T{t}-{ids[key]}.jsonl"
# The first line has a U+2028 inside a string, which must not split the record.
write(name("main", "10-00-00"), [meta(ids["main"], "2026-10-01T00:00:00.000Z", "/synthetic/project")] + turn("2026-10-01T00:00:01.000Z", text="Line one still line one"))
p = write(name("compressed", "11-00-00"), [meta(ids["compressed"], "2026-10-01T01:00:00.000Z", "/synthetic/other")] + turn("2026-10-01T01:00:01.000Z"))
subprocess.run(["zstd", "-q", "--rm", "-f", p], check=True)
write(name("guardian", "10-05-00"), [meta(ids["guardian"], "2026-10-01T00:05:00.000Z", "/synthetic/project", source={"subagent": {"other": "guardian"}}, thread_source="subagent", forked_from_id=ids["main"], subagent_history_start_ordinal=3)] + turn("2026-10-01T00:05:01.000Z"))
write(name("spawned", "10-06-00"), [meta(ids["spawned"], "2026-10-01T00:06:00.000Z", "/synthetic/project", source={"subagent": {"thread_spawn": {"parent_thread_id": ids["main"], "depth": 1, "agent_path": "/root/code_review", "agent_nickname": "Hopper", "agent_role": None}}}, thread_source="subagent", session_id=ids["main"], parent_thread_id=ids["main"], forked_from_id=ids["main"], agent_nickname="Hopper", agent_path="/root/code_review")] + turn("2026-10-01T00:06:01.000Z"))
write(name("unused", "12-00-00"), [meta(ids["unused"], "2026-10-01T02:00:00.000Z", "/synthetic/project")] + turn("2026-10-01T02:00:01.000Z", usage=False))
# The archived session is split over two zstd frames with a skippable frame between them.
lines = [meta(ids["archived"], "2026-09-01T00:00:00.000Z", "/synthetic/archive")] + turn("2026-09-01T00:00:01.000Z")
half = len(lines) // 2
a = subprocess.run(["zstd", "-q", "-c"], input=("\n".join(lines[:half]) + "\n").encode(), capture_output=True, check=True).stdout
b = subprocess.run(["zstd", "-q", "-c"], input=("\n".join(lines[half:]) + "\n").encode(), capture_output=True, check=True).stdout
skippable = struct.pack("<II", 0x184D2A5A, 4) + b"skip"
with open(os.path.join(home, "archived_sessions", f"rollout-2026-09-01T00-00-00-{ids['archived']}.jsonl.zst"), "wb") as f: f.write(a + skippable + b)
# A main session with most record types. Calls: 1 and 2 in the first turn (reasoning kept
# between them), 3 in the second turn (reasoning dropped), then a compaction, then call 4.
def usage(input_tokens, cached, output, reasoning):
    u = {"input_tokens": input_tokens, "cached_input_tokens": cached, "cache_write_input_tokens": 0,
         "output_tokens": output, "reasoning_output_tokens": reasoning, "total_tokens": input_tokens + output}
    return {"type": "token_count", "info": {"total_token_usage": u, "last_token_usage": u, "model_context_window": 258400}}
def item(payload): return ("response_item", payload)
def event(payload): return ("event_msg", payload)
def message(role, *texts, kind=None):
    part = kind or ("output_text" if role == "assistant" else "input_text")
    return {"type": "message", "role": role, "content": [{"type": part, "text": t} for t in texts]}
png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
rich = [
    event({"type": "task_started", "turn_id": "01a20000-0000-7000-8000-000000000071"}),
    item(message("developer", "<permissions instructions>\nSynthetic sandbox rules.")),
    item(message("user", "<environment_context>\n  <cwd>/synthetic/project</cwd>\n</environment_context>")),
    ("turn_context", {"turn_id": "01a20000-0000-7000-8000-000000000071", "cwd": "/synthetic/project", "model": "gpt-5.5", "effort": "medium", "summary": "auto"}),
    item({"type": "message", "role": "user", "content": [{"type": "input_text", "text": "Fix the failing test"}, {"type": "input_image", "image_url": "data:image/png;base64," + png}]}),
    item({"type": "reasoning", "summary": [], "content": None, "encrypted_content": "synthetic-encrypted"}),
    item(message("assistant", "I'll run the tests first.")),
    item({"type": "function_call", "name": "exec_command", "arguments": json.dumps({"cmd": "cargo test\n--quiet", "workdir": "/synthetic/project"}), "call_id": "call_exec"}),
    item({"type": "function_call_output", "call_id": "call_exec", "output": "test result: FAILED"}),
    event(usage(5000, 0, 300, 120)),
    item({"type": "reasoning", "summary": [], "content": None, "encrypted_content": "synthetic-encrypted"}),
    item({"type": "custom_tool_call", "name": "apply_patch", "input": "*** Begin Patch\n*** Update File: /synthetic/project/src/lib.rs\n@@\n-old\n+new\n*** End Patch", "call_id": "call_patch"}),
    item({"type": "custom_tool_call_output", "call_id": "call_patch", "output": [{"type": "input_text", "text": "Success. Updated the following files:\nM src/lib.rs"}]}),
    event(usage(5600, 4800, 200, 50)),
    item(message("assistant", "Fixed.")),
    event(usage(5900, 5500, 40, 0)),
    event({"type": "task_complete", "turn_id": "01a20000-0000-7000-8000-000000000071"}),
    event({"type": "task_started", "turn_id": "01a20000-0000-7000-8000-000000000072"}),
    item(message("user", "Now tidy up")),
    item(message("assistant", "Done tidying.")),
    event(usage(6100, 5800, 30, 0)),
    event({"type": "task_complete", "turn_id": "01a20000-0000-7000-8000-000000000072"}),
    ("compacted", {"message": "", "replacement_history": [
        message("user", "Fix the failing test"),
        message("user", "Now tidy up"),
        message("user", "# AGENTS.md instructions for /synthetic/project\n\nSynthetic agent rules."),
        {"type": "compaction", "encrypted_content": "synthetic-summary"}],
        "compaction_response_id": "resp_synthetic", "latest_token_usage_record": {}}),
    event(usage(0, 0, 0, 0)),
    event({"type": "task_started", "turn_id": "01a20000-0000-7000-8000-000000000073"}),
    item(message("user", "Anything else?")),
    item(message("assistant", "No.")),
    event(usage(3000, 0, 10, 0)),
]
ids["rich"] = "01a10000-0000-7000-8000-000000000007"
dynamic = [{"type": "namespace", "name": "codex_app", "description": "", "tools": [{"type": "function", "name": "automation_update", "description": "Synthetic tool", "parameters": {"type": "object"}}]}]
write(name("rich", "14-00-00"), [meta(ids["rich"], "2026-10-01T04:00:00.000Z", "/synthetic/project", dynamic_tools=dynamic)]
      + [rec("2026-10-01T04:00:%02d.000Z" % (i + 1), t, p) for i, (t, p) in enumerate(rich)])
# A fork of the rich session: the first turn is a copy of the parent's (its turn ID is older
# than the fork's thread ID), then its own turn, then a new context window recorded as an
# empty compaction followed by the history it starts with.
fork_turns = [
    event({"type": "task_started", "turn_id": "01a20000-0000-7000-8000-000000000071"}),
    item(message("user", "Fix the failing test")),
    item({"type": "reasoning", "summary": [], "content": None, "encrypted_content": "synthetic-encrypted"}),
    item(message("assistant", "I'll run the tests first.")),
    event(usage(5000, 0, 300, 120)),
    event({"type": "task_complete", "turn_id": "01a20000-0000-7000-8000-000000000071"}),
    event({"type": "task_started", "turn_id": "01a30000-0000-7000-8000-000000000081"}),
    item(message("user", "Try another approach")),
    item(message("assistant", "Trying another approach.")),
    event(usage(5400, 5000, 20, 0)),
    event({"type": "task_complete", "turn_id": "01a30000-0000-7000-8000-000000000081"}),
    ("compacted", {"message": "", "replacement_history": [], "window_id": "w2", "previous_window_id": "w1", "first_window_id": "w1", "window_number": 2, "compaction_response_id": None, "latest_token_usage_record": None}),
    ("compacted", {"message": "", "replacement_history": [message("user", "Try another approach")], "latest_token_usage_record": {}}),
    event({"type": "task_started", "turn_id": "01a30000-0000-7000-8000-000000000082"}),
    item(message("assistant", "Still going.")),
    event(usage(900, 0, 15, 0)),
]
ids["fork"] = "01a30000-0000-7000-8000-000000000008"
write(name("fork", "15-00-00"), [meta(ids["fork"], "2026-10-01T05:00:00.000Z", "/synthetic/project", forked_from_id=ids["rich"])]
      + [rec("2026-10-01T05:00:%02d.000Z" % (i + 1), t, p) for i, (t, p) in enumerate(fork_turns)])
# Files that are not sessions.
with open(os.path.join(day, "notes.txt"), "w") as f: f.write("not a session\n")
os.makedirs(os.path.join(day, "too", "deep"), exist_ok=True)
write(name("unused", "13-00-00").replace(ids["unused"], "01a10000-0000-7000-8000-000000000099"), [meta("01a10000-0000-7000-8000-000000000099", "2026-10-01T03:00:00.000Z", "/synthetic/project")] + turn("2026-10-01T03:00:01.000Z"), folder=os.path.join(day, "too", "deep"))
with open(os.path.join(home, "session_index.jsonl"), "w", encoding="utf-8") as f:
    for line in [{"id": ids["main"], "thread_name": "First title", "updated_at": "2026-10-01T00:00:02Z"},
                 {"id": ids["archived"], "thread_name": "Archived work", "updated_at": "2026-09-01T00:00:02Z"},
                 {"id": ids["main"], "thread_name": "Synthetic Codex task", "updated_at": "2026-10-01T00:10:00Z"}]:
        f.write(json.dumps(line) + "\n")
print(json.dumps(ids))
