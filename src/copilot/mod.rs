//! Read-only GitHub Copilot sessions, written by the Copilot app and the Copilot CLI. See
//! docs/sources/copilot.md.

pub(crate) mod discovery;
mod reconstruct;

pub(crate) use reconstruct::usage_checkpoint_cost;

pub(crate) use reconstruct::Reconstruction as Loaded;

#[cfg(test)]
mod tests;

use crate::domain::SourceError;
use std::{fs, path::Path};

/// Synchronous; intended for a bounded blocking worker. Never writes.
///
/// `path` is a session's `events.jsonl`. The title comes from the `workspace.yaml` beside it.
pub(crate) fn load(path: &Path) -> Result<Loaded, SourceError> {
    let text = fs::read_to_string(path).map_err(SourceError::Io)?;
    let folder = path.parent().unwrap_or(path);
    let workspace = discovery::read_workspace(folder);
    // The folder is named after the session ID, for a session whose first line is unfinished.
    let fallback = folder
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let mut loaded = reconstruct::reconstruct(&text, &fallback)?;
    loaded.session.title = workspace.name;
    if loaded.session.working_directory.is_none() {
        loaded.session.working_directory = workspace.cwd;
    }
    Ok(loaded)
}
