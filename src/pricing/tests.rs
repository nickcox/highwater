use super::*;
use crate::domain::{OutputReasoningRelationship, PlaceholderUsage, ReportedCost};

const TABLE: &str = r#"{
"schema":1,
"modelsDev":{"source":"https://github.com/sst/models.dev","commit":"abc","committedAt":"2026-10-10T00:00:00Z"},
"amendmentsImportedFrom":{"source":"https://github.com/wakamex/model-prices","commit":"def"},
"billingModes":[
 {"provider":"openai-codex","harness":"pi","priceProvider":"openai","billing":"subscription","source":"s"},
 {"provider":"github-copilot","billing":"subscription","validUntil":"2026-06-01T00:00:00Z","source":"s"},
 {"provider":"github-copilot","billing":"perToken","validFrom":"2026-06-01T00:00:00Z","source":"s"}
],
"providers":{
 "openai":{
  "gpt-x":{"prices":[
   {"start":null,"rates":{"input":5.0,"output":30.0,"cacheRead":0.5,"tiers":[{"above":272000,"input":10.0,"output":45.0,"cacheRead":1.0}]},"commit":"c1"},
   {"start":"2026-08-21T00:00:00Z","rates":{"input":4.0,"output":20.0,"cacheRead":0.4},"basis":"documented","source":"https://example.com/cut"}
  ]}
 },
 "github-copilot":{
  "gpt-x":{"labEquivalent":"openai/gpt-x","prices":[
   {"start":null,"rates":{"input":0.0,"output":0.0},"commit":"c2"},
   {"start":"2026-06-01T21:10:45Z","rates":{"input":5.0,"output":30.0,"cacheRead":0.5},"commit":"c3"}
  ]}
 },
 "opencode":{
  "free-model":{"prices":[{"start":null,"rates":{"input":0.0,"output":0.0,"cacheRead":0.0,"cacheWrite":0.0},"commit":"c4"}]}
 },
 "anthropic":{
  "claude":{"prices":[{"start":null,"rates":{"input":3.0,"output":15.0,"cacheRead":0.3,"cacheWrite":3.75},"basis":"firstObserved","source":"https://example.com/page"}]}
 }
}
}"#;

fn table() -> PriceTable {
    PriceTable::parse(TABLE).expect("test table")
}

fn ms(time: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(time)
        .expect("time")
        .timestamp_millis()
}

fn usage(input: u64, cache_read: u64, output: u64, recorded_cost: Option<f64>) -> ReportedUsage {
    ReportedUsage {
        input: Some(input),
        output: Some(output),
        recorded_output: Some(output),
        output_reasoning_relationship: OutputReasoningRelationship::IncludesReasoning,
        cache_read: Some(cache_read),
        cache_write: Some(0),
        cost: ReportedCost {
            total: recorded_cost,
            ..ReportedCost::default()
        },
        ..ReportedUsage::default()
    }
}

fn call<'a>(
    harness: &'a str,
    provider: &'a str,
    model: &'a str,
    at: &str,
    usage: &'a ReportedUsage,
) -> CallToPrice<'a> {
    CallToPrice {
        harness,
        provider: Some(provider),
        model: Some(model),
        at_ms: Some(ms(at)),
        usage,
    }
}

fn close(actual: Option<f64>, expected: f64) {
    let actual = actual.expect("amount");
    assert!((actual - expected).abs() < 1e-12, "{actual} != {expected}");
}

#[test]
fn embedded_table_parses_and_prices_known_models() {
    let table = embedded();
    let sol = table
        .period_at("openai", "gpt-5.6-sol", ms("2026-08-22T00:00:00Z"))
        .expect("gpt-5.6-sol");
    assert_eq!(sol.rates.as_ref().map(|rates| rates.input), Some(4.0));
    assert_eq!(sol.basis, StartBasis::Documented);
    let before_june = table
        .period_at(
            "github-copilot",
            "claude-sonnet-4.6",
            ms("2026-05-01T00:00:00Z"),
        )
        .expect("copilot");
    assert!(before_june.rates.as_ref().is_some_and(Rates::is_free));
    assert!(table
        .billing_mode("pi", "openai-codex", ms("2026-10-01T00:00:00Z"))
        .is_some_and(|mode| mode.billing == Billing::Subscription));
    assert!(!table.data.models_dev_commit.is_empty());
    assert!(!table.data.models_dev_committed_at.is_empty());
    assert!(table.data.amendments_imported_from.is_some());
}

