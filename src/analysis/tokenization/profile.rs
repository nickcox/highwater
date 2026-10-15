use crate::domain::ModelTarget;

const TIKTOKEN_VERSION: &str = "tiktoken-4.1.2";
// Anthropic publishes no tokenizer for Claude 3 or later. Claude estimates come from the port
// of ctok in `claude/`, a reconstruction of each tokenizer generation from count_tokens
// measurements, at the ctok commit named here.
const CTOK_VERSION: &str = "ctok-8c43ffd+highwater-port-v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum TokenizationPolicy {
    Auto,
    Strict,
    Heuristic,
    Off,
}

impl TokenizationPolicy {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::Strict => "strict",
            Self::Heuristic => "heuristic",
            Self::Off => "off",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum TokenizerFamily {
    O200k,
    Cl100k,
    /// The reconstructed Claude tokenizer generations (ctok).
    ClaudeV3,
    ClaudeV4_7,
    ClaudeV4_8,
    CharacterHeuristic,
    Unavailable,
}

impl TokenizerFamily {
    /// The Claude tokenizer generation, for the Claude families.
    pub(crate) fn claude_generation(self) -> Option<super::claude::Generation> {
        use super::claude::Generation;
        match self {
            Self::ClaudeV3 => Some(Generation::V3),
            Self::ClaudeV4_7 => Some(Generation::V4_7),
            Self::ClaudeV4_8 => Some(Generation::V4_8),
            _ => None,
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::O200k => "o200k",
            Self::Cl100k => "cl100k",
            Self::ClaudeV3 => "ctok-claude-v3",
            Self::ClaudeV4_7 => "ctok-claude-v4.7",
            Self::ClaudeV4_8 => "ctok-claude-v4.8",
            Self::CharacterHeuristic => "unicode-scalar-div-4",
            Self::Unavailable => "unavailable",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum FramingPolicy {
    OpenAiChatApproximation,
    Unknown,
}

impl FramingPolicy {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::OpenAiChatApproximation => "openai-chat-approximation",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum TokenizationMethod {
    ModelTokenizer,
    ApiSerializationEstimate,
    CharacterHeuristic,
    /// A size the provider reported, such as a response's reasoning tokens.
    ReportedUsage,
    Unavailable,
}

impl TokenizationMethod {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::ModelTokenizer => "modelTokenizer",
            Self::ApiSerializationEstimate => "apiSerializationEstimate",
            Self::CharacterHeuristic => "characterHeuristic",
            Self::ReportedUsage => "reportedUsage",
            Self::Unavailable => "unavailable",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct ProfileKey {
    pub(crate) provider: Option<String>,
    pub(crate) model: Option<String>,
    pub(crate) api: Option<String>,
    pub(crate) policy: TokenizationPolicy,
    pub(crate) family: TokenizerFamily,
    pub(crate) method: TokenizationMethod,
    pub(crate) framing: FramingPolicy,
    pub(crate) implementation: String,
    pub(crate) rule: String,
    pub(crate) version: u32,
}

impl ProfileKey {
    fn digest(&self) -> String {
        let mut hasher = blake3::Hasher::new();
        hasher.update(b"highwater-profile-key-v1\0");
        hash_optional(&mut hasher, self.provider.as_deref());
        hash_optional(&mut hasher, self.model.as_deref());
        hash_optional(&mut hasher, self.api.as_deref());
        hash_string(&mut hasher, self.policy.as_str());
        hash_string(&mut hasher, self.family.as_str());
        hash_string(&mut hasher, self.method.as_str());
        hash_string(&mut hasher, self.framing.as_str());
        hash_string(&mut hasher, &self.implementation);
        hash_string(&mut hasher, &self.rule);
        hasher.update(&self.version.to_le_bytes());
        format!("profile-v1-{}", hasher.finalize().to_hex())
    }
}

fn hash_string(hasher: &mut blake3::Hasher, value: &str) {
    hasher.update(&(value.len() as u64).to_le_bytes());
    hasher.update(value.as_bytes());
}

fn hash_optional(hasher: &mut blake3::Hasher, value: Option<&str>) {
    match value {
        Some(value) => {
            hasher.update(&[1]);
            hash_string(hasher, value);
        }
        None => {
            hasher.update(&[0]);
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct TokenizationProfile {
    pub id: String,
    pub provider: String,
    pub model: String,
    pub api: Option<String>,
    pub family: TokenizerFamily,
    pub method: TokenizationMethod,
    pub framing: FramingPolicy,
    pub version: u32,
    pub rule: String,
    key: ProfileKey,
    projection_target: ModelTarget,
}

impl TokenizationProfile {
    pub(crate) fn framing_overhead(&self, message_count: usize) -> Option<u64> {
        match self.framing {
            // This is the documented approximation used by the local OpenAI chat
            // serialization model: three tokens per message and three priming tokens.
            FramingPolicy::OpenAiChatApproximation => u64::try_from(message_count)
                .ok()?
                .checked_mul(3)?
                .checked_add(3),
            // Encoding support does not imply that the request's wire framing is
            // known. Responses, Codex, tools, and multimodal payloads remain
            // unavailable until their serialization rule is explicitly supported.
            FramingPolicy::Unknown => None,
        }
    }

    pub(crate) fn key(&self) -> &ProfileKey {
        &self.key
    }

    pub(crate) fn projection_target(&self) -> &ModelTarget {
        &self.projection_target
    }

    /// How payloads are written out for this profile's tokenizer. Claude models read tool
    /// calls as `invoke` elements, and their image limits are from Anthropic's documentation:
    /// 1,568 px and about 1,600 tokens up to Opus 4.6 and Sonnet 4.6, 2,576 px and 4,784
    /// tokens from Opus 4.7 and Sonnet 5.
    pub(crate) fn projection_rules(&self) -> super::ProjectionRules {
        use super::{ImageSizing, ProjectionRules, ToolCallRendering};
        let images = match self.family {
            TokenizerFamily::ClaudeV3 => ImageSizing::Claude {
                long_edge: 1568,
                max_tokens: 1600,
            },
            TokenizerFamily::ClaudeV4_7 | TokenizerFamily::ClaudeV4_8 => ImageSizing::Claude {
                long_edge: 2576,
                max_tokens: 4784,
            },
            _ => return ProjectionRules::GENERIC,
        };
        ProjectionRules {
            tool_calls: ToolCallRendering::ClaudeInvoke,
            images,
        }
    }
}

pub(crate) fn resolve_profile(
    target: &ModelTarget,
    policy: TokenizationPolicy,
) -> TokenizationProfile {
    let provider = target.provider.as_deref().unwrap_or("unknown");
    let model = target.model.as_deref().unwrap_or("unknown");
    let api = target.api.as_deref();
    if policy == TokenizationPolicy::Off {
        return build_profile(
            target,
            policy,
            TokenizerFamily::Unavailable,
            TokenizationMethod::Unavailable,
            "disabled",
        );
    }
    if policy == TokenizationPolicy::Heuristic {
        return build_profile(
            target,
            policy,
            TokenizerFamily::CharacterHeuristic,
            TokenizationMethod::CharacterHeuristic,
            "forced-character-heuristic",
        );
    }

    // A model's tokenizer is part of the model, so a Claude model is matched by its ID
    // whichever provider served it (Anthropic, GitHub Copilot, Bedrock, Vertex...).
    if let Some((family, rule)) = target.model.as_deref().and_then(claude_generation) {
        return build_profile(
            target,
            policy,
            family,
            TokenizationMethod::ApiSerializationEstimate,
            rule,
        );
    }

    let lower_provider = provider.to_ascii_lowercase();
    let lower_model = model.to_ascii_lowercase();
    let is_gpt6 = lower_model.starts_with("gpt-6");
    let matched = if is_gpt6
        && (is_openai_provider(&lower_provider)
            || (lower_provider == "github-copilot" && api == Some("openai-responses")))
    {
        // Assumption, not a published OpenAI model mapping: in local text-only
        // GPT-6 Sol/Astra responses, reported output tokens match o200k_base
        // text tokens plus the same four-token overhead observed for GPT-5.6.
        // Revisit when OpenAI publishes the GPT-6 encoding. Keep the provider/API
        // gate: a model name alone is not proof of the underlying tokenizer.
        Some((TokenizerFamily::O200k, "assumed-gpt6-o200k-base"))
    } else if is_openai_provider(&lower_provider) {
        tiktoken::model_to_encoding(&lower_model).and_then(|encoding| match encoding {
            "o200k_base" => Some((TokenizerFamily::O200k, "tiktoken-o200k-base")),
            "cl100k_base" => Some((TokenizerFamily::Cl100k, "tiktoken-cl100k-base")),
            _ => None,
        })
    } else {
        None
    };
    if let Some((family, rule)) = matched {
        return build_profile(
            target,
            policy,
            family,
            TokenizationMethod::ModelTokenizer,
            rule,
        );
    }
    if lower_provider == "anthropic" || lower_provider == "google" {
        return build_profile(
            target,
            policy,
            TokenizerFamily::CharacterHeuristic,
            TokenizationMethod::ApiSerializationEstimate,
            "provider-api-serialization-estimate",
        );
    }
    if policy == TokenizationPolicy::Strict {
        build_profile(
            target,
            policy,
            TokenizerFamily::Unavailable,
            TokenizationMethod::Unavailable,
            "no-matched-tokenizer",
        )
    } else {
        build_profile(
            target,
            policy,
            TokenizerFamily::CharacterHeuristic,
            TokenizationMethod::CharacterHeuristic,
            "source-neutral-character-fallback",
        )
    }
}

fn build_profile(
    target: &ModelTarget,
    policy: TokenizationPolicy,
    family: TokenizerFamily,
    method: TokenizationMethod,
    rule: &str,
) -> TokenizationProfile {
    let provider = target.provider.as_deref().unwrap_or("unknown").to_owned();
    let model = target.model.as_deref().unwrap_or("unknown").to_owned();
    let api = target.api.clone();
    let implementation = match family {
        TokenizerFamily::O200k | TokenizerFamily::Cl100k => TIKTOKEN_VERSION,
        TokenizerFamily::ClaudeV3 | TokenizerFamily::ClaudeV4_7 | TokenizerFamily::ClaudeV4_8 => {
            CTOK_VERSION
        }
        TokenizerFamily::CharacterHeuristic => "highwater-character-heuristic-v1",
        TokenizerFamily::Unavailable => "highwater-unavailable-v1",
    };
    let framing = if matches!(family, TokenizerFamily::O200k | TokenizerFamily::Cl100k)
        && is_openai_provider(&provider.to_ascii_lowercase())
        && api.as_deref() == Some("openai-chat-completions")
    {
        FramingPolicy::OpenAiChatApproximation
    } else {
        FramingPolicy::Unknown
    };
    let key = ProfileKey {
        provider: target.provider.clone(),
        model: target.model.clone(),
        api: target.api.clone(),
        policy,
        family,
        method,
        framing,
        implementation: implementation.into(),
        rule: rule.into(),
        version: 1,
    };
    let id = key.digest();
    TokenizationProfile {
        id,
        provider,
        model,
        api,
        family,
        method,
        framing,
        version: key.version,
        rule: key.rule.clone(),
        key,
        projection_target: target.clone(),
    }
}

/// Routes spell Claude model IDs differently: `claude-opus-4.6` (GitHub Copilot),
/// `us.anthropic.claude-opus-4-6-20260101-v1:0` (Bedrock), `claude-opus-4-6@20260101`
/// (Vertex), `anthropic/claude-opus-4-6`. All of these become `claude-opus-4-6`.
pub(crate) fn normalised_claude_model(model: &str) -> Option<String> {
    let mut id = model.trim().to_ascii_lowercase();
    if let Some(rest) = id.strip_prefix("anthropic/") {
        id = rest.to_owned();
    }
    if let Some(position) = id.find("anthropic.") {
        let region = &id[..position];
        if region.is_empty()
            || (region.ends_with('.')
                && region[..region.len() - 1]
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-'))
        {
            id = id[position + "anthropic.".len()..].to_owned();
        }
    }
    if let Some((head, _)) = id.split_once('@') {
        id = head.to_owned();
    }
    if let Some(position) = id.rfind("-v") {
        let suffix = &id[position + 2..];
        if suffix.split_once(':').is_some_and(|(major, minor)| {
            !major.is_empty()
                && !minor.is_empty()
                && major.chars().all(|c| c.is_ascii_digit())
                && minor.chars().all(|c| c.is_ascii_digit())
        }) {
            id.truncate(position);
        }
    }
    id = id.replace('.', "-");
    if id.len() > 9 {
        let (head, tail) = id.split_at(id.len() - 9);
        if tail.starts_with('-') && tail[1..].chars().all(|c| c.is_ascii_digit()) {
            id = head.to_owned();
        }
    }
    id.starts_with("claude-").then_some(id)
}

/// The tokenizer family and rule for a Claude model ID, or `None` when the ID is not
/// a Claude model or comes before Claude 3, whose tokenizer was different.
fn claude_generation(model: &str) -> Option<(TokenizerFamily, &'static str)> {
    const V3: (TokenizerFamily, &str) = (TokenizerFamily::ClaudeV3, "claude-v3-ctok");
    const V4_7: (TokenizerFamily, &str) = (TokenizerFamily::ClaudeV4_7, "claude-v4.7-ctok");
    const V4_8: (TokenizerFamily, &str) = (TokenizerFamily::ClaudeV4_8, "claude-v4.8-ctok");
    // An unmeasured model uses the newest measured generation, and its rule says so.
    const ASSUMED: (TokenizerFamily, &str) =
        (TokenizerFamily::ClaudeV4_8, "assumed-latest-claude-ctok");
    let id = normalised_claude_model(model)?;
    let parts: Vec<&str> = id.split('-').skip(1).collect();
    let number = |part: Option<&&str>| part.and_then(|part| part.parse::<u32>().ok());
    // Claude 3 named the version first (`claude-3-5-sonnet`); later models name it last.
    if let Some(major) = number(parts.first()) {
        return match major {
            0..=2 => None,
            3 => Some(V3),
            _ => Some(ASSUMED),
        };
    }
    let name = *parts.first()?;
    // `claude-instant-1`, `claude-v1` and `claude-v2` predate Claude 3.
    if name == "instant"
        || name
            .strip_prefix('v')
            .is_some_and(|version| version.parse::<u32>().is_ok())
    {
        return None;
    }
    let Some(major) = number(parts.get(1)) else {
        return Some(ASSUMED);
    };
    let minor = number(parts.get(2))
        .filter(|minor| *minor < 100)
        .unwrap_or(0);
    let version = (major, minor);
    Some(match (name, version) {
        (_, version) if version < (4, 7) && major >= 3 => V3,
        ("opus", (4, 7)) => V4_7,
        ("opus", version) if version >= (4, 8) && major <= 5 => V4_8,
        ("sonnet" | "fable", (5, _)) => V4_8,
        _ => ASSUMED,
    })
}

/// Whether a Claude model keeps thinking from earlier turns in context, or `None` for a
/// model that is not a Claude 3 or later model. From Anthropic's "Thinking block
/// preservation by model": Opus 4.5 and later, Sonnet 4.6 and later, Haiku 5.5 and later,
/// and the Fable and Mythos models keep all earlier turns; earlier models keep thinking
/// only until the next user message. A model this does not recognise is assumed to
/// behave like the newest ones.
pub(crate) fn claude_keeps_prior_thinking(model: &str) -> Option<bool> {
    claude_generation(model)?;
    let id = normalised_claude_model(model)?;
    let parts: Vec<&str> = id.split('-').skip(1).collect();
    let number = |part: Option<&&str>| part.and_then(|part| part.parse::<u32>().ok());
    if number(parts.first()).is_some() {
        // `claude-3-…`: Claude 3, 3.5 and 3.7 keep only the last turn.
        return Some(false);
    }
    let name = *parts.first()?;
    let Some(major) = number(parts.get(1)) else {
        return Some(true);
    };
    let minor = number(parts.get(2))
        .filter(|minor| *minor < 100)
        .unwrap_or(0);
    let version = (major, minor);
    Some(match name {
        "opus" => version >= (4, 5),
        "sonnet" => version >= (4, 6),
        "haiku" => version >= (5, 5),
        _ => true,
    })
}

fn is_openai_provider(provider: &str) -> bool {
    matches!(provider, "openai" | "openai-codex")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gpt6_assumption_is_scoped_to_openai_and_verified_copilot_route() {
        for (provider, api) in [
            ("openai", "openai-responses"),
            ("openai-codex", "openai-codex-responses"),
            ("github-copilot", "openai-responses"),
        ] {
            for model in ["gpt-6-sol", "gpt-6-astra", "gpt-6-future"] {
                let target = ModelTarget {
                    provider: Some(provider.into()),
                    model: Some(model.into()),
                    api: Some(api.into()),
                };
                let auto = resolve_profile(&target, TokenizationPolicy::Auto);
                assert_eq!(auto.family, TokenizerFamily::O200k, "{provider}/{model}");
                assert_eq!(auto.method, TokenizationMethod::ModelTokenizer);
                assert_eq!(auto.rule, "assumed-gpt6-o200k-base");
                assert!(auto.id.starts_with("profile-v1-"));
                assert_eq!(
                    resolve_profile(&target, TokenizationPolicy::Strict).family,
                    TokenizerFamily::O200k
                );
                assert_eq!(
                    resolve_profile(&target, TokenizationPolicy::Heuristic).method,
                    TokenizationMethod::CharacterHeuristic
                );
                assert_eq!(
                    resolve_profile(&target, TokenizationPolicy::Off).method,
                    TokenizationMethod::Unavailable
                );
            }
        }
        for (provider, api) in [
            ("github-copilot", "openai-completions"),
            ("openrouter", "openai-responses"),
            ("unknown", "openai-responses"),
        ] {
            let target = ModelTarget {
                provider: Some(provider.into()),
                model: Some("gpt-6-astra".into()),
                api: Some(api.into()),
            };
            assert_eq!(
                resolve_profile(&target, TokenizationPolicy::Auto).method,
                TokenizationMethod::CharacterHeuristic
            );
            assert_eq!(
                resolve_profile(&target, TokenizationPolicy::Strict).method,
                TokenizationMethod::Unavailable
            );
        }
    }

    #[test]
    fn claude_model_ids_from_every_route_normalise_to_the_same_id() {
        for (route, expected) in [
            ("claude-opus-4-6", "claude-opus-4-6"),
            ("claude-opus-4.6", "claude-opus-4-6"),
            ("Claude-Opus-4.6", "claude-opus-4-6"),
            ("anthropic/claude-opus-4-6", "claude-opus-4-6"),
            ("anthropic.claude-opus-4-6-20260101-v1:0", "claude-opus-4-6"),
            (
                "us.anthropic.claude-opus-4-6-20260101-v1:0",
                "claude-opus-4-6",
            ),
            (
                "eu-central.anthropic.claude-opus-4-6-v2:0",
                "claude-opus-4-6",
            ),
            ("claude-opus-4-6@20260101", "claude-opus-4-6"),
            ("claude-haiku-4-5-20251001", "claude-haiku-4-5"),
            ("claude-3-5-sonnet-20241022", "claude-3-5-sonnet"),
            ("claude-opus-4.6-1m", "claude-opus-4-6-1m"),
        ] {
            assert_eq!(
                normalised_claude_model(route).as_deref(),
                Some(expected),
                "{route}"
            );
        }
        for not_claude in [
            "<synthetic>",
            "gpt-6-sol",
            "my-claude-wrapper",
            "",
            "anthropic.gpt",
        ] {
            assert_eq!(normalised_claude_model(not_claude), None, "{not_claude}");
        }
    }

    #[test]
    fn claude_models_get_their_generation_whichever_provider_served_them() {
        use TokenizerFamily::*;
        let measured = |family| match family {
            ClaudeV3 => "claude-v3-ctok",
            ClaudeV4_7 => "claude-v4.7-ctok",
            _ => "claude-v4.8-ctok",
        };
        for (model, family) in [
            ("claude-3-opus-20240229", ClaudeV3),
            ("claude-3-5-sonnet-20241022", ClaudeV3),
            ("claude-3-7-sonnet", ClaudeV3),
            ("claude-haiku-4-5-20251001", ClaudeV3),
            ("claude-sonnet-4", ClaudeV3),
            ("claude-sonnet-4.6", ClaudeV3),
            ("claude-opus-4", ClaudeV3),
            ("claude-opus-4-1-20250805", ClaudeV3),
            ("claude-opus-4.6", ClaudeV3),
            ("claude-opus-4-7", ClaudeV4_7),
            ("claude-opus-4-8", ClaudeV4_8),
            ("claude-opus-5", ClaudeV4_8),
            ("claude-opus-5-5", ClaudeV4_8),
            ("claude-opus-5.5", ClaudeV4_8),
            ("claude-sonnet-5-5", ClaudeV4_8),
            ("claude-fable-5-1", ClaudeV4_8),
        ] {
            for (provider, api) in [
                (Some("anthropic"), Some("anthropic-messages")),
                (Some("github-copilot"), Some("anthropic-messages")),
                (Some("github-copilot"), None),
                (None, None),
            ] {
                let target = ModelTarget {
                    provider: provider.map(str::to_owned),
                    model: Some(model.into()),
                    api: api.map(str::to_owned),
                };
                for policy in [TokenizationPolicy::Auto, TokenizationPolicy::Strict] {
                    let profile = resolve_profile(&target, policy);
                    assert_eq!(profile.family, family, "{model} {provider:?}");
                    assert_eq!(profile.rule, measured(family), "{model}");
                    assert_eq!(profile.method, TokenizationMethod::ApiSerializationEstimate);
                    assert_eq!(profile.framing_overhead(1), None);
                    assert!(profile.id.starts_with("profile-v1-"));
                }
                assert_eq!(
                    resolve_profile(&target, TokenizationPolicy::Heuristic).family,
                    CharacterHeuristic
                );
                assert_eq!(
                    resolve_profile(&target, TokenizationPolicy::Off).family,
                    Unavailable
                );
            }
        }
        for model in [
            "claude-haiku-5-5",
            "claude-opus-6",
            "claude-sonnet-4-7",
            "claude-sonnet",
        ] {
            let profile = resolve_profile(
                &ModelTarget {
                    provider: Some("anthropic".into()),
                    model: Some(model.into()),
                    api: None,
                },
                TokenizationPolicy::Auto,
            );
            assert_eq!(profile.family, ClaudeV4_8, "{model}");
            assert_eq!(profile.rule, "assumed-latest-claude-ctok", "{model}");
        }
        for model in [
            "claude-2.1",
            "claude-instant-1.2",
            "claude-v1",
            "<synthetic>",
        ] {
            let profile = resolve_profile(
                &ModelTarget {
                    provider: Some("anthropic".into()),
                    model: Some(model.into()),
                    api: None,
                },
                TokenizationPolicy::Auto,
            );
            assert_eq!(profile.family, CharacterHeuristic, "{model}");
            assert_eq!(
                profile.rule, "provider-api-serialization-estimate",
                "{model}"
            );
        }
        let reconstructed = resolve_profile(
            &ModelTarget {
                provider: Some("anthropic".into()),
                model: Some("claude-opus-5".into()),
                api: None,
            },
            TokenizationPolicy::Auto,
        );
        let heuristic = resolve_profile(
            &ModelTarget {
                provider: Some("anthropic".into()),
                model: Some("claude-opus-5".into()),
                api: None,
            },
            TokenizationPolicy::Heuristic,
        );
        assert_ne!(reconstructed.id, heuristic.id);
        assert_eq!(reconstructed.key.implementation, CTOK_VERSION);
        assert_eq!(
            reconstructed.projection_rules(),
            super::super::ProjectionRules {
                tool_calls: super::super::ToolCallRendering::ClaudeInvoke,
                images: super::super::ImageSizing::Claude {
                    long_edge: 2576,
                    max_tokens: 4784
                },
            }
        );
        assert_eq!(
            heuristic.projection_rules(),
            super::super::ProjectionRules::GENERIC
        );
    }

    #[test]
    fn prior_thinking_retention_follows_anthropics_model_table() {
        for (model, keeps) in [
            ("claude-opus-4-5", Some(true)),
            ("claude-opus-4-1", Some(false)),
            ("claude-opus-4", Some(false)),
            ("claude-sonnet-4-6", Some(true)),
            ("claude-sonnet-4.5", Some(false)),
            ("claude-haiku-4-5-20251001", Some(false)),
            ("claude-haiku-5-5", Some(true)),
            ("claude-3-7-sonnet", Some(false)),
            ("claude-opus-5-5", Some(true)),
            ("claude-fable-5-1", Some(true)),
            ("claude-mythos-5-1", Some(true)),
            ("claude-opus-6", Some(true)),
            ("claude-2.1", None),
            ("gpt-6-sol", None),
        ] {
            assert_eq!(claude_keeps_prior_thinking(model), keeps, "{model}");
        }
    }

    #[test]
    fn optional_target_values_have_distinct_profile_identity() {
        let absent = ModelTarget {
            provider: None,
            model: None,
            api: None,
        };
        let literal_unknown = ModelTarget {
            provider: Some("unknown".into()),
            model: Some("unknown".into()),
            api: Some("unknown:api".into()),
        };
        let absent_profile = resolve_profile(&absent, TokenizationPolicy::Auto);
        let literal_profile = resolve_profile(&literal_unknown, TokenizationPolicy::Auto);
        assert_ne!(absent_profile.id, literal_profile.id);
        assert_ne!(absent_profile.key, literal_profile.key);

        let delimiter_a = ModelTarget {
            provider: Some("a:b".into()),
            model: Some("c".into()),
            api: None,
        };
        let delimiter_b = ModelTarget {
            provider: Some("a".into()),
            model: Some("b:c".into()),
            api: None,
        };
        assert_ne!(
            resolve_profile(&delimiter_a, TokenizationPolicy::Heuristic).id,
            resolve_profile(&delimiter_b, TokenizationPolicy::Heuristic).id
        );
        assert_ne!(
            resolve_profile(
                &ModelTarget {
                    provider: Some("OpenAI".into()),
                    model: Some("gpt-4o-mini".into()),
                    api: None,
                },
                TokenizationPolicy::Auto,
            )
            .id,
            resolve_profile(
                &ModelTarget {
                    provider: Some("openai".into()),
                    model: Some("gpt-4o-mini".into()),
                    api: None,
                },
                TokenizationPolicy::Auto,
            )
            .id
        );
    }

    #[test]
    fn framing_requires_an_explicit_supported_chat_api() {
        let target = |api: Option<&str>| ModelTarget {
            provider: Some("openai".into()),
            model: Some("gpt-4o-mini".into()),
            api: api.map(str::to_owned),
        };
        let chat = resolve_profile(
            &target(Some("openai-chat-completions")),
            TokenizationPolicy::Auto,
        );
        assert_eq!(chat.framing, FramingPolicy::OpenAiChatApproximation);
        assert_eq!(chat.framing_overhead(2), Some(9));
        for api in [None, Some("responses"), Some("openai-responses")] {
            let profile = resolve_profile(&target(api), TokenizationPolicy::Auto);
            assert_eq!(profile.family, TokenizerFamily::O200k);
            assert_eq!(profile.framing, FramingPolicy::Unknown);
            assert_eq!(profile.framing_overhead(2), None);
        }
    }

    #[test]
    fn resolves_library_openai_families_and_codex_aliases() {
        let gpt4o = resolve_profile(
            &ModelTarget {
                provider: Some("openai".into()),
                model: Some("gpt-4o-mini".into()),
                api: None,
            },
            TokenizationPolicy::Auto,
        );
        assert_eq!(gpt4o.family, TokenizerFamily::O200k);
        assert_eq!(gpt4o.method, TokenizationMethod::ModelTokenizer);
        for model in ["gpt-5.6-sol", "gpt-5.6-luna"] {
            let codex = resolve_profile(
                &ModelTarget {
                    provider: Some("openai-codex".into()),
                    model: Some(model.into()),
                    api: Some("openai-codex-responses".into()),
                },
                TokenizationPolicy::Auto,
            );
            assert_eq!(codex.family, TokenizerFamily::O200k);
            assert_eq!(codex.method, TokenizationMethod::ModelTokenizer);
            assert_eq!(codex.rule, "tiktoken-o200k-base");
        }
        let gpt4 = resolve_profile(
            &ModelTarget {
                provider: Some("openai".into()),
                model: Some("gpt-4-turbo".into()),
                api: None,
            },
            TokenizationPolicy::Auto,
        );
        assert_eq!(gpt4.family, TokenizerFamily::Cl100k);
        let unknown = resolve_profile(
            &ModelTarget {
                provider: Some("openai".into()),
                model: Some("gpt-unknown-custom".into()),
                api: None,
            },
            TokenizationPolicy::Strict,
        );
        assert_eq!(unknown.method, TokenizationMethod::Unavailable);
        let anthropic = resolve_profile(
            &ModelTarget {
                provider: Some("anthropic".into()),
                model: Some("claude-sonnet".into()),
                api: Some("messages".into()),
            },
            TokenizationPolicy::Auto,
        );
        assert_eq!(
            anthropic.method,
            TokenizationMethod::ApiSerializationEstimate
        );
        assert_eq!(anthropic.framing_overhead(3), None);

        for provider in [None, Some("unknown"), Some("together")] {
            let fallback = resolve_profile(
                &ModelTarget {
                    provider: provider.map(str::to_owned),
                    model: Some("gpt-4o".into()),
                    api: None,
                },
                TokenizationPolicy::Auto,
            );
            assert_eq!(fallback.method, TokenizationMethod::CharacterHeuristic);
            assert_eq!(fallback.family, TokenizerFamily::CharacterHeuristic);

            let unavailable = resolve_profile(
                &ModelTarget {
                    provider: provider.map(str::to_owned),
                    model: Some("gpt-4o".into()),
                    api: None,
                },
                TokenizationPolicy::Strict,
            );
            assert_eq!(unavailable.method, TokenizationMethod::Unavailable);
        }
    }
}
