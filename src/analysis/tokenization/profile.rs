use crate::domain::ModelTarget;

const TIKTOKEN_VERSION: &str = "tiktoken-4.1.2";

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
    CharacterHeuristic,
    Unavailable,
}

impl TokenizerFamily {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::O200k => "o200k",
            Self::Cl100k => "cl100k",
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
    Unavailable,
}

impl TokenizationMethod {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::ModelTokenizer => "modelTokenizer",
            Self::ApiSerializationEstimate => "apiSerializationEstimate",
            Self::CharacterHeuristic => "characterHeuristic",
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
        hasher.update(b"tokenplume-profile-key-v4\0");
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
        format!("profile-v4-{}", hasher.finalize().to_hex())
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
        TokenizerFamily::CharacterHeuristic => "tokenplume-character-heuristic-v1",
        TokenizerFamily::Unavailable => "tokenplume-unavailable-v1",
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
        version: 4,
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
                assert!(auto.id.starts_with("profile-v4-"));
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