#[test]
fn periods_start_at_their_time_and_the_first_covers_earlier_calls() {
    let table = table();
    let input_at = |time: &str| {
        table
            .period_at("openai", "gpt-x", ms(time))
            .and_then(|period| period.rates.as_ref())
            .map(|rates| rates.input)
    };
    assert_eq!(input_at("2020-01-01T00:00:00Z"), Some(5.0));
    assert_eq!(input_at("2026-08-20T23:59:59Z"), Some(5.0));
    assert_eq!(input_at("2026-08-21T00:00:00Z"), Some(4.0));
    assert_eq!(input_at("2027-01-01T00:00:00Z"), Some(4.0));
    assert!(table.period_at("openai", "missing", 0).is_none());
}

#[test]
fn cost_charges_each_bucket_and_applies_tiers_above_their_size() {
    let rates = Rates {
        input: 2.0,
        output: 10.0,
        cache_read: Some(0.2),
        cache_write: Some(2.5),
        tiers: vec![table::TierRates {
            above: 1_000,
            input: Some(4.0),
            output: Some(15.0),
            cache_read: None,
            cache_write: None,
        }],
    };
    let tokens = TokenCounts {
        input: 400,
        cache_read: 500,
        cache_write: 100,
        cache_write_1h: 0,
        output_low: 50,
        output_high: 50,
    };
    // Exactly at the tier size: base rates.
    let amount = cost(&rates, tokens).expect("cost");
    let expected = (400.0 * 2.0 + 500.0 * 0.2 + 100.0 * 2.5 + 50.0 * 10.0) / 1e6;
    assert!((amount.low - expected).abs() < 1e-15);
    // One token over: the tier's rates, with the base cache rates where the tier has none.
    let amount = cost(
        &rates,
        TokenCounts {
            input: 401,
            ..tokens
        },
    )
    .expect("cost");
    let expected = (401.0 * 4.0 + 500.0 * 0.2 + 100.0 * 2.5 + 50.0 * 15.0) / 1e6;
    assert!((amount.low - expected).abs() < 1e-15);
}

#[test]
fn cost_falls_back_to_input_rate_and_doubles_it_for_one_hour_writes() {
    let rates = Rates {
        input: 3.0,
        output: 15.0,
        cache_read: None,
        cache_write: Some(3.75),
        tiers: vec![],
    };
    let tokens = TokenCounts {
        input: 0,
        cache_read: 1_000,
        cache_write: 300,
        cache_write_1h: 100,
        output_low: 0,
        output_high: 0,
    };
    let amount = cost(&rates, tokens).expect("cost");
    let expected = (1_000.0 * 3.0 + 200.0 * 3.75 + 100.0 * 6.0) / 1e6;
    assert!((amount.low - expected).abs() < 1e-15);
    assert!(cost(
        &rates,
        TokenCounts {
            cache_write_1h: 301,
            ..tokens
        }
    )
    .is_none());
    assert!(cost(
        &rates,
        TokenCounts {
            input: u64::MAX,
            cache_read: 1,
            ..tokens
        }
    )
    .is_none());
}

#[test]
fn per_token_call_with_a_recorded_cost_keeps_it() {
    let usage = usage(1_000, 0, 100, Some(0.25));
    let assessed = assess(
        &table(),
        call(
            "opencode",
            "anthropic",
            "claude",
            "2026-09-01T00:00:00Z",
            &usage,
        ),
    );
    assert_eq!(assessed.kind, CostKind::Recorded);
    assert_eq!(assessed.amount, Some(0.25));
    assert_eq!(assessed.rule, CostRule::RecordedCost);
    assert!(assessed.rate.is_none());
}

#[test]
fn per_token_call_without_a_cost_is_estimated_at_the_providers_rate() {
    let usage = usage(1_000_000, 0, 0, None);
    let assessed = assess(
        &table(),
        call(
            "opencode",
            "anthropic",
            "claude",
            "2026-09-01T00:00:00Z",
            &usage,
        ),
    );
    assert_eq!(assessed.kind, CostKind::Estimated);
    close(assessed.amount, 3.0);
    let rate = assessed.rate.expect("rate");
    assert_eq!(
        (rate.provider.as_str(), rate.lab_equivalent),
        ("anthropic", false)
    );
    assert_eq!(
        (rate.basis, rate.source.as_str()),
        (StartBasis::FirstObserved, "https://example.com/page")
    );
}

