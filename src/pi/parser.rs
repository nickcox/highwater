use serde_json::Value;
use std::io::BufRead;
use thiserror::Error;

#[derive(Debug, Clone)]
pub(crate) struct PiEntry {
    pub id: String,
    pub parent: Option<String>,
    pub kind: String,
    pub value: Value,
    /// Bytes in the source record excluding its line terminator.
    pub source_bytes: u64,
    /// Source order is meaningful for Pi's rendered system sections only.
    pub system_section_order: Vec<String>,
    pub checkpoint_section_order: Vec<String>,
}

#[derive(Debug, Error)]
pub(crate) enum PiParseError {
    #[error("cannot read session: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid JSON on line {line}: {source}")]
    Json {
        line: usize,
        source: serde_json::Error,
    },
}

pub(crate) fn parse_reader<R: BufRead>(mut reader: R) -> Result<Vec<PiEntry>, PiParseError> {
    let mut entries = Vec::new();
    let mut raw = String::new();
    let mut line = 0_usize;
    loop {
        raw.clear();
        let bytes_read = reader.read_line(&mut raw)?;
        if bytes_read == 0 {
            break;
        }
        line += 1;
        let record = raw.trim_end_matches(['\n', '\r']);
        let source_bytes = u64::try_from(record.len()).unwrap_or(u64::MAX);
        let value: Value =
            serde_json::from_str(record).map_err(|source| PiParseError::Json { line, source })?;
        let fallback_id = format!("line-{line}");
        let id = value
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or(&fallback_id)
            .to_owned();
        let parent = value
            .get("parentId")
            .and_then(Value::as_str)
            .map(str::to_owned);
        let kind = value
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_owned();
        let system_section_order = if value
            .get("message")
            .and_then(|m| m.get("role"))
            .and_then(Value::as_str)
            == Some("system")
        {
            section_order(record, "message")
        } else {
            Vec::new()
        };
        let checkpoint_section_order =
            if kind == "compaction" && value.get("systemMessage").is_some() {
                section_order(record, "systemMessage")
            } else {
                Vec::new()
            };
        entries.push(PiEntry {
            id,
            parent,
            kind,
            value,
            source_bytes,
            system_section_order,
            checkpoint_section_order,
        });
    }
    Ok(entries)
}

/// Read just section keys in source order, leaving ordinary Value canonicalization intact.
fn section_order(record: &str, field: &str) -> Vec<String> {
    use serde::{
        de::{IgnoredAny, MapAccess, Visitor},
        Deserialize, Deserializer,
    };
    use serde_json::value::RawValue;
    use std::collections::HashMap;
    struct Keys(Vec<String>);
    impl<'de> Deserialize<'de> for Keys {
        fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
            struct KeyVisitor;
            impl<'de> Visitor<'de> for KeyVisitor {
                type Value = Keys;
                fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                    f.write_str("section map")
                }
                fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Keys, M::Error> {
                    let mut keys = Vec::new();
                    while let Some(key) = map.next_key::<String>()? {
                        map.next_value::<IgnoredAny>()?;
                        if !keys.contains(&key) {
                            keys.push(key);
                        }
                    }
                    // ECMAScript Object.entries enumerates array-index keys first.
                    fn index(key: &str) -> Option<u32> {
                        key.parse::<u32>()
                            .ok()
                            .filter(|n| *n < u32::MAX && n.to_string() == key)
                    }
                    keys.sort_by_key(|key| index(key).map_or((1, 0), |n| (0, n)));
                    Ok(Keys(keys))
                }
            }
            d.deserialize_map(KeyVisitor)
        }
    }
    let extract = || -> Option<Vec<String>> {
        let root: HashMap<String, Box<RawValue>> = serde_json::from_str(record).ok()?;
        let message: HashMap<String, Box<RawValue>> =
            serde_json::from_str(root.get(field)?.get()).ok()?;
        Some(
            serde_json::from_str::<Keys>(message.get("sections")?.get())
                .ok()?
                .0,
        )
    };
    extract().unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn reusable_parser_accepts_final_line_and_crlf() {
        let input = b"{\"type\":\"session\",\"id\":\"s\"}\r\n{\"type\":\"message\",\"id\":\"m\",\"parentId\":null}";
        let entries = parse_reader(Cursor::new(input)).expect("JSONL");
        assert_eq!(entries.len(), 2);
        assert_eq!(
            entries[0].source_bytes,
            b"{\"type\":\"session\",\"id\":\"s\"}".len() as u64
        );
        assert_eq!(
            entries[1].source_bytes,
            b"{\"type\":\"message\",\"id\":\"m\",\"parentId\":null}".len() as u64
        );
    }

    #[test]
    fn malformed_reusable_line_reports_one_based_line() {
        let error = parse_reader(Cursor::new(b"{}\nnot-json")).expect_err("invalid JSON");
        assert!(error.to_string().contains("line 2"));
    }
}
