-- Deterministic synthetic conversation; apply after legacy-schema.sql.
INSERT INTO session (id, directory, title, version, time_created, time_updated)
VALUES ('ses_synthetic', '/synthetic/project', 'Synthetic OpenCode task', '1.4.0', 10, 100);
INSERT INTO message VALUES
('msg_user', 'ses_synthetic', 10, 10, '{"role":"user","time":{"created":10}}'),
('msg_assistant', 'ses_synthetic', 20, 25, '{"role":"assistant","parentID":"msg_user","providerID":"openai","modelID":"gpt-4.1","time":{"created":20,"completed":25},"finish":"stop","cost":0.1,"tokens":{"input":80,"output":20,"reasoning":5,"cache":{"read":10,"write":0}}}'),
('msg_next', 'ses_synthetic', 30, 35, '{"role":"assistant","parentID":"msg_user","providerID":"openai","modelID":"gpt-4.1","time":{"created":30,"completed":35},"finish":"stop","cost":0.1,"tokens":{"input":100,"output":10,"reasoning":0,"cache":{"read":20,"write":0}}}');
INSERT INTO part VALUES
('prt_user', 'msg_user', 'ses_synthetic', 10, 10, '{"type":"text","text":"Synthetic question"}'),
('prt_a1', 'msg_assistant', 'ses_synthetic', 20, 20, '{"type":"step-start"}'),
('prt_a2', 'msg_assistant', 'ses_synthetic', 22, 22, '{"type":"text","text":"Synthetic answer"}'),
('prt_a3', 'msg_assistant', 'ses_synthetic', 25, 25, '{"type":"step-finish","reason":"stop","cost":0.1,"tokens":{"input":80,"output":20,"reasoning":5,"cache":{"read":10,"write":0}}}'),
('prt_b1', 'msg_next', 'ses_synthetic', 30, 30, '{"type":"step-start"}'),
('prt_b2', 'msg_next', 'ses_synthetic', 35, 35, '{"type":"step-finish","reason":"stop","cost":0.1,"tokens":{"input":100,"output":10,"reasoning":0,"cache":{"read":20,"write":0}}}');
