use super::{
    heuristic, payload_fingerprint, project_payload, PayloadFingerprint, ProfileKey,
    TokenizationMethod, TokenizationProfile, TokenizerFamily,
};
use crate::analysis::diagnostics::DiagnosticCode;
use crate::domain::{ModelTarget, NormalizedContextItem, MAX_SAFE_JSON_INTEGER};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(crate) struct TokenizationStats {
    pub payloads_fingerprinted: u64,
    pub estimate_lookups: u64,
    pub unique_estimates: u64,
    pub estimate_cache_hits: u64,
    pub tokenizer_invocations: u64,
    pub unique_payloads: u64,
}

#[derive(Debug, Clone, Copy, Eq, Hash, PartialEq)]
pub(crate) struct ProfileIndex(usize);

#[derive(Debug, Clone, Copy, Eq, Hash, PartialEq)]
pub(crate) struct EstimateIndex(usize);
use tiktoken::get_encoding;

#[derive(Debug, Clone)]
pub(crate) struct TokenEstimate {
    pub profile_id: String,
    pub tokens: Option<u64>,
    pub method: TokenizationMethod,
    pub coverage: TokenCoverage,
    pub note_codes: Vec<DiagnosticCode>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TokenCoverage {
    Complete,
    Partial,
    Unavailable,
}

impl TokenCoverage {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Complete => "complete",
            Self::Partial => "partial",
            Self::Unavailable => "unavailable",
        }
    }
}

#[derive(Debug, Default)]
pub(crate) struct ProfileRegistry {
    profile_values: Vec<TokenizationProfile>,
    profile_indexes: HashMap<ProfileKey, ProfileIndex>,
    estimates: HashMap<(ProfileIndex, PayloadFingerprint), EstimateIndex>,
    estimate_values: Vec<TokenEstimate>,
    stats: TokenizationStats,
    fingerprints: HashSet<PayloadFingerprint>,
}

impl ProfileRegistry {
    #[cfg(test)]
    pub(crate) fn profile(
        &mut self,
        target: &ModelTarget,
        policy: super::TokenizationPolicy,
    ) -> TokenizationProfile {
        let index = self.profile_index(target, policy);
        self.profile_at(index).clone()
    }

    pub(crate) fn profile_index(
        &mut self,
        target: &ModelTarget,
        policy: super::TokenizationPolicy,
    ) -> ProfileIndex {
        let profile = super::profile::resolve_profile(target, policy);
        self.intern_profile(profile)
    }

    fn intern_profile(&mut self, profile: TokenizationProfile) -> ProfileIndex {
        if let Some(index) = self.profile_indexes.get(profile.key()).copied() {
            return index;
        }
        let index = ProfileIndex(self.profile_values.len());
        self.profile_indexes.insert(profile.key().clone(), index);
        self.profile_values.push(profile);
        index
    }

    #[cfg(test)]
    pub(crate) fn profile_index_for(&self, profile: &TokenizationProfile) -> ProfileIndex {
        self.profile_indexes
            .get(profile.key())
            .copied()
            .expect("profile must be interned before estimating")
    }

    pub(crate) fn fingerprint_item(&mut self, item: &NormalizedContextItem) -> PayloadFingerprint {
        self.stats.payloads_fingerprinted = self.stats.payloads_fingerprinted.saturating_add(1);
        let fingerprint = payload_fingerprint(&item.payload);
        if self.fingerprints.insert(fingerprint) {
            self.stats.unique_payloads = self.stats.unique_payloads.saturating_add(1);
        }
        fingerprint
    }

    #[cfg(test)]
    pub(crate) fn estimate(
        &mut self,
        item: &NormalizedContextItem,
        profile: &TokenizationProfile,
        _target: &ModelTarget,
    ) -> TokenEstimate {
        let fingerprint = payload_fingerprint(&item.payload);
        self.stats.payloads_fingerprinted = self.stats.payloads_fingerprinted.saturating_add(1);
        let profile_index = self.profile_index_for(profile);
        let index = self.estimate_index_at_profile(item, fingerprint, profile_index);
        self.estimate_at(index).clone()
    }

    pub(crate) fn profile_at(&self, index: ProfileIndex) -> &TokenizationProfile {
        self.profile_values
            .get(index.0)
            .expect("profile index must be valid")
    }

    #[cfg(test)]
    pub(crate) fn estimate_fingerprinted(
        &mut self,
        item: &NormalizedContextItem,
        fingerprint: PayloadFingerprint,
        profile: &TokenizationProfile,
        _target: &ModelTarget,
    ) -> TokenEstimate {
        let profile_index = self.profile_index_for(profile);
        let index = self.estimate_index_at_profile(item, fingerprint, profile_index);
        self.estimate_at(index).clone()
    }

