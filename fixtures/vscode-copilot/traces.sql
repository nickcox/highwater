-- Made-up Copilot trace records. For fixtures/vscode-copilot/User/workspaceStorage/0a1b2c3d/
-- chatSessions/11111111-agent.jsonl: the two calls of its first request, the tool call between
-- them and a helper call TokenPlume ignores. A Claude call for another session follows. The tables are as Copilot Chat creates them.
CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
INSERT INTO schema_version VALUES (1);
CREATE TABLE spans (
  span_id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, parent_span_id TEXT,
  name TEXT NOT NULL, start_time_ms INTEGER NOT NULL, end_time_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 0, status_message TEXT,
  operation_name TEXT, provider_name TEXT, agent_name TEXT, conversation_id TEXT,
  request_model TEXT, response_model TEXT,
  input_tokens INTEGER, output_tokens INTEGER, cached_tokens INTEGER, reasoning_tokens INTEGER,
  tool_name TEXT, tool_call_id TEXT, tool_type TEXT,
  chat_session_id TEXT, turn_index INTEGER, ttft_ms REAL
);
CREATE TABLE span_attributes (
  span_id TEXT NOT NULL REFERENCES spans(span_id) ON DELETE CASCADE,
  key TEXT NOT NULL, value TEXT,
  PRIMARY KEY (span_id, key)
);
CREATE TABLE span_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  span_id TEXT NOT NULL REFERENCES spans(span_id) ON DELETE CASCADE,
  name TEXT NOT NULL, timestamp_ms INTEGER NOT NULL, attributes TEXT
);

INSERT INTO spans (span_id, trace_id, name, start_time_ms, end_time_ms, operation_name, provider_name, agent_name, conversation_id, request_model, response_model, input_tokens, output_tokens, cached_tokens, reasoning_tokens, tool_name, tool_call_id, chat_session_id) VALUES ('span-1', 'trace-1', 'chat gpt-6-luna', 1790000001500, 1790000002000.75, 'chat', 'github', 'panel/editAgent', '11111111-agent', 'gpt-6-luna', 'gpt-6-luna', 1500, 80, 1200, 120, NULL, NULL, '11111111-agent');
INSERT INTO spans (span_id, trace_id, name, start_time_ms, end_time_ms, operation_name, provider_name, agent_name, conversation_id, request_model, response_model, input_tokens, output_tokens, cached_tokens, reasoning_tokens, tool_name, tool_call_id, chat_session_id) VALUES ('span-tool', 'trace-1', 'execute_tool read_file', 1790000002100, 1790000002140.5, 'execute_tool', 'github', NULL, '11111111-agent', NULL, NULL, NULL, NULL, NULL, NULL, 'read_file', 'call_read', '11111111-agent');
INSERT INTO spans (span_id, trace_id, name, start_time_ms, end_time_ms, operation_name, provider_name, agent_name, conversation_id, request_model, response_model, input_tokens, output_tokens, cached_tokens, reasoning_tokens, tool_name, tool_call_id, chat_session_id) VALUES ('span-2', 'trace-1', 'chat gpt-6-luna', 1790000003000, 1790000004000.5, 'chat', 'github', 'panel/editAgent', '11111111-agent', 'gpt-6-luna', 'gpt-6-luna', 1800, 60, 1500, 0, NULL, NULL, '11111111-agent');
INSERT INTO spans (span_id, trace_id, name, start_time_ms, end_time_ms, operation_name, provider_name, agent_name, conversation_id, request_model, response_model, input_tokens, output_tokens, cached_tokens, reasoning_tokens, tool_name, tool_call_id, chat_session_id) VALUES ('span-title', 'trace-1', 'chat gpt-5-mini', 1790000001200, 1790000001400.25, 'chat', 'github', 'title', '11111111-agent', 'gpt-5-mini', 'gpt-5-mini', 300, 8, 0, 0, NULL, NULL, '11111111-agent');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-1', 'gen_ai.response.id', 'response-1');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-1', 'copilot_chat.copilot_usage_nano_aiu', '50000000');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-1', 'copilot_chat.request.shape', '{"api": "responses", "inputItemCount": 2, "inputItemTypes": ["message", "message"]}');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-1', 'gen_ai.system_instructions', '[{"type": "text", "content": "You are an expert AI programming assistant, working with a user in the VS Code editor."}]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-1', 'gen_ai.tool.definitions', '[{"type": "function", "name": "read_file", "description": "Read the contents of a file.", "parameters": {"type": "object", "properties": {"filePath": {"type": "string"}}}}]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-1', 'gen_ai.response.finish_reasons', '["stop"]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-1', 'gen_ai.output.messages', '[{"role": "assistant", "parts": [{"type": "text", "content": "I''ll read the parser first."}, {"type": "tool_call", "id": "call_read", "name": "read_file", "arguments": "{\"filePath\":\"/home/dev/my project/src/parser.rs\"}"}]}]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-tool', 'gen_ai.tool.call.id', 'call_read');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-tool', 'gen_ai.tool.call.result', 'fn parse() {}');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-2', 'gen_ai.response.id', 'response-1');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-2', 'copilot_chat.copilot_usage_nano_aiu', '30000000');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-2', 'copilot_chat.request.shape', '{"api": "responses", "inputItemCount": 1, "inputItemTypes": ["function_call_output"], "hasPreviousResponseId": true}');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-2', 'gen_ai.tool.definitions', '[{"type": "function", "name": "read_file", "description": "Read the contents of a file.", "parameters": {"type": "object", "properties": {"filePath": {"type": "string"}}}}]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-2', 'gen_ai.response.finish_reasons', '["stop"]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-2', 'gen_ai.input.messages', '[{"role": "tool", "parts": [{"type": "tool_call_response", "id": "call_read", "response": "fn parse() {}"}]}]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-2', 'gen_ai.output.messages', '[{"role": "assistant", "parts": [{"type": "text", "content": "The test expected a trailing newline; fixed."}]}]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-title', 'gen_ai.response.id', 'title-response');

-- One Claude call for fixtures/vscode-copilot/User/workspaceStorage/4e5f6a7b/chatSessions/
-- 22222222-remote.jsonl, whose input splits into cache reads and writes.
INSERT INTO spans (span_id, trace_id, name, start_time_ms, end_time_ms, operation_name, provider_name, agent_name, conversation_id, request_model, response_model, input_tokens, output_tokens, cached_tokens, reasoning_tokens, chat_session_id) VALUES ('span-r1', 'trace-r1', 'chat claude-haiku-5.5', 1790100001200, 1790100002400.5, 'chat', 'github', 'panel/editAgent', '22222222-remote', 'claude-haiku-5.5', 'claude-haiku-5.5', 900, 40, 300, 0, '22222222-remote');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-r1', 'gen_ai.response.id', 'response-r1');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-r1', 'copilot_chat.copilot_usage_nano_aiu', '12000000');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-r1', 'gen_ai.usage.cache_creation.input_tokens', '500');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-r1', 'copilot_chat.request.shape', '{"api": "messages", "messageCount": 1}');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-r1', 'gen_ai.system_instructions', '[{"type": "text", "content": "You are an expert AI programming assistant."}]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-r1', 'gen_ai.tool.definitions', '[{"type": "function", "name": "read_file", "description": "Read a file.", "parameters": {}}]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-r1', 'gen_ai.input.messages', '[{"role": "user", "parts": [{"type": "text", "content": "Summarise the service"}]}]');
INSERT INTO span_attributes (span_id, key, value) VALUES ('span-r1', 'gen_ai.output.messages', '[{"role": "assistant", "parts": [{"type": "text", "content": "It serves the build API."}]}]');
