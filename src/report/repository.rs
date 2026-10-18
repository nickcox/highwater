//! Which git repository a directory is in, read from its `.git` entry without running git.

use std::{
    fs,
    path::{Path, PathBuf},
};

/// The git folder a directory's repository keeps its objects in. A linked worktree's
/// `.git` file points into that folder, so every worktree of a repository gives the same
/// answer. `None` when the directory is not in a repository or no longer exists.
pub(super) fn repository_of(dir: &Path) -> Option<PathBuf> {
    for ancestor in dir.ancestors() {
        let dot_git = ancestor.join(".git");
        let Ok(metadata) = fs::metadata(&dot_git) else {
            continue;
        };
        if metadata.is_dir() {
            return fs::canonicalize(dot_git).ok();
        }
        // `gitdir: <path>`, relative to the worktree when it is not absolute.
        let text = fs::read_to_string(&dot_git).ok()?;
        let gitdir = ancestor.join(
            text.lines()
                .find_map(|line| line.strip_prefix("gitdir:"))?
                .trim(),
        );
        // A worktree's git folder names the shared one in `commondir`; a submodule's has none.
        let common = match fs::read_to_string(gitdir.join("commondir")) {
            Ok(common) => gitdir.join(common.trim()),
            Err(_) => gitdir,
        };
        return fs::canonicalize(common).ok();
    }
    None
}

/// The top folder of the working tree a directory is in: the nearest folder with a `.git`
/// entry.
pub(super) fn worktree_root(dir: &Path) -> Option<PathBuf> {
    dir.ancestors()
        .find(|ancestor| ancestor.join(".git").exists())
        .map(Path::to_path_buf)
}