    pub(crate) fn estimate_index_at_profile(
        &mut self,
        item: &NormalizedContextItem,
        fingerprint: PayloadFingerprint,
        profile_index: ProfileIndex,
    ) -> EstimateIndex {
        self.stats.estimate_lookups = self.stats.estimate_lookups.saturating_add(1);
        let key = (profile_index, fingerprint);
        if let Some(index) = self.estimates.get(&key).copied() {
            self.stats.estimate_cache_hits = self.stats.estimate_cache_hits.saturating_add(1);
            return index;
        }
        let profile = self
            .profile_values
            .get(profile_index.0)
            .expect("profile index must be valid");
        let estimate = calculate(&item.payload, profile, &mut self.stats);
        let index = EstimateIndex(self.estimate_values.len());
        self.estimate_values.push(estimate);
        self.estimates.insert(key, index);
        self.stats.unique_estimates = self.stats.unique_estimates.saturating_add(1);
        index
    }

    /// Controlled estimates for analysis boundary regressions, without huge payloads.
    #[cfg(test)]
    pub(crate) fn estimate_at_mut(&mut self, index: EstimateIndex) -> &mut TokenEstimate {
        self.estimate_values
            .get_mut(index.0)
            .expect("estimate index must be valid")
    }

    pub(crate) fn estimate_at(&self, index: EstimateIndex) -> &TokenEstimate {
        self.estimate_values
            .get(index.0)
            .expect("estimate index must be valid")
    }

    pub(crate) fn stats(&self) -> TokenizationStats {
        self.stats
    }

    pub(crate) fn profiles(&self) -> impl Iterator<Item = &TokenizationProfile> {
        let mut profiles = self.profile_values.iter().collect::<Vec<_>>();
        profiles.sort_by(|left, right| left.id.cmp(&right.id));
        profiles.into_iter()
    }
}