#[test]
fn zero_on_a_free_listing_is_free() {
    let usage = usage(5_000, 0, 100, Some(0.0));
    let assessed = assess(
        &table(),
        call(
            "opencode",
            "opencode",
            "free-model",
            "2026-09-01T00:00:00Z",
            &usage,
        ),
    );
    assert_eq!(
        (assessed.kind, assessed.amount),
        (CostKind::Free, Some(0.0))
    );
}

#[test]
fn pi_codex_calls_get_an_api_equivalent_cost_with_pis_figure_kept() {
    let usage = usage(1_000_000, 0, 0, Some(4.9));
    let assessed = assess(
        &table(),
        call(
            "pi",
            "openai-codex",
            "gpt-x",
            "2026-09-01T00:00:00Z",
            &usage,
        ),
    );
    assert_eq!(assessed.kind, CostKind::ApiEquivalent);
    close(assessed.amount, 4.0);
    assert_eq!(assessed.recorded_by_harness, Some(4.9));
    assert_eq!(
        (assessed.billing, assessed.rule),
        (Some(Billing::Subscription), CostRule::BillingModeTable)
    );
    let rate = assessed.rate.expect("rate");
    assert_eq!(
        (
            rate.provider.as_str(),
            rate.model.as_str(),
            rate.lab_equivalent
        ),
        ("openai", "gpt-x", true)
    );
    assert_eq!(rate.basis, StartBasis::Documented);
    // The billing-mode entry is for Pi only: elsewhere a recorded cost is a billed cost.
    let other = assess(
        &table(),
        call(
            "opencode",
            "openai-codex",
            "gpt-x",
            "2026-09-01T00:00:00Z",
            &usage,
        ),
    );
    assert_eq!((other.kind, other.amount), (CostKind::Recorded, Some(4.9)));
}

#[test]
fn copilot_billing_changes_on_the_first_of_june() {
    // Below the lab rate's 272,000-token tier.
    let usage = usage(100_000, 0, 0, Some(0.0));
    let before = assess(
        &table(),
        call(
            "opencode",
            "github-copilot",
            "gpt-x",
            "2026-05-31T23:59:59Z",
            &usage,
        ),
    );
    assert_eq!(before.kind, CostKind::ApiEquivalent);
    close(before.amount, 0.5);
    assert_eq!(
        before.rate.as_ref().map(|rate| rate.provider.as_str()),
        Some("openai")
    );
    // Per token from 1 June, but models.dev listed the new price only from 21:10 UTC.
    let early = assess(
        &table(),
        call(
            "opencode",
            "github-copilot",
            "gpt-x",
            "2026-06-01T10:00:00Z",
            &usage,
        ),
    );
    assert_eq!(early.kind, CostKind::Free);
    let later = assess(
        &table(),
        call(
            "opencode",
            "github-copilot",
            "gpt-x",
            "2026-06-02T00:00:00Z",
            &usage,
        ),
    );
    assert_eq!(later.kind, CostKind::Estimated);
    close(later.amount, 0.5);
    let recorded = usage_with_cost(0.3);
    let billed = assess(
        &table(),
        call(
            "pi",
            "github-copilot",
            "gpt-x",
            "2026-06-02T00:00:00Z",
            &recorded,
        ),
    );
    assert_eq!(
        (billed.kind, billed.amount),
        (CostKind::Recorded, Some(0.3))
    );
}

fn usage_with_cost(value: f64) -> ReportedUsage {
    usage(1_000, 0, 10, Some(value))
}

