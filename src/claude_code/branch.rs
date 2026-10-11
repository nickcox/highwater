//! Active branch selection. The rules are in section 5 of
//! plans/archive/claude-code-implementation-plan.md; they are kept in this one module so
//! a later way of showing several branches can replace it.

use super::records::Record;
use crate::domain::SourceError;
use std::collections::{HashMap, HashSet};

fn invalid(message: impl Into<String>) -> SourceError {
    SourceError::InvalidStructure(message.into())
}

/// Record indexes on the active branch, in conversation order.
pub(super) fn select(records: &[Record]) -> Result<Vec<usize>, SourceError> {
    let mut by_uuid = HashMap::new();
    for (index, record) in records.iter().enumerate() {
        if let Some(uuid) = record.uuid() {
            if by_uuid.insert(uuid, index).is_some() {
                return Err(invalid(format!("duplicate record uuid {uuid}")));
            }
        }
    }
    let lookup = |uuid: &str| {
        by_uuid
            .get(uuid)
            .copied()
            .ok_or_else(|| invalid(format!("broken parent link: missing record {uuid}")))
    };
    // Validate the whole graph, including branches that are not selected.
    let mut children: HashMap<usize, Vec<usize>> = HashMap::new();
    for (index, record) in records.iter().enumerate() {
        if record.uuid().is_none() {
            continue;
        }
        if let Some(parent) = record.parent() {
            children.entry(lookup(parent)?).or_default().push(index);
        }
        if let Some(parent) = record.logical_parent() {
            lookup(parent)?;
        }
    }
    let mut acyclic = HashSet::new();
    for start in by_uuid.values().copied() {
        let mut path = HashSet::new();
        let mut current = Some(start);
        while let Some(index) = current {
            if acyclic.contains(&index) {
                break;
            }
            if !path.insert(index) {
                return Err(invalid("cycle detected in parent graph"));
            }
            current = records[index].parent().map(lookup).transpose()?;
        }
        acyclic.extend(path);
    }

    let leaf = records
        .iter()
        .enumerate()
        .rev()
        .find(|(index, record)| {
            record.is_message()
                && record.uuid().is_some()
                && !children
                    .get(index)
                    .is_some_and(|kids| kids.iter().any(|kid| records[*kid].is_message()))
                && !is_side_tool_result(records, &by_uuid, &children, *index, record)
        })
        .map(|(index, _)| index)
        .ok_or_else(|| invalid("transcript has no messages"))?;

    let mut chain = Vec::new();
    let mut visited = HashSet::new();
    let mut current = Some(leaf);
    while let Some(index) = current {
        if !visited.insert(index) {
            return Err(invalid("cycle detected while following the branch"));
        }
        chain.push(index);
        let record = &records[index];
        let next = match record.parent() {
            Some(parent) => Some(parent),
            None if record.is_compact_boundary() => record.logical_parent(),
            None => None,
        };
        current = next.map(lookup).transpose()?;
    }
    chain.reverse();
    Ok(attach_parallel_tool_results(records, chain))
}

/// A tool result whose parent's response continued in a later record. Parallel
/// tool calls write one result as a child of the response's earlier record, so
/// it has no children of its own without being the end of a branch.
fn is_side_tool_result(
    records: &[Record],
    by_uuid: &HashMap<&str, usize>,
    children: &HashMap<usize, Vec<usize>>,
    index: usize,
    record: &Record,
) -> bool {
    if record.tool_result_ids().next().is_none() {
        return false;
    }
    let Some(parent) = record
        .parent()
        .and_then(|parent| by_uuid.get(parent).copied())
    else {
        return false;
    };
    let Some(response) = records[parent].message_id() else {
        return false;
    };
    children.get(&parent).is_some_and(|kids| {
        kids.iter()
            .any(|kid| *kid != index && records[*kid].message_id() == Some(response))
    })
}

/// Tool results that are not on the chain, whose tool call is in a response on
/// the chain, go after that response's last record, in file order.
fn attach_parallel_tool_results(records: &[Record], chain: Vec<usize>) -> Vec<usize> {
    let on_chain: HashSet<usize> = chain.iter().copied().collect();
    let mut response_of_tool = HashMap::new();
    let mut last_position = HashMap::new();
    let mut results_on_chain = HashSet::new();
    for (position, index) in chain.iter().enumerate() {
        let record = &records[*index];
        if let Some(response) = record.message_id() {
            last_position.insert(response, position);
            for tool in record.tool_use_ids() {
                response_of_tool.insert(tool, response);
            }
        }
        results_on_chain.extend(record.tool_result_ids());
    }
    let mut extra: HashMap<usize, Vec<usize>> = HashMap::new();
    for (index, record) in records.iter().enumerate() {
        if on_chain.contains(&index) || record.kind() != "user" {
            continue;
        }
        let tools: Vec<&str> = record.tool_result_ids().collect();
        let Some(response) = tools.first().and_then(|tool| response_of_tool.get(tool)) else {
            continue;
        };
        if tools.iter().all(|tool| {
            response_of_tool.get(tool) == Some(response) && !results_on_chain.contains(tool)
        }) {
            extra
                .entry(last_position[response])
                .or_default()
                .push(index);
            results_on_chain.extend(tools);
        }
    }
    let mut branch = Vec::with_capacity(chain.len());
    for (position, index) in chain.into_iter().enumerate() {
        branch.push(index);
        if let Some(results) = extra.remove(&position) {
            branch.extend(results);
        }
    }
    branch
}
