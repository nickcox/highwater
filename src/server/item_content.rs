use super::{
    analysis::AnalysisService,
    error::{AppError, FlightError},
};
use crate::{
    analysis::item_text,
    source::{self, SessionLocator},
};
use serde::Serialize;
use std::sync::Arc;

const PAGE_BYTES: usize = 8 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ItemContentPage {
    text: String,
    next_cursor: Option<String>,
}

pub(super) async fn read(
    analysis: &AnalysisService,
    locator: SessionLocator,
    item_id: String,
    native_session_id: Option<String>,
    cursor: Option<String>,
) -> Result<ItemContentPage, AppError> {
    let cursor = cursor.map(parse_cursor).transpose()?;
    let permit = Arc::clone(&analysis.permits)
        .acquire_owned()
        .await
        .map_err(|_| AppError::Shared(Arc::new(FlightError::Unavailable)))?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        let loaded = source::load(&locator, None)
            .map_err(|error| AppError::Shared(Arc::new(error.into())))?;
        if native_session_id.is_some_and(|id| id != loaded.normalized.id) {
            return Err(AppError::ItemContentChanged);
        }
        let item = loaded
            .normalized
            .context_items
            .iter()
            .find(|item| item.id == item_id)
            .ok_or(AppError::ItemContentUnavailable)?;
        page(&item_text(&item.payload), cursor)
    })
    .await
    .map_err(|error| AppError::Shared(Arc::new(FlightError::Task(error))))?
}

fn parse_cursor(cursor: String) -> Result<(usize, blake3::Hash), AppError> {
    let invalid = || AppError::InvalidItemContentRequest;
    let (offset, hash) = cursor.split_once('.').ok_or_else(invalid)?;
    let offset = offset.parse::<usize>().map_err(|_| invalid())?;
    let hash = blake3::Hash::from_hex(hash).map_err(|_| invalid())?;
    Ok((offset, hash))
}

fn page(text: &str, cursor: Option<(usize, blake3::Hash)>) -> Result<ItemContentPage, AppError> {
    if text.is_empty() {
        return Err(AppError::ItemContentUnavailable);
    }
    let hash = blake3::hash(text.as_bytes());
    let start = match cursor {
        Some((_, previous)) if previous != hash => return Err(AppError::ItemContentChanged),
        Some((offset, _)) if offset < text.len() && text.is_char_boundary(offset) => offset,
        Some(_) => return Err(AppError::InvalidItemContentRequest),
        None => 0,
    };
    let mut end = start.saturating_add(PAGE_BYTES).min(text.len());
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    Ok(ItemContentPage {
        text: text[start..end].to_owned(),
        next_cursor: (end < text.len()).then(|| format!("{end}.{hash}")),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pages_keep_utf8_intact_and_detect_edits() {
        let text = format!("{}🌊tail", "x".repeat(PAGE_BYTES - 1));
        let first = page(&text, None).unwrap();
        assert_eq!(first.text.len(), PAGE_BYTES - 1);
        let cursor = parse_cursor(first.next_cursor.unwrap()).unwrap();
        let last = page(&text, Some(cursor)).unwrap();
        assert_eq!(last.text, "🌊tail");
        assert!(last.next_cursor.is_none());
        assert!(matches!(
            page("edited", Some(cursor)),
            Err(AppError::ItemContentChanged)
        ));
    }
}
