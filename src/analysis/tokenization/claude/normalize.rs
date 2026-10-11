//! Text to the marked stream (ctok's `normalize.py` and `constants.py`): normalisation, the class
//! split, case marking and the boundary markers. Each rule mirrors ctok's measured behaviour; the
//! comments name the ctok function it comes from.

use super::model::Model;
use std::sync::OnceLock;
use unicode_general_category::{get_general_category, GeneralCategory};
use unicode_normalization::{char::canonical_combining_class, UnicodeNormalization};

// Structural markers, one noncharacter codepoint each (`constants.py`).
pub(super) const BOW: char = '\u{FDD0}';
pub(super) const EOW: char = '\u{FDD1}';
const PAD: char = '\u{FDD2}';
pub(super) const SHIFT: char = '\u{FDD3}';
pub(super) const CAPS: char = '\u{FDD4}';

pub(super) fn is_marker(character: char) -> bool {
    matches!(character, BOW | EOW | SHIFT | CAPS)
}

/// Literal marker codepoints in text are escaped to private-use codepoints after NFC (which
/// strips private use), and priced as the original noncharacter.
fn escape_literal(character: char) -> char {
    match character {
        BOW => '\u{E000}',
        EOW => '\u{E001}',
        PAD => '\u{E002}',
        SHIFT => '\u{E003}',
        CAPS => '\u{E004}',
        other => other,
    }
}

pub(super) fn escaped_literal(character: char) -> char {
    match character {
        '\u{E000}' => BOW,
        '\u{E001}' => EOW,
        '\u{E002}' => PAD,
        '\u{E003}' => SHIFT,
        '\u{E004}' => CAPS,
        other => other,
    }
}

/// Unicode general category as Python's two-letter code.
fn category(character: char) -> &'static str {
    use GeneralCategory::*;
    match get_general_category(character) {
        UppercaseLetter => "Lu",
        LowercaseLetter => "Ll",
        TitlecaseLetter => "Lt",
        ModifierLetter => "Lm",
        OtherLetter => "Lo",
        NonspacingMark => "Mn",
        SpacingMark => "Mc",
        EnclosingMark => "Me",
        DecimalNumber => "Nd",
        LetterNumber => "Nl",
        OtherNumber => "No",
        ConnectorPunctuation => "Pc",
        DashPunctuation => "Pd",
        OpenPunctuation => "Ps",
        ClosePunctuation => "Pe",
        InitialPunctuation => "Pi",
        FinalPunctuation => "Pf",
        OtherPunctuation => "Po",
        MathSymbol => "Sm",
        CurrencySymbol => "Sc",
        ModifierSymbol => "Sk",
        OtherSymbol => "So",
        SpaceSeparator => "Zs",
        LineSeparator => "Zl",
        ParagraphSeparator => "Zp",
        Control => "Cc",
        Format => "Cf",
        Surrogate => "Cs",
        PrivateUse => "Co",
        Unassigned => "Cn",
        _ => "Cn",
    }
}

fn category_group(character: char) -> char {
    category(character).as_bytes()[0] as char
}

fn is_mark(character: char) -> bool {
    category_group(character) == 'M'
}

// ---- measured tables (`constants.py`) -----------------------------------------------------

/// Non-ASCII symbols and punctuation that tile over the punctuation vocabulary.
const PUNCT_SYMS: &str = "—»«•°„–−£§€…√→（№†└│།·─═█";
/// CJK Symbols and Punctuation members of category So that read as punctuation.
const IDEOGRAPHIC_SYMBOLS: &str = "〄〒〓〠〶〷〾〿";
/// Symbol-letters that take the full word model.
const SYMBOL_LETTERS: [(u32, u32); 4] = [
    (0x16EE, 0x16F0),
    (0x2160, 0x2188),
    (0x24B6, 0x24E9),
    (0xA6E6, 0xA6EF),
];
const VARIATION_SELECTORS: (u32, u32) = (0xFE00, 0xFE0F);
/// Apostrophe suffixes that bind into the word before them.
const CONTRACTION_SUFFIXES: [&str; 7] = ["s", "t", "d", "m", "ll", "re", "ve"];
/// Unicode 16.0 case pairs that ctok adds on top of Python 3.13's Unicode 15.1 data.
const NEW_CASE_PAIRS: [(char, char); 2] = [('\u{1c89}', '\u{1c8a}'), ('\u{a7cb}', '\u{0264}')];
/// Uncased for the models although Unicode calls it a capital.
const UNCASED: char = '\u{03f4}';

