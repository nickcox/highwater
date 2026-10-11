//! Offline token counts for Claude models, ported from ctok (github.com/sanderland/ctok, MIT,
//! commit 8c43ffd), which reconstructs Claude's tokenizers from `count_tokens` measurements.
//! The vocabularies are converted by `scripts/convert-ctok-vocabulary.py`.

mod engine;
mod model;
mod normalize;

pub(crate) use model::Generation;

/// Tokens for `text` as the content of one user message, without the message's fixed overhead.
pub(crate) fn count(text: &str, generation: Generation) -> u64 {
    engine::tile_cost(text, model::model(generation))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Case {
        source: String,
        generation: String,
        text: String,
        count: u64,
    }

    /// Driven by `scripts/check-claude-tokenizer-parity.py`, which writes Python ctok's counts.
    #[test]
    #[ignore = "needs cases written by scripts/check-claude-tokenizer-parity.py"]
    fn claude_tokenizer_matches_ctok() {
        let path = std::env::var("TOKENPLUME_CLAUDE_PARITY_CASES")
            .expect("TOKENPLUME_CLAUDE_PARITY_CASES names the cases file");
        let cases = std::fs::read_to_string(path).expect("cases file is readable");
        let (mut checked, mut mismatches) = (0, Vec::new());
        for line in cases.lines() {
            let case: Case = serde_json::from_str(line).expect("case is valid");
            let generation = match case.generation.as_str() {
                "v3" => Generation::V3,
                "v4.7" => Generation::V4_7,
                "v4.8" => Generation::V4_8,
                other => panic!("unknown generation {other}"),
            };
            let counted = count(&case.text, generation);
            checked += 1;
            if counted != case.count {
                mismatches.push((case, counted));
            }
        }
        for (case, counted) in mismatches.iter().take(25) {
            let preview: String = case.text.chars().take(60).collect();
            eprintln!(
                "{} {}: ctok {} port {} {preview:?}",
                case.source, case.generation, case.count, counted
            );
        }
        eprintln!("{checked} cases, {} mismatches", mismatches.len());
        assert!(mismatches.is_empty());
    }
}