fn calculate(
    payload: &crate::domain::TokenizationPayload,
    profile: &TokenizationProfile,
    stats: &mut TokenizationStats,
) -> TokenEstimate {
    if profile.family == TokenizerFamily::Unavailable {
        return TokenEstimate {
            profile_id: profile.id.clone(),
            tokens: None,
            method: TokenizationMethod::Unavailable,
            coverage: TokenCoverage::Unavailable,
            note_codes: vec![DiagnosticCode::UnsupportedTokenizer],
        };
    }
    let projected = project_payload(payload, profile.projection_target());
    if projected.unavailable {
        return TokenEstimate {
            profile_id: profile.id.clone(),
            tokens: None,
            method: TokenizationMethod::Unavailable,
            coverage: TokenCoverage::Unavailable,
            note_codes: projected.note_codes,
        };
    }
    if profile.family != TokenizerFamily::Unavailable {
        stats.tokenizer_invocations = stats.tokenizer_invocations.saturating_add(1);
    }
    let (tokens, count_note) = match profile.family {
        TokenizerFamily::O200k => (
            get_encoding("o200k_base")
                .and_then(|encoding| u64::try_from(encoding.count(&projected.text)).ok()),
            None,
        ),
        TokenizerFamily::Cl100k => (
            get_encoding("cl100k_base")
                .and_then(|encoding| u64::try_from(encoding.count(&projected.text)).ok()),
            None,
        ),
        TokenizerFamily::CharacterHeuristic => (
            Some(heuristic::count(&projected.text)),
            Some(DiagnosticCode::HeuristicTokenizer),
        ),
        TokenizerFamily::Unavailable => (None, Some(DiagnosticCode::UnsupportedTokenizer)),
    };
    let (tokens, range_note) = match tokens {
        Some(tokens) if tokens <= MAX_SAFE_JSON_INTEGER => (Some(tokens), None),
        Some(_) => (None, Some(DiagnosticCode::TokenEstimateOutOfRange)),
        None => (None, None),
    };
    let mut note_codes = projected.note_codes;
    if let Some(note) = count_note {
        note_codes.push(note);
    }
    if let Some(note) = range_note {
        note_codes.push(note);
    }
    note_codes.sort();
    note_codes.dedup();
    let coverage = if tokens.is_none() {
        TokenCoverage::Unavailable
    } else if projected.partial {
        TokenCoverage::Partial
    } else {
        TokenCoverage::Complete
    };
    TokenEstimate {
        profile_id: profile.id.clone(),
        tokens,
        method: profile.method,
        coverage,
        note_codes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        ContextItemKind, MessageContent, NormalizedContextItem, TokenizationPayload,
    };
    use std::collections::BTreeMap;

    fn item(text: &str) -> NormalizedContextItem {
        NormalizedContextItem {
            id: "opaque".into(),
            kind: ContextItemKind::UserMessage,
            label: "User message".into(),
            source_record_id: None,
            source_tool_call_id: None,
            metadata: BTreeMap::new(),
            serialized_size_bytes: 20,
            payload: TokenizationPayload::UserMessage(MessageContent::text(text)),
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        }
    }

    #[test]
    fn pinned_openai_tokenizers_are_local_and_deterministic() {
        let target = ModelTarget {
            provider: Some("openai".into()),
            model: Some("gpt-4o-mini".into()),
            api: None,
        };
        let mut registry = ProfileRegistry::default();
        let profile = registry.profile(&target, super::super::TokenizationPolicy::Auto);
        let first = registry.estimate(&item("hello world"), &profile, &target);
        let second = registry.estimate(&item("hello world"), &profile, &target);
        assert_eq!(first.tokens, Some(2));
        assert_eq!(first.tokens, second.tokens);
        assert_eq!(first.method, TokenizationMethod::ModelTokenizer);
        assert_eq!(first.coverage, TokenCoverage::Complete);
    }

    #[test]
    fn gpt6_profiles_count_text_with_o200k_instead_of_the_character_fallback() {
        for (provider, api) in [
            ("openai-codex", "openai-codex-responses"),
            ("github-copilot", "openai-responses"),
        ] {
            let target = ModelTarget {
                provider: Some(provider.into()),
                model: Some("gpt-6-future".into()),
                api: Some(api.into()),
            };
            let mut registry = ProfileRegistry::default();
            let profile = registry.profile(&target, super::super::TokenizationPolicy::Auto);
            let estimate = registry.estimate(&item("hello world"), &profile, &target);
            assert_eq!(estimate.tokens, Some(2));
            assert_eq!(estimate.method, TokenizationMethod::ModelTokenizer);
        }
    }

    #[test]
    fn repeated_fingerprinted_estimates_do_not_reinvoke_the_tokenizer() {
        let target = ModelTarget {
            provider: Some("openai".into()),
            model: Some("gpt-4o-mini".into()),
            api: None,
        };
        let mut registry = ProfileRegistry::default();
        let profile = registry.profile(&target, super::super::TokenizationPolicy::Auto);
        let source = item(&"large result ".repeat(100));
        let fingerprint = registry.fingerprint_item(&source);
        let first_tokens = registry
            .estimate_fingerprinted(&source, fingerprint, &profile, &target)
            .tokens;
        for _ in 0..31 {
            let estimate = registry.estimate_fingerprinted(&source, fingerprint, &profile, &target);
            assert_eq!(estimate.tokens, first_tokens);
        }
        let stats = registry.stats();
        assert_eq!(stats.payloads_fingerprinted, 1);
        assert_eq!(stats.unique_estimates, 1);
        assert_eq!(stats.tokenizer_invocations, 1);
        assert_eq!(stats.estimate_cache_hits, 31);
    }

    #[test]
    fn projection_target_identity_prevents_estimate_aliasing() {
        let source = NormalizedContextItem {
            id: "assistant".into(),
            kind: ContextItemKind::AssistantMessage,
            label: "assistant".into(),
            source_record_id: None,
            source_tool_call_id: None,
            metadata: BTreeMap::new(),
            serialized_size_bytes: 1,
            payload: TokenizationPayload::AssistantMessage {
                blocks: vec![crate::domain::AssistantContentBlock::Thinking {
                    text: "private reasoning".into(),
                    provider_signature: None,
                }],
                source_provider: Some("provider".into()),
                source_model: Some("unknown".into()),
                source_api: None,
            },
            presence: Vec::new(),
            first_model_call: 0,
            last_model_call: 0,
        };
        let destination_absent = ModelTarget {
            provider: Some("provider".into()),
            model: None,
            api: None,
        };
        let destination_literal = ModelTarget {
            provider: Some("provider".into()),
            model: Some("unknown".into()),
            api: None,
        };
        let mut registry = ProfileRegistry::default();
        let fingerprint = registry.fingerprint_item(&source);
        let absent_profile =
            registry.profile_index(&destination_absent, super::super::TokenizationPolicy::Auto);
        let literal_profile =
            registry.profile_index(&destination_literal, super::super::TokenizationPolicy::Auto);
        let absent = registry.estimate_index_at_profile(&source, fingerprint, absent_profile);
        let literal = registry.estimate_index_at_profile(&source, fingerprint, literal_profile);
        assert_ne!(absent_profile, literal_profile);
        assert_ne!(absent, literal);
        assert_ne!(
            registry.estimate_at(absent).coverage,
            registry.estimate_at(literal).coverage
        );
    }
}