fn is_new_cased(character: char) -> bool {
    NEW_CASE_PAIRS
        .iter()
        .any(|(upper, lower)| *upper == character || *lower == character)
}

// ---- normalisation (`nfc`) ---------------------------------------------------------------

/// NFC, the controls and private use the API strips, Thai SARA AM, curly quotes (v3 only) and
/// the space separators the tokenizer treats as U+0020.
pub(super) fn nfc(text: &str, fold_quotes: bool) -> String {
    let normalized: String = text.nfc().collect();
    let mut out = String::with_capacity(normalized.len());
    for character in normalized.chars() {
        let code = character as u32;
        let stripped_control = matches!(code, 0x01..=0x08 | 0x0B..=0x1F | 0x7F..=0x9F);
        if stripped_control {
            continue;
        }
        out.push(if character == '\0' { ' ' } else { character });
    }
    let out = out.replace("\u{0E4D}\u{0E32}", "\u{0E33}");
    out.chars()
        .filter(|character| !(0xE000..=0xF8FF).contains(&(*character as u32)))
        .map(|character| match character {
            '\u{2018}' | '\u{2019}' if fold_quotes => '\'',
            '\u{201C}' | '\u{201D}' if fold_quotes => '"',
            '\u{00A0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200A}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202F}'
            | '\u{205F}' => ' ',
            other => other,
        })
        .collect()
}

// ---- case (`_lower`, `_is_upper`, `_is_lower`, `mark_case`) -------------------------------

fn lower_char(character: char) -> String {
    if character == UNCASED {
        return character.to_string();
    }
    if let Some((_, lower)) = NEW_CASE_PAIRS.iter().find(|(upper, _)| *upper == character) {
        return lower.to_string();
    }
    character.to_lowercase().collect()
}

fn lower(text: &[char]) -> String {
    text.iter()
        .map(|character| lower_char(*character))
        .collect()
}

fn is_upper(character: char) -> bool {
    if character == UNCASED {
        return false;
    }
    NEW_CASE_PAIRS.iter().any(|(upper, _)| *upper == character)
        || (character.is_uppercase() && lower_char(character) != character.to_string())
}

fn is_lower(character: char) -> bool {
    NEW_CASE_PAIRS.iter().any(|(_, lower)| *lower == character) || character.is_lowercase()
}

fn span_is_upper(text: &[char]) -> bool {
    let mut cased = text
        .iter()
        .filter(|character| is_upper(**character) || is_lower(**character))
        .peekable();
    cased.peek().is_some() && cased.all(|character| is_upper(*character))
}

/// A whole span becomes ⟨caps⟩ + lowercase (all caps, long enough) or ⟨shift⟩ + lowercase
/// (title case); anything else stays literal.
fn mark_case(span: &[char], allcaps_min: Option<usize>, head_mark: bool) -> String {
    let literal = || span.iter().collect::<String>();
    if head_mark || span.contains(&'ẞ') {
        return literal();
    }
    if span.contains(&'İ') {
        let tail = &span[1..];
        if is_upper(span[0])
            && span[0] != 'İ'
            && !tail
                .iter()
                .any(|character| *character != 'İ' && is_upper(*character))
        {
            let mut out = String::from(SHIFT);
            out.push_str(&lower_char(span[0]));
            for character in tail {
                if *character == 'İ' {
                    out.push(*character);
                } else {
                    out.push_str(&lower_char(*character));
                }
            }
            return out;
        }
        return literal();
    }
    let unlowerable = span.iter().any(|character| {
        (is_new_cased(*character) || matches!(category_group(*character), 'L' | 'M'))
            && !is_lower(*character)
            && (!is_upper(*character) || lower_char(*character) == character.to_string())
    });
    if let Some(minimum) = allcaps_min {
        if span_is_upper(span) && span.len() >= minimum && !unlowerable {
            return format!("{CAPS}{}", lower(span).replace('ς', "σ"));
        }
    }
    let first = span[0];
    if lower_char(first) == first.to_string() {
        return literal();
    }
    if is_upper(first) && !span[1..].iter().any(|character| is_upper(*character)) {
        return format!("{SHIFT}{}", lower(span));
    }
    literal()
}

