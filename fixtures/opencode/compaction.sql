-- Extend simple.sql with a successful reasoning-bearing summary and a follow-up call.
INSERT INTO message VALUES
('msg_marker', 'ses_synthetic', 40, 40, '{"role":"user","time":{"created":40}}'),
('msg_summary', 'ses_synthetic', 50, 55, '{"role":"assistant","parentID":"msg_marker","providerID":"openai","modelID":"gpt-4.1","summary":true,"time":{"created":50,"completed":55},"finish":"stop","cost":0.1,"tokens":{"input":120,"output":20,"reasoning":5,"cache":{"read":20,"write":0}}}'),
('msg_after', 'ses_synthetic', 60, 65, '{"role":"assistant","parentID":"msg_marker","providerID":"openai","modelID":"gpt-4.1","time":{"created":60,"completed":65},"finish":"stop","cost":0.1,"tokens":{"input":50,"output":10,"reasoning":0,"cache":{"read":0,"write":0}}}');
INSERT INTO part VALUES
('prt_marker', 'msg_marker', 'ses_synthetic', 40, 40, '{"type":"compaction","auto":false}'),
('prt_s1', 'msg_summary', 'ses_synthetic', 50, 50, '{"type":"step-start"}'),
('prt_s2', 'msg_summary', 'ses_synthetic', 51, 51, '{"type":"reasoning","text":"Synthetic summary reasoning"}'),
('prt_s3', 'msg_summary', 'ses_synthetic', 52, 52, '{"type":"text","text":"Synthetic compaction summary"}'),
('prt_s4', 'msg_summary', 'ses_synthetic', 55, 55, '{"type":"step-finish","reason":"stop","cost":0.1,"tokens":{"input":120,"output":20,"reasoning":5,"cache":{"read":20,"write":0}}}'),
('prt_c1', 'msg_after', 'ses_synthetic', 60, 60, '{"type":"step-start"}'),
('prt_c2', 'msg_after', 'ses_synthetic', 65, 65, '{"type":"step-finish","reason":"stop","cost":0.1,"tokens":{"input":50,"output":10,"reasoning":0,"cache":{"read":0,"write":0}}}');
