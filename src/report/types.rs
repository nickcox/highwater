//! The report's JSON shape. See docs/report.md.

use serde::{Serialize, Serializer};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Report {
    pub schema_version: u32,
    pub highwater_version: &'static str,
    /// The models.dev commit the embedded prices come from.
    pub price_data_commit: Option<String>,
    pub scope: Scope,
    pub thresholds: Thresholds,
    pub sessions: Vec<SessionReport>,
    /// Shell commands by family, over all the sessions.
    pub command_families: Vec<FamilyTotal>,
    /// Patterns that repeat in several sessions.
    pub across_sessions: Vec<Finding>,
    /// Sessions that could not be read or analysed.
    pub skipped: Vec<Skipped>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Scope {
    /// "directory", "all" or "sessions" (named on the command line).
    pub kind: &'static str,
    pub directory: Option<String>,
    /// The git folder shared by the directory's repository and its worktrees.
    pub repository: Option<String>,
    pub last: Option<usize>,
    pub since: Option<String>,
    pub harness: Option<String>,
}

impl Scope {
    pub(crate) fn sessions() -> Self {
        Self {
            kind: "sessions",
            directory: None,
            repository: None,
            last: None,
            since: None,
            harness: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Thresholds {
    /// A tool result at least this large, in tokens, is large.
    pub large_result_tokens: u64,
    /// An item in context for at least this many calls is long-lived.
    pub long_lived_calls: usize,
    /// A command is repeated when it runs at least this many times in a session...
    pub repeated_runs: usize,
    /// ...or in at least this many sessions.
    pub repeated_sessions: usize,
    /// Carried context is a finding when it is at least this part of the session's input.
    pub carried_share: f64,
    /// Re-runs after a compaction are a finding when there are at least this many.
    pub reruns_after_compaction: usize,
}

impl Default for Thresholds {
    fn default() -> Self {
        Self {
            large_result_tokens: 5_000,
            long_lived_calls: 10,
            repeated_runs: 3,
            repeated_sessions: 3,
            carried_share: 0.25,
            reruns_after_compaction: 2,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Skipped {
    #[serde(rename = "ref")]
    pub reference: String,
    pub reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionReport {
    #[serde(rename = "ref")]
    pub reference: String,
    pub harness: String,
    pub title: String,
    pub working_directory: Option<String>,
    /// The parent session's reference, for a child session.
    pub parent: Option<String>,
    pub started_at: Option<String>,
    pub updated_at: Option<String>,
    pub models: Vec<String>,
    pub calls: usize,
    pub tokens: TokenTotals,
    pub cost: SessionCost,
    pub reconstruction: Reconstruction,
    pub peak_context_tokens: Option<u64>,
    /// Reported input per call, on average.
    pub average_context_tokens: Option<u64>,
    pub compactions: usize,
    /// User messages: each starts a turn.
    pub user_turns: usize,
    pub carried_context: CarriedContext,
    pub context_by_kind: Vec<KindTotal>,
    pub tools: Vec<ToolTotal>,
    /// Shell commands by family.
    pub command_families: Vec<FamilyTotal>,
    pub child_sessions: Vec<String>,
    pub findings: Vec<Finding>,
    /// Every tool run, for finding commands repeated across sessions. Not written out.
    #[serde(skip)]
    pub runs: Vec<ToolRun>,
}

impl SessionReport {
    pub(crate) fn drop_working_data(&mut self) {
        self.runs = Vec::new();
    }
}

/// Reported usage, summed over the session's calls.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TokenTotals {
    /// Input that was neither read from nor written to the cache.
    pub fresh_input: u64,
    pub cache_read: u64,
    pub cache_write: u64,
    /// Output, including reasoning.
    pub output: u64,
    pub reasoning: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionCost {
    /// Calls billed per token.
    pub billed: Option<UsdRange>,
    /// Calls covered by a subscription, at the lab's API rate. Not a charge.
    pub api_equivalent: Option<UsdRange>,
    pub unknown_calls: usize,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UsdRange {
    #[serde(serialize_with = "usd_value")]
    pub low: f64,
    #[serde(serialize_with = "usd_value")]
    pub high: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Reconstruction {
    /// How far the calculated context is from the reported input, as a median over calls.
    #[serde(serialize_with = "optional_fraction")]
    pub median_absolute_gap_percent: Option<f64>,
    /// Codes for what the session's reader could not reconstruct.
    pub limitation_codes: Vec<String>,
}

/// One kind of context item, totalled over the session.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KindTotal {
    pub kind: String,
    pub items: usize,
    pub token_turns: u64,
    /// This kind's part of the session's token-turns, from 0 to 1.
    #[serde(serialize_with = "fraction")]
    pub share: f64,
    #[serde(serialize_with = "usd")]
    pub estimated_cost: Option<f64>,
}

/// Input spent on the conversation's own items (messages, tool results and thinking) at
/// calls three or more user turns after they were added.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CarriedContext {
    pub older_than_turns: usize,
    pub token_turns: u64,
    #[serde(serialize_with = "usd")]
    pub estimated_cost: Option<f64>,
    /// The part of the session's input token-turns, from 0 to 1.
    #[serde(serialize_with = "fraction")]
    pub share: f64,
}

/// Shell commands that run the same program (and subcommand), such as `git status`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FamilyTotal {
    pub family: String,
    pub runs: usize,
    pub failed: usize,
    /// Sessions it ran in, for totals over all the sessions.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sessions: Option<usize>,
    pub result_tokens: u64,
    pub result_token_turns: u64,
    #[serde(serialize_with = "usd")]
    pub result_estimated_cost: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ToolTotal {
    pub name: String,
    /// Results recorded for the tool.
    pub calls: usize,
    pub failed: usize,
    pub result_tokens: TokenStats,
    pub result_token_turns: u64,
    #[serde(serialize_with = "usd")]
    pub result_estimated_cost: Option<f64>,
    /// The tool's recorded definition, when the harness records it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub definition_tokens: Option<u64>,
    #[serde(serialize_with = "usd", skip_serializing_if = "Option::is_none")]
    pub definition_estimated_cost: Option<f64>,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TokenStats {
    pub total: u64,
    pub max: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Finding {
    pub pattern: &'static str,
    /// "measured", "estimated" or "inferred".
    pub basis: &'static str,
    pub estimated_cost: FindingCost,
    pub summary: String,
    /// Up to three of the items the finding is about.
    pub items: Vec<ItemRef>,
    pub facts: BTreeMap<&'static str, Value>,
}

#[derive(Debug, Clone, Copy, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FindingCost {
    /// US dollars at the call's rates: billed, or API-equivalent for a subscription.
    #[serde(serialize_with = "usd")]
    pub usd: Option<f64>,
    /// Tokens multiplied by the number of calls they were sent with.
    pub token_turns: u64,
}

impl FindingCost {
    pub(crate) fn add(&mut self, other: FindingCost) {
        self.token_turns += other.token_turns;
        self.usd = match (self.usd, other.usd) {
            (None, None) => None,
            (a, b) => Some(a.unwrap_or(0.0) + b.unwrap_or(0.0)),
        };
    }

    /// For ranking: dollars when known, otherwise token-turns at a nominal rate.
    pub(crate) fn rank(&self) -> f64 {
        self.usd.unwrap_or(self.token_turns as f64 / 1_000_000.0)
    }
}

/// An item a finding is about, for `highwater show`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ItemRef {
    /// The session, for findings across sessions.
    #[serde(rename = "ref", skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
    pub item_id: String,
}

/// One tool result with the call that produced it.
#[derive(Debug, Clone)]
pub(crate) struct ToolRun {
    pub tool: String,
    /// For a shell tool, the program and subcommand it ran.
    pub family: Option<String>,
    /// The call the result was first sent with.
    pub first_call: usize,
    /// The command for a shell tool, otherwise the arguments as canonical JSON.
    pub command: String,
    pub failed: bool,
    pub result_hash: Option<blake3::Hash>,
    pub cost: FindingCost,
    pub reference: String,
    pub item_id: String,
    pub tokens: Option<u64>,
}

impl ToolRun {
    pub(crate) fn item(&self, with_session: bool) -> ItemRef {
        ItemRef {
            reference: with_session.then(|| self.reference.clone()),
            item_id: self.item_id.clone(),
        }
    }
}

/// Dollars to four decimal places.
fn usd<S: Serializer>(value: &Option<f64>, serializer: S) -> Result<S::Ok, S::Error> {
    value
        .map(|value| (value * 10_000.0).round() / 10_000.0)
        .serialize(serializer)
}

fn usd_value<S: Serializer>(value: &f64, serializer: S) -> Result<S::Ok, S::Error> {
    usd(&Some(*value), serializer)
}

/// A fraction or percentage to three decimal places.
fn fraction<S: Serializer>(value: &f64, serializer: S) -> Result<S::Ok, S::Error> {
    ((value * 1_000.0).round() / 1_000.0).serialize(serializer)
}

fn optional_fraction<S: Serializer>(value: &Option<f64>, serializer: S) -> Result<S::Ok, S::Error> {
    value
        .map(|value| (value * 1_000.0).round() / 1_000.0)
        .serialize(serializer)
}