// ---- classes (`classify`, `is_hard_cp`) ---------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Class {
    Wordy,
    Hard,
    Digit,
    Punct,
    Space,
    StrayMark,
}

fn is_hard_cp(code: u32) -> bool {
    code >= 0x10000
        || (0x4E00..=0x9FFF).contains(&code)
        || (0x3400..=0x4DBF).contains(&code)
        || (0xF900..=0xFAFF).contains(&code)
        || (0xAC00..=0xD7A3).contains(&code)
        || matches!(
            code,
            0x3005 | 0x3006 | 0x3031 | 0x3032 | 0x3033 | 0x3034 | 0x3035 | 0x303B | 0x303C
        )
}

fn is_selector(character: char) -> bool {
    (VARIATION_SELECTORS.0..=VARIATION_SELECTORS.1).contains(&(character as u32))
}

fn classify(character: char) -> Class {
    if is_new_cased(character) {
        return Class::Wordy;
    }
    let code = character as u32;
    let category = category(character);
    if category.starts_with('Z') || matches!(character, '\t' | '\n' | '\r' | '\x0C' | '\x0B') {
        return Class::Space;
    }
    if SYMBOL_LETTERS
        .iter()
        .any(|(low, high)| (*low..=*high).contains(&code))
    {
        return Class::Wordy;
    }
    if category == "Nd"
        && (code < 0x80 || (0x0660..=0x0669).contains(&code) || (0x06F0..=0x06F9).contains(&code))
    {
        return Class::Digit;
    }
    if code < 0x80 && matches!(category_group(character), 'P' | 'S') {
        return Class::Punct;
    }
    if PUNCT_SYMS.contains(character) {
        return Class::Punct;
    }
    if is_selector(character) {
        return Class::Hard;
    }
    if is_mark(character) {
        return if code < 0x10000 && character.is_alphabetic() {
            Class::Wordy
        } else {
            Class::Hard
        };
    }
    if category_group(character) == 'L' && !is_hard_cp(code) {
        return Class::Wordy;
    }
    Class::Hard
}

// ---- marks, digits and punctuation ----------------------------------------------------------

/// A non-Alphabetic BMP mark (other than a variation selector) closes a word run.
fn is_separator(character: char) -> bool {
    (character as u32) < 0x10000
        && is_mark(character)
        && !is_selector(character)
        && !character.is_alphabetic()
}

fn syriac_vowel(character: char) -> bool {
    let code = character as u32;
    code == 0x0711 || (0x0730..=0x073F).contains(&code)
}

/// A combining mark with nothing before it that could be its base.
fn stray_mark(character: char) -> bool {
    if syriac_vowel(character) {
        return false;
    }
    canonical_combining_class(character) != 0 && !is_separator(character)
}

fn marks_like_punct(character: char) -> bool {
    let character = escaped_literal(character);
    let code = character as u32;
    if code >= 0x10000 {
        return false;
    }
    if is_separator(character) {
        return true;
    }
    let category = category(character);
    let ideographic_punct = (0x3001..=0x303F).contains(&code)
        && (category.starts_with('P') || IDEOGRAPHIC_SYMBOLS.contains(character));
    (matches!(category_group(character), 'P' | 'S') || matches!(category, "Cf" | "Cn"))
        && !ideographic_punct
}

