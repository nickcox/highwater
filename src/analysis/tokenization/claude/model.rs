//! The reconstructed vocabularies and the settings of each Claude tokenizer generation
//! (ctok's `main.py`: `FAMILIES` and `TokenizerModel`).

use super::normalize::{BOW, CAPS, EOW, SHIFT};
use rustc_hash::FxHashMap;
use serde::Deserialize;
use std::{collections::HashSet, sync::OnceLock};

/// A Claude tokenizer generation, as ctok's families divide them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum Generation {
    /// Claude 3 to Opus 4.6.
    V3,
    /// Opus 4.7.
    V4_7,
    /// Opus 4.8 and later, which reuse the v4.7 vocabulary under a different message frame.
    V4_8,
}

#[derive(Deserialize)]
struct Document {
    fold_quotes: bool,
    allcaps_min: Option<usize>,
    pieces: Vec<String>,
    contractions: Vec<String>,
    bytes_fallback: Vec<String>,
}

pub(super) struct Model {
    pub fold_quotes: bool,
    /// The shortest all-caps span written as ⟨caps⟩ and lowercase; `None` disables ⟨caps⟩.
    pub allcaps_min: Option<usize>,
    /// Whether the message frame ends in a ⟨bow⟩ that absorbs one leading space.
    pub frame_bow: bool,
    /// Single-character pieces, which cost one token wherever no longer piece covers them.
    pub unit_pieces: HashSet<char>,
    /// Byte sequences that are one token, for characters no piece covers.
    pub byte_tokens: HashSet<Vec<u8>>,
    pub byte_max_len: usize,
    pub trie: ReverseTrie,
}

/// The vocabulary stored backwards, because the tiling ends a piece at each position and scans
/// candidate starts from right to left.
pub(super) struct ReverseTrie {
    /// Keyed by `(node << 32) | character`; looked up once or more per character tiled.
    children: FxHashMap<u64, u32>,
    terminal: Vec<bool>,
}

pub(super) const ROOT: u32 = 0;

fn key(node: u32, character: char) -> u64 {
    (u64::from(node) << 32) | u64::from(character)
}

impl ReverseTrie {
    fn new<'a>(pieces: impl Iterator<Item = &'a str>) -> Self {
        let mut trie = Self {
            children: FxHashMap::default(),
            terminal: vec![false],
        };
        for piece in pieces {
            let mut node = ROOT;
            for character in piece.chars().rev() {
                let next = trie.terminal.len() as u32;
                node = *trie
                    .children
                    .entry(key(node, character))
                    .or_insert_with(|| next);
                if node == next {
                    trie.terminal.push(false);
                }
            }
            trie.terminal[node as usize] = true;
        }
        trie
    }

    pub(super) fn child(&self, node: u32, character: char) -> Option<u32> {
        self.children.get(&key(node, character)).copied()
    }

    pub(super) fn is_terminal(&self, node: u32) -> bool {
        self.terminal[node as usize]
    }
}

fn hex_bytes(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .filter_map(|at| u8::from_str_radix(hex.get(at..at + 2)?, 16).ok())
        .collect()
}

fn build(source: &str, frame_bow: bool) -> Model {
    let document: Document =
        serde_json::from_str(source).expect("embedded Claude vocabulary is valid");
    let markers = [BOW, EOW, SHIFT, CAPS];
    let unit_pieces: HashSet<char> = document
        .pieces
        .iter()
        .filter_map(|piece| {
            let mut characters = piece.chars();
            let first = characters.next()?;
            (characters.next().is_none() && !markers.contains(&first)).then_some(first)
        })
        .collect();
    let mut byte_tokens: HashSet<Vec<u8>> = document
        .bytes_fallback
        .iter()
        .map(|hex| hex_bytes(hex))
        .collect();
    byte_tokens.extend(
        unit_pieces
            .iter()
            .map(|character| character.to_string().into_bytes()),
    );
    let byte_max_len = byte_tokens.iter().map(Vec::len).max().unwrap_or(1);
    // A contraction suffix is written with its closing marker; the apostrophe is its opening.
    let glued: Vec<String> = document
        .contractions
        .iter()
        .map(|suffix| format!("{suffix}{EOW}"))
        .collect();
    let trie = ReverseTrie::new(document.pieces.iter().chain(&glued).map(String::as_str));
    Model {
        fold_quotes: document.fold_quotes,
        allcaps_min: document.allcaps_min,
        frame_bow,
        unit_pieces,
        byte_tokens,
        byte_max_len,
        trie,
    }
}

const V3_SOURCE: &str = include_str!("../../../../data/tokenization/claude-v3.json");
const V4_7_SOURCE: &str = include_str!("../../../../data/tokenization/claude-v4.7.json");

/// Built on first use and shared.
pub(super) fn model(generation: Generation) -> &'static Model {
    static V3: OnceLock<Model> = OnceLock::new();
    static V4_7: OnceLock<Model> = OnceLock::new();
    static V4_8: OnceLock<Model> = OnceLock::new();
    match generation {
        Generation::V3 => V3.get_or_init(|| build(V3_SOURCE, true)),
        Generation::V4_7 => V4_7.get_or_init(|| build(V4_7_SOURCE, true)),
        // Opus 4.8 and later: the v4.7 vocabulary under a frame that does not end in ⟨bow⟩.
        Generation::V4_8 => V4_8.get_or_init(|| build(V4_7_SOURCE, false)),
    }
}
