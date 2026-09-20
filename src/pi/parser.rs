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
        entries.push(PiEntry {
            id,
            parent,
            kind,
            value,
            source_bytes,
        });
    }
    Ok(entries)
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
