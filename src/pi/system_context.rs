//! Logical Pi prompt/loadout replay, independent of conversation summarization.
//! Pi 1.0.4 transcript helpers ignore `replace`; we retain their append/patch behavior
//! but mark such records uncertain until a complete checkpoint establishes a baseline.
use super::*;

pub(super) struct SystemUpdate {
    content: String,
    sections: Vec<(String, Option<String>)>,
    removed: Vec<String>,
    added: Vec<(String, String, bool)>,
    valid: bool,
    checkpoint: bool,
    loadout_declared: bool,
}
impl SystemUpdate {
    pub(super) fn parse(entry: &PiEntry, checkpoint: bool) -> Self {
        let value = entry.value.get(if checkpoint {
            "systemMessage"
        } else {
            "message"
        });
        let order = if checkpoint {
            &entry.checkpoint_section_order
        } else {
            &entry.system_section_order
        };
        let mut update = Self {
            content: String::new(),
            sections: Vec::new(),
            removed: Vec::new(),
            added: Vec::new(),
            valid: true,
            checkpoint,
            loadout_declared: value.is_some_and(|v| checkpoint || v.get("toolsAdded").is_some()),
        };
        let Some(value) = value else {
            update.valid = false;
            return update;
        };
        update.valid = value.get("role").and_then(Value::as_str) == Some("system")
            && value.get("replace") != Some(&Value::Bool(true));
        match value.get("content") {
            Some(Value::String(text)) => update.content.clone_from(text),
            Some(Value::Array(parts)) => {
                let mut texts = Vec::new();
                for part in parts {
                    if part.get("type").and_then(Value::as_str) == Some("text") {
                        if let Some(text) = part.get("text").and_then(Value::as_str) {
                            texts.push(text);
                        } else {
                            update.valid = false;
                        }
                    } else {
                        update.valid = false;
                    }
                }
                update.content = texts.join("\n");
            }
            _ => update.valid = false,
        }
        if let Some(sections) = value.get("sections") {
            if let Some(sections) = sections.as_object() {
                for name in order {
                    match sections.get(name) {
                        Some(Value::String(text)) => {
                            update.sections.push((name.clone(), Some(text.clone())))
                        }
                        Some(Value::Null) => update.sections.push((name.clone(), None)),
                        _ => update.valid = false,
                    }
                }
                if order.len() != sections.len() {
                    update.valid = false;
                }
            } else {
                update.valid = false;
            }
        }
        if let Some(removed) = value.get("toolsRemoved") {
            if let Some(removed) = removed.as_array() {
                for tool in removed {
                    if let Some(name) = tool.get("name").and_then(Value::as_str) {
                        update.removed.push(name.to_owned());
                    } else {
                        update.valid = false;
                    }
                }
            } else {
                update.valid = false;
            }
        }
        if let Some(added) = value.get("toolsAdded") {
            if let Some(added) = added.as_array() {
                for tool in added {
                    if let Some(name) = tool
                        .get("name")
                        .and_then(Value::as_str)
                        .filter(|name| !name.is_empty())
                    {
                        let complete = tool.get("description").is_some_and(Value::is_string)
                            && tool.get("parameters").is_some_and(Value::is_object);
                        // Preserve every recorded declaration field. This is an estimate,
                        // not a claim that generic JSON equals the provider wire format.
                        update
                            .added
                            .push((name.to_owned(), tool.to_string(), complete));
                    } else {
                        update.valid = false;
                    }
                }
            } else {
                update.valid = false;
            }
        }
        update
    }
}

