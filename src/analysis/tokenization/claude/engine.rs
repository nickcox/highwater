//! The minimum-cost tiling of the marked stream (ctok's `engine.py`), returning the count only.

use super::model::{Model, ReverseTrie, ROOT};
use super::normalize::{self, escaped_literal, is_marker};

/// Tokens for `text` as the content of one user message, without the message's fixed overhead.
pub(super) fn tile_cost(text: &str, model: &Model) -> u64 {
    let norm = normalize::nfc(text, model.fold_quotes);
    let trailing_newlines = norm.chars().rev().take_while(|c| *c == '\n').count();
    let stream: Vec<char> = normalize::stream_norm(&norm, model, text.starts_with(' '))
        .chars()
        .collect();
    let tail = frame_tail(trailing_newlines, model);
    if stream.is_empty() {
        return tail;
    }
    vocab_tile(&stream, &model.trie, |at| unit_floor(&stream, at, model)) + tail
}

/// Cost-1 pieces through the trie, plus a guaranteed one-character edge.
fn vocab_tile(text: &[char], trie: &ReverseTrie, unit_cost: impl Fn(usize) -> u64) -> u64 {
    let mut best = vec![0_u64; text.len() + 1];
    for end in 1..=text.len() {
        let start = end - 1;
        let node = trie.child(ROOT, text[start]);
        best[end] = best[start]
            + match node {
                Some(node) if trie.is_terminal(node) => 1,
                _ => unit_cost(start),
            };
        let Some(mut node) = node else {
            continue;
        };
        for start in (0..end - 1).rev() {
            let Some(next) = trie.child(node, text[start]) else {
                break;
            };
            node = next;
            if trie.is_terminal(node) {
                best[end] = best[end].min(best[start] + 1);
            }
        }
    }
    best[text.len()]
}

/// A content-final run of `n` newlines, beyond the frame's own trailing token. The frame
/// appends two newlines and one token can span into them, so the tokenizer sees `n + 2`.
fn frame_tail(newlines: usize, model: &Model) -> u64 {
    if newlines == 0 {
        return 0;
    }
    let run = vec!['\n'; newlines + 2];
    vocab_tile(&run, &model.trie, |_| 1) - 1
}

/// One character no piece covers: a marker is a token, anything else falls to its bytes.
fn unit_floor(stream: &[char], at: usize, model: &Model) -> u64 {
    let character = stream[at];
    if is_marker(character) {
        1
    } else {
        char_cost(character, model)
    }
}

/// 1 if the character is a piece, else a minimum-cost tiling of its UTF-8 bytes over the
/// byte-prefix tokens, every single byte costing 1.
fn char_cost(character: char, model: &Model) -> u64 {
    let character = escaped_literal(character);
    if model.unit_pieces.contains(&character) {
        return 1;
    }
    let bytes = character.to_string().into_bytes();
    if model.byte_tokens.is_empty() {
        return bytes.len() as u64;
    }
    let mut best = vec![u64::MAX; bytes.len() + 1];
    best[0] = 0;
    for end in 1..=bytes.len() {
        for start in end.saturating_sub(model.byte_max_len)..end {
            if best[start] == u64::MAX {
                continue;
            }
            if end - start == 1 || model.byte_tokens.contains(&bytes[start..end]) {
                best[end] = best[end].min(best[start] + 1);
            }
        }
    }
    best[bytes.len()]
}
