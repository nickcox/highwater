//! Shared stamps and listing cache for session file discovery.

use std::{
    collections::{HashMap, HashSet},
    fs, io,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum DiscoveryError {
    #[error("cannot read the transcript directory: {0}")]
    Io(#[from] io::Error),
    #[error("a transcript entry is outside the configured root")]
    OutsideRoot,
    #[error("discovery was cancelled")]
    Cancelled,
}

/// A size and modification time, used to tell whether a file changed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct FileStamp {
    pub byte_size: u64,
    pub modified_nanos: Option<u128>,
}

impl FileStamp {
    pub(crate) fn of(metadata: &fs::Metadata) -> Self {
        Self {
            byte_size: metadata.len(),
            modified_nanos: metadata
                .modified()
                .ok()
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_nanos()),
        }
    }
}

/// A discovered session file whose listing can be cached.
pub(crate) trait ListedFile {
    /// Everything whose change means the listing must be read again.
    type Key: PartialEq;

    fn path(&self) -> &Path;
    fn key(&self) -> Self::Key;
    /// The file's own stamp; a listing is reused only when its modified time is known.
    fn stamp(&self) -> FileStamp;
}

/// Listings keyed by path and stamps, so an unchanged session is not read again on every
/// catalogue refresh.
pub(crate) struct ListingCache<F: ListedFile, L> {
    entries: HashMap<PathBuf, (F::Key, L)>,
    /// Read attempts since the cache was created, for tests.
    pub(crate) reads: usize,
}

impl<F: ListedFile, L> Default for ListingCache<F, L> {
    fn default() -> Self {
        Self {
            entries: HashMap::new(),
            reads: 0,
        }
    }
}

impl<F: ListedFile, L: Clone> ListingCache<F, L> {
    /// `Ok(None)` when the file was removed after it was found.
    pub(crate) fn listing(
        &mut self,
        file: &F,
        read: impl FnOnce(&F) -> io::Result<L>,
    ) -> io::Result<Option<L>> {
        let path = file.path();
        let key = file.key();
        if let Some((cached_key, listing)) = self.entries.get(path) {
            if *cached_key == key && file.stamp().modified_nanos.is_some() {
                return Ok(Some(listing.clone()));
            }
        }
        self.reads += 1;
        let listing = match read(file) {
            Ok(listing) => listing,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        };
        self.entries.insert(path.to_owned(), (key, listing.clone()));
        Ok(Some(listing))
    }

    /// Forget files that were not found by the latest discovery.
    pub(crate) fn retain(&mut self, files: &[F]) {
        let current: HashSet<&Path> = files.iter().map(ListedFile::path).collect();
        self.entries
            .retain(|path, _| current.contains(path.as_path()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestFile {
        path: &'static str,
        stamp: FileStamp,
        sidecar: Option<FileStamp>,
    }

    impl ListedFile for TestFile {
        type Key = (FileStamp, Option<FileStamp>);

        fn path(&self) -> &Path {
            Path::new(self.path)
        }

        fn key(&self) -> Self::Key {
            (self.stamp, self.sidecar)
        }

        fn stamp(&self) -> FileStamp {
            self.stamp
        }
    }

    fn file(path: &'static str) -> TestFile {
        TestFile {
            path,
            stamp: FileStamp {
                byte_size: 10,
                modified_nanos: Some(1),
            },
            sidecar: None,
        }
    }

    #[test]
    fn reuses_an_unchanged_listing() {
        let file = file("session");
        let mut cache = ListingCache::default();
        assert_eq!(cache.listing(&file, |_| Ok(1)).unwrap(), Some(1));
        assert_eq!(cache.listing(&file, |_| Ok(2)).unwrap(), Some(1));
        assert_eq!(cache.reads, 1);
    }

    #[test]
    fn reads_again_when_either_stamp_changes() {
        let mut file = file("session");
        let mut cache = ListingCache::default();
        assert_eq!(cache.listing(&file, |_| Ok(1)).unwrap(), Some(1));
        file.stamp.byte_size += 1;
        assert_eq!(cache.listing(&file, |_| Ok(2)).unwrap(), Some(2));
        file.sidecar = Some(file.stamp);
        assert_eq!(cache.listing(&file, |_| Ok(3)).unwrap(), Some(3));
        assert_eq!(cache.reads, 3);
    }

    #[test]
    fn reads_every_time_when_modified_time_is_unknown() {
        let mut file = file("session");
        file.stamp.modified_nanos = None;
        let mut cache = ListingCache::default();
        assert_eq!(cache.listing(&file, |_| Ok(1)).unwrap(), Some(1));
        assert_eq!(cache.listing(&file, |_| Ok(2)).unwrap(), Some(2));
        assert_eq!(cache.reads, 2);
    }

    #[test]
    fn a_removed_file_has_no_listing() {
        let mut cache = ListingCache::<_, u32>::default();
        let listing = cache.listing(&file("session"), |_| Err(io::ErrorKind::NotFound.into()));
        assert_eq!(listing.unwrap(), None);
        assert_eq!(cache.reads, 1);
    }

    #[test]
    fn retains_only_files_found_in_the_latest_discovery() {
        let kept = file("kept");
        let removed = file("removed");
        let mut cache = ListingCache::default();
        assert_eq!(cache.listing(&kept, |_| Ok(1)).unwrap(), Some(1));
        assert_eq!(cache.listing(&removed, |_| Ok(2)).unwrap(), Some(2));
        cache.retain(std::slice::from_ref(&kept));
        assert_eq!(cache.listing(&kept, |_| Ok(3)).unwrap(), Some(1));
        assert_eq!(cache.listing(&removed, |_| Ok(4)).unwrap(), Some(4));
        assert_eq!(cache.reads, 3);
    }
}