#[derive(Clone)]
struct Revision {
    item: NormalizedContextItem,
    text: String,
    complete: bool,
}
#[derive(Default)]
pub(super) struct SystemReplay {
    content: Vec<String>,
    sections: Vec<(String, String)>,
    tools: Vec<(String, Revision)>,
    prompt: Option<Revision>,
    uncertain: bool,
    loadout_declared: bool,
    pub(super) loadout_known: bool,
}
impl SystemReplay {
    pub(super) fn apply(
        &mut self,
        update: SystemUpdate,
        entry: &PiEntry,
        session: &str,
    ) -> Vec<NormalizedContextItem> {
        let old_tools = if update.checkpoint {
            self.tools.clone()
        } else {
            Vec::new()
        };
        if update.checkpoint {
            self.content.clear();
            self.sections.clear();
            self.tools.clear();
            self.uncertain = false;
        }
        self.uncertain |= !update.valid;
        self.loadout_declared = if update.checkpoint {
            update.loadout_declared
        } else {
            self.loadout_declared || update.loadout_declared
        };
        if !update.content.is_empty() {
            self.content.push(update.content);
        }
        for (name, text) in update.sections {
            if let Some(text) = text {
                if let Some(section) = self.sections.iter_mut().find(|(key, _)| *key == name) {
                    section.1 = text;
                } else {
                    self.sections.push((name, text));
                }
            } else {
                self.sections.retain(|(key, _)| *key != name);
            }
        }
        // Object.fromEntries/Object.values in Pi enumerate integer section keys
        // ahead of ordinary insertion-ordered names, even after re-insertion.
        self.sections.sort_by_key(|(key, _)| {
            key.parse::<u32>()
                .ok()
                .filter(|n| *n < u32::MAX && n.to_string() == *key)
                .map_or((1, 0), |n| (0, n))
        });
        let text = self
            .content
            .iter()
            .map(String::as_str)
            .chain(self.sections.iter().map(|(_, text)| text.as_str()))
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("\n\n");
        let complete = !self.uncertain;
        if self
            .prompt
            .as_ref()
            .is_none_or(|old| old.text != text || old.complete != complete)
        {
            let item = revision_item(
                entry,
                session,
                "system",
                ContextItemKind::System,
                "System prompt".into(),
                TokenizationPayload::SystemPrompt {
                    text: text.clone(),
                    complete,
                },
            );
            self.prompt = Some(Revision {
                item,
                text,
                complete,
            });
        }
        for name in update.removed {
            self.tools.retain(|(key, _)| *key != name);
        }
        for (name, text, valid) in update.added {
            let complete = valid && !self.uncertain;
            let current = self.tools.iter().position(|(key, _)| *key == name);
            let reusable = current.map(|i| &self.tools[i].1).or_else(|| {
                update
                    .checkpoint
                    .then(|| {
                        old_tools
                            .iter()
                            .find(|(key, _)| *key == name)
                            .map(|(_, r)| r)
                    })
                    .flatten()
            });
            let revision =
                if let Some(old) = reusable.filter(|r| r.text == text && r.complete == complete) {
                    old.clone()
                } else {
                    let key = format!("tool-{}", blake3::hash(name.as_bytes()).to_hex());
                    let mut item = revision_item(
                        entry,
                        session,
                        &key,
                        ContextItemKind::ToolDefinition,
                        format!("{name} definition"),
                        TokenizationPayload::ToolDefinition {
                            text: text.clone(),
                            complete,
                        },
                    );
                    item.metadata.insert("toolName".into(), name.clone());
                    Revision {
                        item,
                        text,
                        complete,
                    }
                };
            if let Some(i) = current {
                self.tools[i].1 = revision;
            } else {
                self.tools.push((name, revision));
            }
        }
        // Baseline knowledge survives malformed declarations so removing or repairing
        // them can recover completeness. A no-op cannot hide an invalid active tool.
        self.loadout_known = self.loadout_declared
            && !self.uncertain
            && self.tools.iter().all(|(_, revision)| revision.complete);
        // If a malformed delta leaves earlier tool definitions in place, their
        // prompt-level unknown-state marker prevents a complete request claim.
        self.prompt
            .iter()
            .map(|r| r.item.clone())
            .chain(self.tools.iter().map(|(_, r)| r.item.clone()))
            .collect()
    }
}
fn revision_item(
    entry: &PiEntry,
    session: &str,
    role: &str,
    kind: ContextItemKind,
    label: String,
    payload: TokenizationPayload,
) -> NormalizedContextItem {
    let mut identity = blake3::Hasher::new_derive_key("TokenPlume Pi context revision v1");
    for part in [session, entry.id.as_str(), role] {
        identity.update(&(part.len() as u64).to_le_bytes());
        identity.update(part.as_bytes());
    }
    let mut metadata = BTreeMap::new();
    metadata.insert("estimateBasis".into(), "logical-pi-system-context".into());
    NormalizedContextItem {
        id: format!("pi:{session}:context:{}", identity.finalize().to_hex()),
        kind,
        label,
        payload,
        source_record_id: Some(entry.id.clone()),
        source_tool_call_id: None,
        metadata,
        serialized_size_bytes: entry.source_bytes,
        presence: Vec::new(),
        first_model_call: 0,
        last_model_call: 0,
    }
}
