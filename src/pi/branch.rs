use super::parser::PiEntry;
use crate::domain::SourceError;
use std::collections::{HashMap, HashSet};

/// Validate the entire source graph, including unselected branches, before
/// choosing the newest leaf. Parents may occur later in the JSONL file.
pub(super) fn select_branch(entries: &[PiEntry]) -> Result<Vec<usize>, SourceError> {
    let mut map = HashMap::with_capacity(entries.len());
    for (index, entry) in entries
        .iter()
        .enumerate()
        .filter(|(_, entry)| entry.kind != "session")
    {
        if map.insert(entry.id.as_str(), index).is_some() {
            return Err(SourceError::InvalidStructure(format!(
                "duplicate entry id {}",
                entry.id
            )));
        }
    }
    let mut complete = HashSet::new();
    for start in map.keys() {
        let mut path = HashSet::new();
        let mut current = Some(*start);
        while let Some(id) = current {
            if complete.contains(id) {
                break;
            }
            if !path.insert(id) {
                return Err(SourceError::InvalidStructure(format!(
                    "cycle detected in parent graph at {id}"
                )));
            }
            let entry_index = map.get(id).copied().ok_or_else(|| {
                SourceError::InvalidStructure(format!("broken parent link: missing entry {id}"))
            })?;
            current = entries[entry_index].parent.as_deref();
        }
        complete.extend(path);
    }
    let mut parents_with_children = HashSet::new();
    for entry in entries.iter().filter(|entry| entry.kind != "session") {
        if let Some(parent) = entry.parent.as_deref() {
            parents_with_children.insert(parent);
        }
    }
    let leaf_index = entries
        .iter()
        .enumerate()
        .rev()
        .find(|(_, entry)| {
            entry.kind != "session" && !parents_with_children.contains(entry.id.as_str())
        })
        .map(|(index, _)| index)
        .ok_or_else(|| SourceError::InvalidStructure("session has no branch leaf".into()))?;
    let mut chain = Vec::new();
    let mut visited = HashSet::new();
    let mut current = Some(leaf_index);
    while let Some(index) = current {
        let entry = &entries[index];
        if !visited.insert(entry.id.as_str()) {
            return Err(SourceError::InvalidStructure(format!(
                "cycle detected while following parent chain at {}",
                entry.id
            )));
        }
        chain.push(index);
        current = entry
            .parent
            .as_deref()
            .map(|parent| {
                map.get(parent).copied().ok_or_else(|| {
                    SourceError::InvalidStructure(format!(
                        "broken parent link: missing entry {parent}"
                    ))
                })
            })
            .transpose()?;
    }
    chain.reverse();
    Ok(chain)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str, parent: Option<&str>) -> PiEntry {
        PiEntry {
            id: id.into(),
            parent: parent.map(str::to_owned),
            kind: "message".into(),
            value: serde_json::json!({}),
            source_bytes: 2,
            system_section_order: Vec::new(),
            checkpoint_section_order: Vec::new(),
        }
    }

    #[test]
    fn forward_parents_are_valid_and_newest_leaf_wins() {
        let entries = [
            entry("early-leaf", Some("root")),
            entry("root", None),
            entry("newest-leaf", Some("root")),
        ];
        assert_eq!(
            select_branch(&entries).expect("valid forward parent"),
            vec![1, 2]
        );
        assert_eq!(
            select_branch(&entries[..2]).expect("forward parent"),
            vec![1, 0]
        );
    }

    #[test]
    fn duplicate_ids_are_rejected_before_branch_selection() {
        assert!(
            matches!(select_branch(&[entry("dup", None), entry("dup", None)]), Err(SourceError::InvalidStructure(message)) if message.contains("duplicate"))
        );
    }

    #[test]
    fn invalid_unselected_graphs_are_rejected() {
        for invalid in [
            vec![entry("old", Some("missing")), entry("newest", None)],
            vec![
                entry("a", Some("b")),
                entry("b", Some("a")),
                entry("newest", None),
            ],
            vec![entry("self", Some("self")), entry("newest", None)],
        ] {
            assert!(matches!(
                select_branch(&invalid),
                Err(SourceError::InvalidStructure(_))
            ));
        }
        assert!(select_branch(&[entry("selected", Some("missing"))]).is_err());
        assert!(select_branch(&[]).is_err());
    }
}