fn hard_kind(character: char) -> u8 {
    if marks_like_punct(character) {
        0
    } else if digit_border(character) {
        1
    } else {
        2
    }
}

fn hard_bow(body: &[char]) -> bool {
    body.first()
        .is_some_and(|first| is_selector(*first) || marks_like_punct(*first))
}

fn hard_eow(body: &[char]) -> bool {
    body.last()
        .is_some_and(|last| is_selector(*last) || marks_like_punct(*last))
}

/// ASCII digits take no border marker of their own; other digits below U+10000 do.
fn digit_border(character: char) -> bool {
    let category = category(character);
    (category == "No" || (category == "Nd" && !character.is_ascii()))
        && (character as u32) < 0x10000
}

/// A uniform run of decimal digits (Nd) or other numbers (No).
fn digit_run(body: &[char]) -> bool {
    let Some(first) = body.first() else {
        return false;
    };
    let first_category = category(*first);
    matches!(first_category, "Nd" | "No")
        && body[1..]
            .iter()
            .all(|character| category(*character) == first_category)
}

fn digit_bow(body: &[char]) -> bool {
    digit_run(body) && digit_border(body[0])
}

fn digit_eow(body: &[char]) -> bool {
    digit_run(body) && digit_border(body[body.len() - 1])
}

type Run = (Class, Vec<char>);

/// A lone `'` that opens the word after it.
fn opens_word(runs: &[Run], at: usize) -> bool {
    runs[at].1 == ['\'']
        && runs
            .get(at + 1)
            .is_some_and(|(class, _)| matches!(class, Class::Wordy | Class::StrayMark))
}

fn takes_right_border(class: Class, body: &[char]) -> bool {
    class == Class::Punct
        || hard_eow(body)
        || (matches!(class, Class::Digit | Class::Hard) && digit_run(body) && digit_eow(body))
}

/// Whether a lone apostrophe immediately before wordy run `at` supplies that word's ⟨bow⟩.
fn contraction_seam(runs: &[Run], at: usize) -> bool {
    let suffix: String = runs[at].1.iter().collect();
    if !CONTRACTION_SUFFIXES.contains(&suffix.as_str()) || at == 0 {
        return false;
    }
    let (previous_class, previous_body) = &runs[at - 1];
    if *previous_class != Class::Punct || previous_body.as_slice() != ['\''] {
        return false;
    }
    at < 2 || !takes_right_border(runs[at - 2].0, &runs[at - 2].1)
}

// ---- runs (`_runs`) ------------------------------------------------------------------------

fn runs(norm: &[char]) -> Vec<Run> {
    let Some(first) = norm.first() else {
        return Vec::new();
    };
    let mut out: Vec<Run> = Vec::new();
    let mut current = vec![*first];
    let mut current_class = classify(*first);
    if current_class == Class::Wordy && stray_mark(*first) {
        current_class = Class::StrayMark;
    }
    for character in &norm[1..] {
        let class = classify(*character);
        // Consecutive unattached marks are one run, as are characters of the same class.
        let joins_stray_run =
            current_class == Class::StrayMark && class == Class::Wordy && stray_mark(*character);
        if joins_stray_run || class == current_class {
            current.push(*character);
        } else if class == Class::Wordy && stray_mark(*character) && current_class != Class::Wordy {
            out.push((current_class, std::mem::take(&mut current)));
            current.push(*character);
            current_class = Class::StrayMark;
        } else {
            out.push((current_class, std::mem::take(&mut current)));
            current.push(*character);
            current_class = class;
        }
    }
    out.push((current_class, current));
    // A HARD run is split where the character kind changes; a variation selector rides its base.
    let mut split = Vec::with_capacity(out.len());
    for (class, body) in out {
        if class != Class::Hard || body.len() == 1 {
            split.push((class, body));
            continue;
        }
        let mut current = vec![body[0]];
        let mut current_kind = hard_kind(body[0]);
        for character in &body[1..] {
            if is_selector(*character) || hard_kind(*character) == current_kind {
                current.push(*character);
            } else {
                split.push((class, std::mem::take(&mut current)));
                current.push(*character);
                current_kind = hard_kind(*character);
            }
        }
        split.push((class, current));
    }
    split
}

