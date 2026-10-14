use crate::{
    api::CallTiming,
    domain::{NormalizedModelCall, MAX_SAFE_JSON_INTEGER},
};

fn valid_instant(value: Option<i64>) -> Option<i64> {
    value.filter(|ms| {
        ms.unsigned_abs() <= MAX_SAFE_JSON_INTEGER
            && chrono::DateTime::from_timestamp_millis(*ms).is_some()
    })
}

/// Pi's checked built-in adapters initialize message.timestamp before requesting
/// a response. Unknown/custom APIs retain their instants but have no inferred rate.
/// VS Code Copilot's start instant comes only from a call's trace span, which runs from
/// sending the request to the end of the response.
pub(super) fn call_timing(call: &NormalizedModelCall, harness: &str) -> CallTiming {
    let mut timing = CallTiming {
        started_at_ms: valid_instant(call.timestamps.started_at_ms),
        recorded_at_ms: valid_instant(call.timestamps.recorded_at_ms),
        ..CallTiming::default()
    };
    if harness == "vscode-copilot" {
        if let Some(ms) = duration(&timing) {
            timing.duration_ms = Some(ms);
            timing.basis = Some("vscode-copilot-trace-spans");
            timing.effective_output_tokens_per_second = rate(call, ms);
        }
        return timing;
    }
    if harness != "pi"
        || !matches!(
            call.target.api.as_deref(),
            Some(
                "openai-codex-responses"
                    | "openai-responses"
                    | "openai-completions"
                    | "anthropic-messages"
                    | "google-generative-ai"
                    | "google-vertex"
                    | "azure-openai-responses"
                    | "bedrock-converse-stream"
                    | "pi-messages"
            )
        )
    {
        return timing;
    }
    if !matches!(
        call.stop_reason.as_deref(),
        Some("stop" | "toolUse" | "length" | "error" | "aborted")
    ) {
        return timing;
    }
    if let Some(ms) = duration(&timing) {
        timing.duration_ms = Some(ms);
        timing.basis = Some("pi-message-timestamps");
        if matches!(
            call.stop_reason.as_deref(),
            Some("stop" | "toolUse" | "length")
        ) {
            timing.effective_output_tokens_per_second = rate(call, ms);
        }
    }
    timing
}

fn duration(timing: &CallTiming) -> Option<u64> {
    timing
        .started_at_ms
        .zip(timing.recorded_at_ms)
        .and_then(|(start, end)| end.checked_sub(start))
        .and_then(|ms| u64::try_from(ms).ok())
        .filter(|ms| *ms > 0 && *ms <= MAX_SAFE_JSON_INTEGER)
}

/// Reported output, including reasoning, per second of the call.
fn rate(call: &NormalizedModelCall, ms: u64) -> Option<f64> {
    call.reported_usage
        .output
        .filter(|tokens| *tokens <= MAX_SAFE_JSON_INTEGER)
        .map(|tokens| tokens as f64 * 1000.0 / ms as f64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{analysis::test_support::fake_session, domain::CallTimestamps};

    fn call_timing(call: &NormalizedModelCall) -> CallTiming {
        super::call_timing(call, "pi")
    }

    #[test]
    fn copilot_trace_spans_give_a_duration_and_rate() {
        let mut call = call();
        call.stop_reason = None;
        let timing = super::call_timing(&call, "vscode-copilot");
        assert_eq!(timing.duration_ms, Some(2000));
        assert_eq!(timing.effective_output_tokens_per_second, Some(50.0));
        assert_eq!(timing.basis, Some("vscode-copilot-trace-spans"));
        // Without a trace span there is no start instant.
        call.timestamps.started_at_ms = None;
        let timing = super::call_timing(&call, "vscode-copilot");
        assert_eq!(timing.duration_ms, None);
        assert_eq!(timing.basis, None);
    }

    #[test]
    fn other_sources_keep_instants_without_claiming_pi_timing_semantics() {
        let call = call();
        let timing = super::call_timing(&call, "opencode");
        assert_eq!(timing.started_at_ms, call.timestamps.started_at_ms);
        assert_eq!(timing.duration_ms, None);
        assert_eq!(timing.basis, None);
    }

    fn call() -> NormalizedModelCall {
        let mut call = fake_session().model_calls.remove(0);
        call.target.api = Some("openai-codex-responses".into());
        call.stop_reason = Some("toolUse".into());
        call.timestamps = CallTimestamps {
            started_at_ms: Some(1_700_000_000_000),
            recorded_at_ms: Some(1_700_000_002_000),
        };
        call.reported_usage.output = Some(100);
        call.reported_usage.reasoning = Some(80);
        call
    }

    #[test]
    fn uses_same_response_instants_and_reported_output_including_reasoning_only_once() {
        let call = call();
        let timing = call_timing(&call);
        assert_eq!(timing.started_at_ms, call.timestamps.started_at_ms);
        assert_eq!(timing.recorded_at_ms, call.timestamps.recorded_at_ms);
        assert_eq!(timing.duration_ms, Some(2000));
        assert_eq!(timing.effective_output_tokens_per_second, Some(50.0));
        assert_eq!(timing.basis, Some("pi-message-timestamps"));
    }

    #[test]
    fn absent_zero_negative_and_unsafe_intervals_are_unavailable() {
        for timestamps in [
            CallTimestamps::default(),
            CallTimestamps {
                started_at_ms: Some(10),
                recorded_at_ms: None,
            },
            CallTimestamps {
                started_at_ms: Some(10),
                recorded_at_ms: Some(10),
            },
            CallTimestamps {
                started_at_ms: Some(10),
                recorded_at_ms: Some(9),
            },
            CallTimestamps {
                started_at_ms: Some(i64::MIN),
                recorded_at_ms: Some(i64::MAX),
            },
        ] {
            let mut call = call();
            call.timestamps = timestamps;
            let timing = call_timing(&call);
            assert_eq!(timing.duration_ms, None);
            assert_eq!(timing.effective_output_tokens_per_second, None);
            assert_eq!(timing.basis, None);
        }
    }

    #[test]
    fn unknown_api_keeps_wall_clock_instants_without_inventing_duration() {
        let mut call = call();
        call.target.api = Some("custom-api".into());
        let timing = call_timing(&call);
        assert_eq!(timing.started_at_ms, call.timestamps.started_at_ms);
        assert_eq!(timing.recorded_at_ms, call.timestamps.recorded_at_ms);
        assert_eq!(timing.duration_ms, None);
    }

    #[test]
    fn zero_output_is_real_but_missing_failed_aborted_and_pending_rates_are_unavailable() {
        let mut call = call();
        call.reported_usage.output = Some(0);
        assert_eq!(
            call_timing(&call).effective_output_tokens_per_second,
            Some(0.0)
        );
        call.reported_usage.output = None;
        assert_eq!(call_timing(&call).duration_ms, Some(2000));
        assert_eq!(call_timing(&call).effective_output_tokens_per_second, None);
        call.reported_usage.output = Some(100);
        for reason in ["error", "aborted"] {
            call.stop_reason = Some(reason.into());
            assert_eq!(call_timing(&call).duration_ms, Some(2000));
            assert_eq!(call_timing(&call).effective_output_tokens_per_second, None);
        }
        call.stop_reason = Some("pending".into());
        assert_eq!(call_timing(&call).duration_ms, None);
    }
}