#[test]
fn opencode_openai_zero_with_a_listed_price_is_a_subscription() {
    let zero = usage(1_000_000, 0, 0, Some(0.0));
    let assessed = assess(
        &table(),
        call("opencode", "openai", "gpt-x", "2026-09-01T00:00:00Z", &zero),
    );
    assert_eq!(assessed.kind, CostKind::ApiEquivalent);
    assert_eq!(assessed.rule, CostRule::OpencodeZeroWithListedPrice);
    close(assessed.amount, 4.0);
    // A missing cost is not that evidence: it is estimated as billed per token.
    let missing = usage(1_000_000, 0, 0, None);
    let assessed = assess(
        &table(),
        call(
            "opencode",
            "openai",
            "gpt-x",
            "2026-09-01T00:00:00Z",
            &missing,
        ),
    );
    assert_eq!(
        (assessed.kind, assessed.rule),
        (CostKind::Estimated, CostRule::PerTokenDefault)
    );
    // Pi is never given this rule.
    let assessed = assess(
        &table(),
        call("pi", "openai", "gpt-x", "2026-09-01T00:00:00Z", &zero),
    );
    assert_eq!(assessed.kind, CostKind::Estimated);
}

#[test]
fn unknown_reasoning_overlap_gives_a_range() {
    let mut usage = usage(0, 0, 0, Some(0.0));
    usage.output = None;
    usage.output_reasoning_relationship = OutputReasoningRelationship::Unknown;
    usage.recorded_output = Some(1_000_000);
    usage.reasoning = Some(500_000);
    let assessed = assess(
        &table(),
        call(
            "opencode",
            "openai",
            "gpt-x",
            "2026-09-01T00:00:00Z",
            &usage,
        ),
    );
    close(assessed.amount, 20.0);
    close(assessed.amount_high, 30.0);
    // Without a reasoning counter, the output cannot be bounded.
    usage.reasoning = None;
    let assessed = assess(
        &table(),
        call(
            "opencode",
            "openai",
            "gpt-x",
            "2026-09-01T00:00:00Z",
            &usage,
        ),
    );
    assert_eq!(
        (assessed.kind, assessed.rule),
        (CostKind::Unknown, CostRule::MissingUsage)
    );
}

#[test]
fn a_tiny_range_is_shown_as_one_amount() {
    let mut usage = usage(1_000_000, 0, 0, Some(0.0));
    usage.output = None;
    usage.recorded_output = Some(1_000);
    usage.reasoning = Some(10);
    let assessed = assess(
        &table(),
        call(
            "opencode",
            "openai",
            "gpt-x",
            "2026-09-01T00:00:00Z",
            &usage,
        ),
    );
    assert!(assessed.amount.is_some());
    assert_eq!(assessed.amount_high, None);
}

#[test]
fn calls_that_cannot_be_priced_are_unknown_with_a_reason() {
    let table = table();
    let measured = usage(1_000, 0, 10, None);
    let mut failed = usage(0, 0, 0, Some(0.0));
    failed.placeholder = Some(PlaceholderUsage {
        cache_write_1h: None,
        reasoning: None,
        cost: ReportedCost::default(),
    });
    let mut no_input = usage(0, 0, 10, None);
    no_input.input = None;
    let cases = [
        (
            call("pi", "openai", "gpt-x", "2026-09-01T00:00:00Z", &failed),
            CostRule::FailedAttempt,
        ),
        (
            CallToPrice {
                at_ms: None,
                ..call("pi", "openai", "gpt-x", "2026-09-01T00:00:00Z", &measured)
            },
            CostRule::MissingTime,
        ),
        (
            CallToPrice {
                model: None,
                ..call("pi", "openai", "gpt-x", "2026-09-01T00:00:00Z", &measured)
            },
            CostRule::NoPrice,
        ),
        (
            call(
                "pi",
                "openai",
                "unlisted",
                "2026-09-01T00:00:00Z",
                &measured,
            ),
            CostRule::NoPrice,
        ),
        (
            call("pi", "openai", "gpt-x", "2026-09-01T00:00:00Z", &no_input),
            CostRule::MissingUsage,
        ),
    ];
    for (call, rule) in cases {
        let assessed = assess(&table, call);
        assert_eq!(
            (assessed.kind, assessed.rule),
            (CostKind::Unknown, rule),
            "{call:?}"
        );
        assert!(assessed.amount.is_none());
    }
}

#[test]
fn invalid_tables_are_rejected() {
    assert!(PriceTable::parse("{}").is_err());
    assert!(PriceTable::parse(&TABLE.replace("\"schema\":1", "\"schema\":2")).is_err());
    assert!(PriceTable::parse(&TABLE.replace("2026-08-21T00:00:00Z", "not a time")).is_err());
    assert!(
        PriceTable::parse(&TABLE.replace("\"basis\":\"documented\"", "\"basis\":\"guessed\""))
            .is_err()
    );
}