// ---- the marked stream (`stream_norm`) ------------------------------------------------------

fn seam() -> &'static regex::Regex {
    static SEAM: OnceLock<regex::Regex> = OnceLock::new();
    SEAM.get_or_init(|| {
        regex::Regex::new(&format!("(.){EOW} ([{SHIFT}{CAPS}]*){BOW}")).expect("seam pattern")
    })
}

/// The marked stream over already-normalised text. `raw_head_space` says whether the raw text
/// began with the space the frame absorbs.
pub(super) fn stream_norm(norm: &str, model: &Model, raw_head_space: bool) -> String {
    let escaped: String = norm.chars().map(escape_literal).collect();
    let mut norm: Vec<char> = escaped.trim_end_matches('\n').chars().collect();
    if model.frame_bow && raw_head_space && norm.first() == Some(&' ') && norm.get(1) != Some(&' ')
    {
        norm.remove(0);
    }
    let runs = runs(&norm);
    if runs.is_empty() {
        return if model.frame_bow {
            BOW.to_string()
        } else {
            String::new()
        };
    }
    let borders_space = |at: usize, side: isize| -> bool {
        let neighbour = at as isize + side;
        if neighbour < 0 {
            return model.frame_bow;
        }
        let Some((class, body)) = runs.get(neighbour as usize) else {
            return false;
        };
        if *class != Class::Space {
            return false;
        }
        if side < 0 {
            return body.last() == Some(&' ');
        }
        body.first() == Some(&' ') && body.get(1) != Some(&' ')
    };

    let (first_class, first_body) = &runs[0];
    let head_quote = opens_word(&runs, 0);
    let has_own_bow = !head_quote
        && (matches!(first_class, Class::Wordy | Class::Punct | Class::StrayMark)
            || hard_bow(first_body)
            || (matches!(first_class, Class::Digit | Class::Hard) && digit_bow(first_body))
            || (*first_class == Class::Space && first_body.first() == Some(&' ')));
    let mut out = String::new();
    if !has_own_bow && model.frame_bow {
        out.push(if head_quote { ' ' } else { BOW });
    }
    for (at, (class, body)) in runs.iter().enumerate() {
        match class {
            Class::Wordy => {
                let fused = at > 0 && runs[at - 1].0 == Class::StrayMark;
                let marked: Vec<char> = mark_case(body, model.allcaps_min, fused).chars().collect();
                let markers = marked
                    .iter()
                    .take_while(|character| matches!(**character, SHIFT | CAPS))
                    .count();
                out.extend(&marked[..markers]);
                if !(fused || contraction_seam(&runs, at)) {
                    out.push(BOW);
                }
                out.extend(&marked[markers..]);
                out.push(EOW);
            }
            Class::StrayMark => {
                let letter_follows = runs
                    .get(at + 1)
                    .is_some_and(|(class, _)| *class == Class::Wordy);
                out.push(BOW);
                out.extend(body);
                if !letter_follows {
                    out.push(EOW);
                }
            }
            _ if *class == Class::Punct || hard_bow(body) || hard_eow(body) => {
                let takes_bow = borders_space(at, -1)
                    && !opens_word(&runs, at)
                    && (*class == Class::Punct || hard_bow(body));
                if takes_bow {
                    out.push(BOW);
                }
                out.extend(body);
                if borders_space(at, 1) && (*class == Class::Punct || hard_eow(body)) {
                    out.push(EOW);
                }
            }
            Class::Digit | Class::Hard if digit_run(body) => {
                if digit_bow(body) && borders_space(at, -1) {
                    out.push(BOW);
                }
                out.extend(body);
                if digit_eow(body) && borders_space(at, 1) {
                    out.push(EOW);
                }
            }
            _ => out.extend(body),
        }
    }
    seam()
        .replace_all(&out, format!("${{1}}{EOW}${{2}}{BOW}").as_str())
        .into_owned()
}
