#!/usr/bin/env python3
"""Generate a deterministic, non-sensitive Pi JSONL benchmark session."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

SHAPES = {
    "small": (8, 24),
    "medium": (40, 80),
    "large": (160, 400),
    "churn": (100, 220),
    "long-lived": (120, 260),
}


def record(kind: str, entry_id: str, parent: str | None, **fields: object) -> dict[str, object]:
    value: dict[str, object] = {"type": kind, "id": entry_id, "parentId": parent}
    value.update(fields)
    return value


def message(
    entry_id: str,
    parent: str | None,
    role: str,
    content: object,
    *,
    provider: str | None = None,
    model: str | None = None,
    call_index: int | None = None,
    stop_reason: str = "stop",
) -> dict[str, object]:
    body: dict[str, object] = {"role": role, "content": content}
    if provider is not None:
        body.update(
            {
                "provider": provider,
                "model": model,
                "api": "responses" if provider == "openai" else "messages",
                "usage": {
                    "input": (call_index or 1) * 11,
                    "output": 17,
                    "cacheRead": (call_index or 1) * 3,
                    "cacheWrite": 0,
                    "reasoning": 2 if provider == "openai" else None,
                    "totalTokens": (call_index or 1) * 11 + 19,
                },
                "stopReason": stop_reason,
            }
        )
    return record("message", entry_id, parent, message=body)


def generate(case: str) -> list[dict[str, object]]:
    calls, _ = SHAPES[case]
    entries: list[dict[str, object]] = [
        {
            "type": "session",
            "version": 3,
            "id": f"benchmark-{case}",
            "timestamp": "2026-01-01T00:00:00Z",
            "cwd": "/tmp/tokenplume-generated",
        }
    ]
    parent: str | None = None
    # Keep a stable system/tool-definition prefix so the large case reaches
    # the requested 400-item corpus without using real transcript content.
    prefix_items = 70 if case == "large" else 8 if case == "medium" else 2
    for prefix in range(prefix_items):
        role = "system" if prefix == 0 else "toolDefinition"
        prefix_id = f"prefix-{prefix}"
        entries.append(message(prefix_id, parent, role, [{"type": "text", "text": f"generated {role} {prefix}"}]))
        parent = prefix_id
    user_ids: list[str] = []
    compaction_calls = {call for call in (calls // 2, calls - 20) if call > 2}
    branch_inserted = False

    for call in range(1, calls + 1):
        if case in {"churn", "long-lived"}:
            text_size = 160 if case == "churn" else 6000
        else:
            text_size = 180 if call % 7 else 14000
        user_id = f"u{call}"
        user_ids.append(user_id)
        text = f"generated user message {call} " + ("context-" + str(call % 11) + " ") * (text_size // 12)
        content: object = [{"type": "text", "text": text}]
        if call == min(25, calls):
            content = [
                {"type": "text", "text": text[:300]},
                {"type": "image", "mimeType": "image/png", "data": "generated-image-bytes"},
            ]
        entries.append(message(user_id, parent, "user", content))
        parent = user_id

        provider = "openai" if call <= max(1, calls // 2) else "anthropic"
        model = "gpt-4o-mini" if provider == "openai" else "claude-3-5-sonnet"
        assistant_id = f"a{call}"
        blocks: list[dict[str, object]] = [
            {"type": "text", "text": f"generated assistant response {call}"},
        ]
        has_tool = call % 12 == 0 and calls >= 12
        if has_tool:
            blocks.append(
                {
                    "type": "toolCall",
                    "id": f"tool-{call}",
                    "name": "generated_tool",
                    "arguments": '{"seed": "stable", "call": %d}' % call,
                }
            )
        entries.append(
            message(
                assistant_id,
                parent,
                "assistant",
                blocks,
                provider=provider,
                model=model,
                call_index=call,
                stop_reason="toolUse" if has_tool else "stop",
            )
        )
        parent = assistant_id

        if has_tool:
            failed = call % 24 == 0
            result_text = "generated tool result " + ("result-line " * (1800 if call % 24 == 0 else 120))
            entries.append(
                record(
                    "message",
                    f"r{call}",
                    parent,
                    message={
                        "role": "toolResult",
                        "toolCallId": f"tool-{call}",
                        "toolName": "generated_tool",
                        "isError": failed,
                        "content": [{"type": "text", "text": result_text}],
                    },
                )
            )
            parent = f"r{call}"

        # An earlier branch is deliberately left unselected. The main chain is
        # continued afterwards, so file order still selects its newest leaf.
        if not branch_inserted and call == max(2, calls // 4):
            branch_inserted = True
            branch_parent = parent
            branch_user = f"branch-u{call}"
            entries.append(message(branch_user, branch_parent, "user", [{"type": "text", "text": "unselected generated branch"}]))
            entries.append(message(f"branch-a{call}", branch_user, "assistant", [{"type": "text", "text": "unselected branch response"}], provider="openai", model="gpt-4o-mini", call_index=call))
            parent = branch_parent

        if call in compaction_calls:
            first_kept = user_ids[max(0, len(user_ids) - 16)]
            compaction_id = f"compact-{call}"
            entries.append(
                record(
                    "compaction",
                    compaction_id,
                    parent,
                    summary=("generated compaction summary " + ("summary-token " * 300)),
                    firstKeptEntryId=first_kept,
                    tokensBefore=call * 100,
                )
            )
            parent = compaction_id

    return entries


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", choices=sorted(SHAPES), default="large")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as handle:
        for value in generate(args.case):
            handle.write(json.dumps(value, separators=(",", ":"), sort_keys=True))
            handle.write("\n")


if __name__ == "__main__":
    main()
